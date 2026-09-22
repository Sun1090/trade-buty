import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import { SERVICE_WORKER_CACHE_POLICY } from "../../next.config";

const OFFLINE_HTML = readFileSync(
  path.resolve(process.cwd(), "public/offline.html"),
  "utf8"
);
const SW_SOURCE = readFileSync(
  path.resolve(process.cwd(), "public/sw.js"),
  "utf8"
);
// 去掉块注释后再做「不触碰内容产物」断言，注释里说明边界不算违规。
const SW_CODE = SW_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * 抽出 `<main>` 里每个可见元素的纯文本，按文档顺序返回。
 * 这页没有嵌套的可见元素，一层标签足够；抽不到就返回空数组，由用例的非空断言兜住。
 */
function mainElements(html: string): { tag: string; text: string }[] {
  const main = /<main>([\s\S]*?)<\/main>/.exec(html)?.[1] ?? "";
  const out: { tag: string; text: string }[] = [];
  for (const m of main.matchAll(/<(p|li|h1|button|a)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) out.push({ tag: m[1], text });
  }
  return out;
}

describe("PWA manifest（R13.13）", () => {
  it("声明稳定的 app 身份、作用域与中文默认入口", () => {
    const m = manifest();
    expect(m.id).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.start_url).toBe("/zh");
    expect(m.lang).toBe("zh-CN");
    expect(m.dir).toBe("ltr");
  });

  it("保持可安装性与图标契约", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#0a0d14");
    expect(m.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
    expect(m.icons?.some((icon) => icon.sizes === "512x512")).toBe(true);
  });

  it("start_url 指向真实存在的本地化路由", () => {
    expect(manifest().start_url).toMatch(/^\/(zh|en)$/);
  });

  it("robots 不收录离线兜底页", () => {
    const rules = robots().rules;
    const disallow = Array.isArray(rules)
      ? rules.flatMap((rule) => rule.disallow ?? [])
      : (rules.disallow ?? []);
    expect(disallow).toContain("/offline.html");
  });
});

describe("离线页（R13.13）", () => {
  it("自带全部样式脚本，不依赖外部资源", () => {
    expect(OFFLINE_HTML).not.toMatch(/<link[^>]+href="https?:/i);
    expect(OFFLINE_HTML).not.toMatch(/<script[^>]+src=/i);
    expect(OFFLINE_HTML).not.toMatch(/url\(\s*["']?https?:/i);
  });

  it("是中英双语、可重试、且不被搜索引擎收录", () => {
    expect(OFFLINE_HTML).toContain('name="robots" content="noindex"');
    expect(OFFLINE_HTML).toContain("离线");
    expect(OFFLINE_HTML).toContain('lang="en"');
    expect(OFFLINE_HTML).toContain('id="retry"');
    expect(OFFLINE_HTML).toContain('role="status"');
    expect(OFFLINE_HTML).toContain('aria-live="polite"');
  });

  it("每一句中文都有对应的英文，en 用户看到的承诺读得懂", () => {
    const elements = mainElements(OFFLINE_HTML);
    const chinese = elements.filter((e) => /[\u4e00-\u9fff]/.test(e.text));
    // 非空断言：整页只有中文时这个门禁也是空的
    expect(chinese.length, "离线页应当有若干中文句子可查").toBeGreaterThanOrEqual(4);
    for (const [i, el] of elements.entries()) {
      if (!/[\u4e00-\u9fff]/.test(el.text)) continue;
      if (/[A-Za-z]{4,}/.test(el.text)) continue; // 同句里就是双语（按钮/列表的写法）
      const next = elements[i + 1];
      expect(
        next && !/[\u4e00-\u9fff]/.test(next.text) && /[A-Za-z]{4,}/.test(next.text),
        `中文句「${el.text.slice(0, 18)}…」后面没有一句纯英文对应`,
      ).toBe(true);
    }
  });

  it("明确说明本地学习数据保留、联网能力受限（不承诺收益/离线可用）", () => {
    expect(OFFLINE_HTML).toContain("保存在本机");
    expect(OFFLINE_HTML).toContain("需要联网");
  });
});

describe("离线页恢复逻辑（R13.13）", () => {
  // 用字符串定位抽取，而不是正则过滤：正则抽 HTML 块一旦写漏（大小写、属性、结束标签里的
  // 空白），抽到空串就等于 6 条用例全成了空断言。这里直接断言抽到的内容非空。
  const openTagStart = OFFLINE_HTML.indexOf("<script");
  const scriptSource = (() => {
    const openEnd = OFFLINE_HTML.indexOf(">", openTagStart);
    const close = OFFLINE_HTML.indexOf("<" + "/script", openEnd);
    return openTagStart >= 0 && openEnd > 0 && close > openEnd
      ? OFFLINE_HTML.slice(openEnd + 1, close)
      : "";
  })();

  it("离线页只有一个内联脚本，抽取不为空（否则下面的沙箱用例都是空断言）", () => {
    expect(openTagStart).toBeGreaterThanOrEqual(0);
    expect(OFFLINE_HTML.indexOf("<script", openTagStart + 1)).toBe(-1);
    expect(scriptSource.length).toBeGreaterThan(100);
    expect(scriptSource).toContain("location.reload()");
  });

  interface Harness {
    statusText: () => string;
    fetchCalls: { url: string; init?: RequestInit }[];
    reloads: number;
    session: Map<string, string>;
    dispatch: (type: string) => void;
    clickRetry: () => void;
    runTimers: () => Promise<void>;
  }

  /** 在 vm 沙箱里跑离线页的真实脚本：探针成功之前不许 reload。 */
  async function loadScript(options: {
    onLine: boolean;
    probeOutcome?: ("ok" | "fail")[];
    budget?: number;
  }): Promise<Harness> {
    const outcomes = options.probeOutcome ?? ["ok"];
    const fetchCalls: { url: string; init?: RequestInit }[] = [];
    const timers: (() => void)[] = [];
    const onlineHandlers: (() => void)[] = [];
    let retryHandler: (() => void) | null = null;
    let reloads = 0;
    const status = { textContent: "" };
    const session = new Map<string, string>();
    if (options.budget !== undefined) {
      session.set("tb-offline-auto-reloads", JSON.stringify({ n: options.budget, t: Date.now() }));
    }

    const sandbox = {
      document: {
        getElementById: (id: string) =>
          id === "status"
            ? status
            : {
                addEventListener: (_type: string, cb: () => void) => {
                  retryHandler = cb;
                },
              },
      },
      window: {
        addEventListener: (type: string, cb: () => void) => {
          if (type === "online") onlineHandlers.push(cb);
        },
      },
      navigator: { onLine: options.onLine } as { onLine: boolean },
      location: {
        pathname: "/zh/path",
        reload: () => {
          reloads += 1;
        },
      },
      sessionStorage: {
        getItem: (key: string) => (session.has(key) ? session.get(key)! : null),
        setItem: (key: string, value: string) => session.set(key, value),
        removeItem: (key: string) => session.delete(key),
      },
      fetch: (url: string, init?: RequestInit) => {
        fetchCalls.push({ url, init });
        const outcome = outcomes[Math.min(fetchCalls.length - 1, outcomes.length - 1)];
        return outcome === "ok"
          ? Promise.resolve({ ok: true })
          : Promise.reject(new Error("network down"));
      },
      setTimeout: (cb: () => void) => {
        timers.push(cb);
        return timers.length;
      },
    };
    vm.runInNewContext(scriptSource, sandbox);
    // 让开局那一次探测的 promise 链走完（成功/失败都反映到 reloads / timers 上）
    await new Promise((resolve) => setImmediate(resolve));

    return {
      statusText: () => status.textContent,
      fetchCalls,
      get reloads() {
        return reloads;
      },
      session,
      dispatch: (type: string) => {
        // 真实浏览器里 online 事件必然伴随 navigator.onLine=true，沙箱照此办理
        if (type === "online") {
          sandbox.navigator.onLine = true;
          onlineHandlers.forEach((cb) => cb());
        }
      },
      clickRetry: () => retryHandler?.(),
      runTimers: async () => {
        const queued = timers.splice(0, timers.length);
        queued.forEach((cb) => cb());
        await new Promise((resolve) => setImmediate(resolve));
      },
    };
  }

  it("断网时不探测也不重载，只挂上 online 监听", async () => {
    const h = await loadScript({ onLine: false });
    expect(h.fetchCalls).toHaveLength(0);
    expect(h.reloads).toBe(0);
    h.dispatch("online");
    await new Promise((resolve) => setImmediate(resolve));
    expect(h.fetchCalls[0]?.url).toBe("/zh/path");
    expect(h.fetchCalls[0]?.init).toMatchObject({ method: "HEAD", cache: "no-store" });
  });

  it("online 之后先探到通才 reload，并把状态改成重新加载", async () => {
    const h = await loadScript({ onLine: false });
    h.dispatch("online");
    await new Promise((resolve) => setImmediate(resolve));
    expect(h.reloads).toBe(1);
    expect(h.statusText()).toContain("正在重新加载");
    expect(JSON.parse(h.session.get("tb-offline-auto-reloads") ?? "{}").n).toBe(1);
  });

  it("探针失败时退避重试，网络真通之前绝不重载", async () => {
    const h = await loadScript({ onLine: false, probeOutcome: ["fail", "fail", "ok"] });
    h.dispatch("online");
    await new Promise((resolve) => setImmediate(resolve));
    expect(h.reloads).toBe(0); // 第一次探测失败，只有一次待排队的退避
    await h.runTimers();
    expect(h.reloads).toBe(0); // 第二次仍失败
    await h.runTimers();
    expect(h.reloads).toBe(1); // 第三次通了才重载
  });

  it("reload 抢跑的那一份文档（开局已在线）自己会继续探测", async () => {
    // online 事件已经用掉、不会有第二次：这是过去把用户卡在「已联网的离线页」上的那条路径
    const h = await loadScript({ onLine: true });
    expect(h.fetchCalls).toHaveLength(1);
    expect(h.reloads).toBe(1);
  });

  it("短时间反复自动重载会收手，改为提示用户手动点按钮", async () => {
    const h = await loadScript({ onLine: true, budget: 3 });
    expect(h.reloads).toBe(0);
    expect(h.statusText()).toContain("点击上方按钮");
  });

  it("手动 Retry 清空自动重载预算并立刻重载", async () => {
    const h = await loadScript({ onLine: false, budget: 3 });
    h.clickRetry();
    expect(h.reloads).toBe(1);
    expect(h.session.has("tb-offline-auto-reloads")).toBe(false);
    expect(h.statusText()).toContain("正在重试");
  });
});

describe("离线缓存边界（R13.13 + R10.24）", () => {
  it("service worker 脚本禁止被 HTTP 缓存拖住", () => {
    expect(SERVICE_WORKER_CACHE_POLICY.source).toBe("/sw.js");
    expect(SERVICE_WORKER_CACHE_POLICY.headers[0]).toEqual({
      key: "Cache-Control",
      value: "no-cache",
    });
  });

  it("worker 只做导航兜底，不触碰内容产物缓存", () => {
    expect(SW_SOURCE).toContain('request.mode !== "navigate"');
    expect(SW_CODE).not.toContain("search-index.json");
    expect(SW_CODE).not.toContain("knowledge-assets");
    expect(SW_SOURCE).toContain("docs/caching.md");
  });
});
