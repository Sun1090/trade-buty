import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_GUARDRAIL_PROBE_QUESTION,
  AI_MODEL_TIMEOUT_MS,
  AI_PROBE_QUESTION,
  buildChecks,
  isTransportError,
  latestReleaseVersion,
  PAGE_PATHS,
  RISK_WARNING_MARK,
  localBuildId,
  run,
  runChecks,
  servedBuildIsStale,
  streakSharePath,
} from "./prod-smoke.mjs";

const BASE = "https://prod.example";
const VERSION = "9.9.9";

/**
 * 那条 AI 断言印在报告与 `docs/ops.md` 表里的名字。这里写死字面量而不是从脚本导入：
 * 名字本身就是给读者看的说法（它承诺了「测的是哪一跳」），改它就该惊动测试和文档。
 */
const AI_CHECK = "POST /api/ai/chat 游客：护栏路径 200+X-Refused，模型路径要么答要么明确没测";

/** 假站点：路由 → 响应；未列出的路由返回 404，好让「少一条断言」不会被当成通过 */
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init, timeoutMs) => {
    const { pathname } = new URL(url);
    const key = init?.method === "POST" ? `POST ${pathname}` : pathname;
    calls.push({ key, url, init, timeoutMs });
    const raw = routes[key] ?? { status: 404, body: "not found" };
    // 路由可以是静态响应，也可以是 (init) => 响应——同一端点用不同载荷走不同分支时要用后者
    const route = typeof raw === "function" ? raw(init) : raw;
    if (route.throw) throw new Error(route.throw);
    // `AbortSignal.timeout()` 在 Node 里抛的是 name 为 `TimeoutError` 的 DOMException；
    // 冒烟要区分「我们没等够」和「上游回了 5xx」，所以夹具得能复刻这一种。
    if (route.timeout) {
      throw Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      });
    }
    return {
      status: route.status,
      headers: { get: (name) => route.headers?.[String(name).toLowerCase()] ?? null },
      text: async () => route.body,
    };
  };
  return { impl, calls };
}

const page = (extra = "") => `<html><body>${extra} ${RISK_WARNING_MARK} 风险提示</body></html>`;

/**
 * AI 端点的两条路径分开模拟：护栏探针（问题命中红线，200 + X-Refused，不碰上游）
 * 与模型问答（200 SSE）。真实部署里前者正常、后者 502，就是上游配置问题的指纹。
 */
function aiChatRoute({ refused = true, model = { status: 200, body: "data: ok\n\n" } } = {}) {
  return (init) => {
    const asked = JSON.parse(init.body).messages.at(-1).content;
    const isGuardrail = asked === AI_GUARDRAIL_PROBE_QUESTION;
    if (isGuardrail) {
      return refused
        ? { status: 200, body: "抱歉，我不能推荐具体的股票/基金/币种。", headers: { "x-refused": "stock-pick" } }
        : { status: 200, body: "回答本该被红线拦下" };
    }
    return model;
  };
}

function healthyRoutes() {
  const routes = {
    "/sitemap.xml": { status: 200, body: "<urlset>…</urlset>" },
    "/robots.txt": { status: 200, body: "User-agent: *\nSitemap: https://prod.example/sitemap.xml" },
    "/zh/changelog": { status: 200, body: page(`v${VERSION}`) },
    "/api/auth/session": { status: 200, body: '{"user":null}' },
    "POST /api/ai/chat": aiChatRoute(),
  };
  for (const p of [...PAGE_PATHS, streakSharePath()]) routes[p] = { status: 200, body: page() };
  return routes;
}

async function runAll(routes, options = {}) {
  const { impl, calls } = fakeFetch(routes);
  const results = await runChecks({
    baseUrl: BASE,
    checks: buildChecks({
      expectedVersion: "expectedVersion" in options ? options.expectedVersion : VERSION,
    }),
    fetchImpl: impl,
    retryDelayMs: 0,
  });
  return { results, calls };
}

async function failures(routes, options = {}) {
  const { results } = await runAll(routes, options);
  return results.filter((r) => !r.ok).map((r) => `${r.name} — ${r.detail}`);
}

/** 本轮没测成的那几条（⏭️），连同它们印出来的原因 */
async function skipped(routes, options = {}) {
  const { results } = await runAll(routes, options);
  return results.filter((r) => r.skipped).map((r) => `${r.name} — ${r.detail}`);
}

/** `docs/ops.md` 冒烟那一节的正文（含表格） */
function opsSmokeSection() {
  const doc = fs.readFileSync("docs/ops.md", "utf8");
  const start = doc.indexOf("\n## 生产冒烟");
  expect(start, "docs/ops.md 里找不到「## 生产冒烟」这一节——它换了地方就要同步这条用例，别让表没人看").toBeGreaterThan(-1);
  const end = doc.indexOf("\n## ", start + 1);
  return doc.slice(start, end === -1 ? doc.length : end);
}

/** 冒烟表的整行：断言名 / 为什么在清单上 / 出处（第三列，见 R16.237） */
function opsSmokeTableRows() {
  return opsSmokeSection()
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      return {
        name: (cells[0] ?? "").replace(/^`(.*)`$/, "$1"),
        reason: cells[1] ?? "",
        provenance: cells[2] ?? "",
      };
    });
}

/** 表里第一列（去掉反引号）——就是脚本打印出来的那个断言名 */
function opsSmokeTableNames() {
  return opsSmokeTableRows().map((r) => r.name);
}

describe("prod-smoke 断言清单", () => {
  it("健康站点：0 条失败", async () => {
    expect(await failures(healthyRoutes())).toEqual([]);
  });

  it("断言覆盖游客入口、红线、部署新鲜度与 AI 可用性", () => {
    const names = buildChecks({ expectedVersion: VERSION }).map((c) => c.name);
    expect(names.length).toBeGreaterThanOrEqual(9);
    expect(names.some((n) => n.includes("/api/auth/session"))).toBe(true);
    expect(names.some((n) => n.includes("/api/ai/chat"))).toBe(true);
    expect(names.some((n) => n.includes("/zh/changelog"))).toBe(true);
  });

  it("文档里写的断言条数 = buildChecks 真正产出的条数", () => {
    // 「跑 N 条只读断言」是读者判断这份冒烟覆盖多宽的唯一依据。探针加到第 11 条而
    // 文档还写着 10，读起来就比实际少防了一项——和 R16.30 那类「文档声称流水线没做的事」
    // 同一族，只是这里在描述列而不是命令列。
    const n = buildChecks({ expectedVersion: VERSION }).length;
    const claims = {
      "docs/ops.md": /跑 (\d+) 条只读断言/,
      "docs/release-checklist.md": /这 (\d+) 条断言/,
    };
    for (const [file, pattern] of Object.entries(claims)) {
      const found = pattern.exec(fs.readFileSync(file, "utf8"));
      expect(
        found,
        `${file} 里找不到「N 条断言」这句话——改了措辞就要同步这条用例，不许把数字藏起来`,
      ).toBeTruthy();
      expect(
        Number(found[1]),
        `${file} 写着 ${found[1]} 条，buildChecks 实际产出 ${n} 条`,
      ).toBe(n);
    }
  });

  it("docs/ops.md 那张表逐字印着每条断言的名字与顺序", () => {
    // 上一版表里写的是「`POST /api/ai/chat` 游客：护栏路径 200 且模型路径不 5xx | …；429 视为通过」，
    // 而脚本那一天的行为已经改成 429 → ⏭️ 没测成：名字与语义两处一起过期，读文档的人据此行事。
    // 表第一列现在就是 `check.name`，所以两边能一一对上——改名、加一条、删一条都会立刻红在这里。
    const names = buildChecks({ expectedVersion: VERSION }).map((c) => c.name);
    const rows = opsSmokeTableNames();
    expect(rows.length, `表只有 ${rows.length} 行，扫不到 10 行就是那一节被改坏了`).toBeGreaterThanOrEqual(names.length);
    expect(rows).toEqual(names);
  });

  it("docs/ops.md 讲了 ⏭️ 这个第三种结论", () => {
    // `runChecks` 现在会产出「既没通过也没失败」的结果；文档只写 ✅/❌ 两种的话，
    // 读者会把汇总里那句「本轮没测成」当成脚本坏了。
    expect(opsSmokeSection()).toContain("本轮没测成");
  });

  it("课文页丢风险提示 → 点名该页", async () => {
    const routes = healthyRoutes();
    routes["/zh/knowledge/getting-started/candlestick-basics"] = { status: 200, body: "<p>无风险块</p>" };
    expect(await failures(routes)).toEqual([
      "GET /zh/knowledge/getting-started/candlestick-basics → 200 且含风险提示 — HTML 里没有 ⚠️ 风险提示块",
    ]);
  });

  it("页面 500（游客判定回归）→ 失败而不是崩栈", async () => {
    const routes = healthyRoutes();
    routes["/en"] = { status: 500, body: "~~~" };
    expect(await failures(routes)).toEqual(["GET /en → 200 且含风险提示 — 状态 500"]);
  });

  it("session 返回登录用户或非 JSON → 两条都算失败", async () => {
    const withUser = { ...healthyRoutes(), "/api/auth/session": { status: 200, body: '{"user":{"id":"u"}}' } };
    expect((await failures(withUser))[0]).toContain("游客被判成非匿名");
    const brokenJson = { ...healthyRoutes(), "/api/auth/session": { status: 200, body: "oops" } };
    expect((await failures(brokenJson))[0]).toContain("响应不是 JSON");
  });

  it("只有模型路径 502（护栏正常）→ 报上游而不是「AI 不可用」", async () => {
    const upstreamDown = { ...healthyRoutes(), "POST /api/ai/chat": aiChatRoute({ model: { status: 502, body: "AI 服务暂时不可用" } }) };
    expect(await failures(upstreamDown)).toEqual([
      `${AI_CHECK} — 状态 502，而护栏路径正常 → 站内代码没问题，查上游：部署快照里的 AI_API_URL/AI_MODEL/AI_API_KEY 或出口网络`,
    ]);
  });

  it("两条路径都 500 → 报「函数没起来」，先于上游结论", async () => {
    const dead = { ...healthyRoutes(), "POST /api/ai/chat": { status: 500, body: "~~~" } };
    expect(await failures(dead)).toEqual([
      `${AI_CHECK} — 护栏路径 500（无 X-Refused 头）：函数没起来、部署落后或内容红线失效`,
    ]);
  });

  it("护栏不再回 X-Refused（红线失效）→ 单独报出", async () => {
    const noTag = { ...healthyRoutes(), "POST /api/ai/chat": aiChatRoute({ refused: false }) };
    expect(await failures(noTag)).toEqual([
      `${AI_CHECK} — 护栏路径 200（无 X-Refused 头）：函数没起来、部署落后或内容红线失效`,
    ]);
  });

  it("模型路径挂到超时 → 说「卡的是上游那一跳」，而不是「请求异常」", async () => {
    // 生产实测：上游不通时这一跳挂 68s 才回 502。旧写法只给全站那 20s，
    // 冒烟印出来的是 `请求异常：The operation was aborted due to timeout（重试 2 次后仍失败）`
    // ——把「我们没等够」当成结论，而这条路由其实是活的。
    const routes = {
      ...healthyRoutes(),
      "POST /api/ai/chat": aiChatRoute({ model: { timeout: true } }),
    };
    const { results, calls } = await runAll(routes);
    expect(results.filter((r) => !r.ok).map((r) => r.detail)).toEqual([
      `模型路径在 ${AI_MODEL_TIMEOUT_MS / 1000}s 内没返回，而护栏路径 200 正常 → 卡的是上游那一跳（查部署快照里的 AI_API_URL/AI_MODEL/AI_API_KEY 或出口网络）`,
    ]);
    // 超时是**断言结论**不是传输层抖动：一次定性。挂住的上游被连打三次既慢又白占访客配额。
    expect(calls.filter((c) => c.key === "POST /api/ai/chat")).toHaveLength(2);
  });

  it("模型路径单独等满长超时，护栏路径仍用全站超时", async () => {
    const { calls } = await runAll(healthyRoutes());
    const ai = calls.filter((c) => c.key === "POST /api/ai/chat");
    // calls 的顺序就是两次请求的顺序：①护栏 ②模型
    expect(ai.map((c) => c.timeoutMs)).toEqual([undefined, AI_MODEL_TIMEOUT_MS]);
  });

  it("护栏路径 429 → ⏭️ 没测成，不是通过", async () => {
    // 限流排在解析与护栏之前（`src/app/api/ai/chat/route.ts`），429 时红线根本没被走过。
    const routes = {
      ...healthyRoutes(),
      "POST /api/ai/chat": { status: 429, body: "too many", headers: { "retry-after": "1800" } },
    };
    expect(await failures(routes)).toEqual([]);
    expect(await skipped(routes)).toEqual([
      `${AI_CHECK} — 护栏路径 429（Retry-After 1800s）：限流排在护栏之前，本轮既没验证红线也没打到模型`,
    ]);
  });

  it("模型路径单独 429 → 护栏那条算验证过，模型那条仍是 ⏭️", async () => {
    const routes = {
      ...healthyRoutes(),
      "POST /api/ai/chat": aiChatRoute({ model: { status: 429, body: "too many" } }),
    };
    expect(await failures(routes)).toEqual([]);
    expect(await skipped(routes)).toEqual([
      `${AI_CHECK} — 模型路径 429：护栏那条已经验证（200+X-Refused），但这一轮没真的打到模型，「不 5xx」不算成立`,
    ]);
  });

  it("探针问题与真分类器对齐：护栏问题必被拦、问答问题不误伤", async () => {
    const { matchSensitiveRequest } = await import("../src/lib/ai/guardrail.ts");
    expect(matchSensitiveRequest(AI_GUARDRAIL_PROBE_QUESTION)).toBeTruthy();
    expect(matchSensitiveRequest(AI_PROBE_QUESTION)).toBeNull();
  });

  it("changelog 停在旧版本 → 报「生产构建落后于 main」", async () => {
    const routes = { ...healthyRoutes(), "/zh/changelog": { status: 200, body: page("9.9.8") } };
    expect(await failures(routes)).toEqual([
      "GET /zh/changelog → 含最新发布版本（部署跟上 main 的探针） — 页面里没有 9.9.9，生产构建落后于 main",
    ]);
  });

  it("读不到本地发布版本时不静默通过", async () => {
    expect(await failures(healthyRoutes(), { expectedVersion: null })).toEqual([
      "GET /zh/changelog → 含最新发布版本（部署跟上 main 的探针） — 读不到本地最新发布版本号，无法判断部署是否跟上",
    ]);
  });

  it("sitemap / robots / 分享落地页各自退化都能抓住", async () => {
    const noUrlset = await failures({ ...healthyRoutes(), "/sitemap.xml": { status: 200, body: "<html/>" } });
    expect(noUrlset[0]).toContain("<urlset>");
    const noSitemapLine = await failures({ ...healthyRoutes(), "/robots.txt": { status: 200, body: "User-agent: *" } });
    expect(noSitemapLine[0]).toContain("Sitemap");
    const shareNoRisk = { ...healthyRoutes(), [streakSharePath()]: { status: 200, body: "<p>裸页</p>" } };
    expect((await failures(shareNoRisk))[0]).toContain("落地页 HTML 里没有");
  });

  it("网络异常按失败记录，且不中断后续断言", async () => {
    const routes = { ...healthyRoutes(), "/zh": { throw: "socket hang up" } };
    const failed = await failures(routes);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toContain("请求异常：socket hang up");
  });
});

describe("prod-smoke 传输层重试", () => {
  /** 前 failuresBefore 次抛传输异常，之后成功；同时数一共试了几次 */
  function flakyCheck(failuresBefore, errorFactory = () => new TypeError("fetch failed")) {
    let calls = 0;
    return {
      name: "GET /flaky",
      async run() {
        calls += 1;
        if (calls <= failuresBefore) throw errorFactory();
        return null;
      },
      getCalls: () => calls,
    };
  }

  it("抖一下就重试到成功，并把「第几次才连上」写进结论", async () => {
    const check = flakyCheck(2);
    const results = await runChecks({ baseUrl: BASE, checks: [check], retryDelayMs: 0 });
    expect(results).toEqual([
      { name: "GET /flaky", ok: true, skipped: false, detail: "第 3 次尝试才连上（前 2 次传输失败）" },
    ]);
    expect(check.getCalls()).toBe(3);
  });

  it("一直连不上才判失败，并说明重试过", async () => {
    const check = flakyCheck(99);
    const results = await runChecks({ baseUrl: BASE, checks: [check], retryDelayMs: 0 });
    expect(results[0].ok).toBe(false);
    expect(results[0].detail).toBe("请求异常：fetch failed（重试 2 次后仍失败）");
    expect(check.getCalls()).toBe(3);
  });

  it("非传输层异常一次定性，不靠重试掩盖站内缺陷", async () => {
    const check = flakyCheck(99, () => new Error("解析断言状态时炸了"));
    const results = await runChecks({ baseUrl: BASE, checks: [check], retryDelayMs: 0 });
    expect(results[0].detail).toBe("请求异常：解析断言状态时炸了");
    expect(check.getCalls()).toBe(1);
  });

  it("分类器认得 undici 与超时，认不得普通错误", () => {
    expect(isTransportError(new TypeError("fetch failed"))).toBe(true);
    expect(isTransportError(Object.assign(new Error("signal timed out"), { name: "AbortError" }))).toBe(true);
    expect(isTransportError(new Error("socket hang up"))).toBe(true);
    expect(isTransportError(new Error("HTML 里没有风险块"))).toBe(false);
  });
});

describe("prod-smoke 分享载荷与版本读取", () => {
  it("分享载荷与站内编码器一致（防止两处格式漂移）", async () => {
    const { encodeStreak } = await import("../src/lib/share-decode.ts");
    const payload = { currentStreak: 7, longestStreak: 12, locale: "zh" };
    expect(streakSharePath(payload)).toBe(`/share/streak/${encodeStreak(payload)}`);
  });

  it("latestReleaseVersion 取按日期倒序的第一条", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "trade-buty-prod-smoke-"));
    const dir = path.join(root, "src", "data");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "release-notes.json"),
      JSON.stringify({ releases: [{ version: "1.2.3" }, { version: "1.2.2" }] }),
    );
    expect(latestReleaseVersion(root)).toBe("1.2.3");
    fs.writeFileSync(path.join(dir, "release-notes.json"), JSON.stringify({ releases: [] }));
    expect(latestReleaseVersion(root)).toBeNull();
    expect(latestReleaseVersion(path.join(root, "missing"))).toBeNull();
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("prod-smoke CLI", () => {
  function collector() {
    const out = [];
    const err = [];
    return { out, err, stdout: (s) => out.push(String(s)), stderr: (s) => err.push(String(s)) };
  }

  it("健康站点退出 0，逐条打印 ✅", async () => {
    const io = collector();
    const { impl, calls } = fakeFetch(healthyRoutes());
    const root = writeReleaseRoot(VERSION);
    expect(await run({ root, env: { SMOKE_BASE_URL: BASE }, stdout: io.stdout, stderr: io.stderr, fetchImpl: impl })).toBe(0);
    expect(io.out.filter((l) => l.startsWith("  ✅"))).toHaveLength(buildChecks({ expectedVersion: VERSION }).length);
    // 每条断言至少发一次请求（AI 条目两次：护栏探针 + 模型问答），否则「通过」可能只是没测
    expect(calls).toHaveLength(buildChecks({ expectedVersion: VERSION }).length + 1);
    expect(calls.filter((c) => c.key === "POST /api/ai/chat")).toHaveLength(2);
  });

  it("有失败时退出 1 并点名条目", async () => {    const io = collector();
    const routes = { ...healthyRoutes(), "/zh": { status: 500, body: "" } };
    const { impl } = fakeFetch(routes);
    const root = writeReleaseRoot(VERSION);
    const code = await run({ root, env: { SMOKE_BASE_URL: BASE }, stdout: io.stdout, stderr: io.stderr, fetchImpl: impl });
    expect(code).toBe(1);
    expect(io.out.some((l) => l.startsWith("  ❌"))).toBe(true);
    expect(io.err.join("\n")).toContain("生产冒烟失败 1/");
  });

  it("有 ⏭️ 时退出 0，但汇总不许只说「全部符合预期」", async () => {
    const io = collector();
    const routes = {
      ...healthyRoutes(),
      "POST /api/ai/chat": { status: 429, body: "too many", headers: { "retry-after": "60" } },
    };
    const { impl } = fakeFetch(routes);
    const code = await run({
      root: writeReleaseRoot(VERSION),
      env: { SMOKE_BASE_URL: BASE },
      stdout: io.stdout,
      stderr: io.stderr,
      fetchImpl: impl,
    });
    const report = io.out.join("\n");
    expect(code).toBe(0);
    expect(report).toContain("  ⏭️ POST /api/ai/chat");
    // 这一条就是这次改动要防的：只报「10 条全部符合预期」等于把没测成的混进绿里
    expect(report).not.toContain("生产冒烟通过");
    expect(report).toContain("9 条符合预期 · 1 条本轮没测成");
  });

  it("SMOKE_BASE_URL 非法时直接退出 1，不发请求", async () => {
    const io = collector();
    const { impl, calls } = fakeFetch(healthyRoutes());
    expect(await run({ root: process.cwd(), env: { SMOKE_BASE_URL: "ftp://x" }, stdout: io.stdout, stderr: io.stderr, fetchImpl: impl })).toBe(1);
    expect(calls).toHaveLength(0);
    expect(io.err.join("\n")).toContain("SMOKE_BASE_URL 不可用");
  });

  it("默认打生产域名", async () => {
    const io = collector();
    const { impl, calls } = fakeFetch({});
    expect(await run({ root: process.cwd(), env: {}, stdout: io.stdout, stderr: io.stderr, fetchImpl: impl })).toBe(1);
    // 精确断言而不是前缀匹配：`startsWith("https://trade-buty.vercel.app")` 对
    // `https://trade-buty.vercel.app.evil.example` 同样成立（CodeQL 判 high 的就是这个）
    expect(calls[0].url).toBe("https://trade-buty.vercel.app/zh");
  });
});

function writeReleaseRoot(version) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trade-buty-prod-smoke-run-"));
  const dir = path.join(root, "src", "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "release-notes.json"), JSON.stringify({ releases: [{ version }] }));
  return root;
}

describe("prod-smoke 本地构建身份", () => {
  function collector() {
    const out = [];
    const err = [];
    return { out, err, stdout: (line) => out.push(String(line)), stderr: (line) => err.push(String(line)) };
  }

  function rootWithBuild(buildId) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "trade-buty-prod-smoke-build-"));
    const data = path.join(root, "src", "data");
    fs.mkdirSync(data, { recursive: true });
    fs.writeFileSync(path.join(data, "release-notes.json"), JSON.stringify({ releases: [{ version: VERSION }] }));
    if (buildId) {
      fs.mkdirSync(path.join(root, ".next"), { recursive: true });
      fs.writeFileSync(path.join(root, ".next", "BUILD_ID"), `${buildId}\n`);
    }
    return root;
  }

  /** 让每个页面的响应体都带上构建标识，模拟「服务确实跑的是这份构建」 */
  function routesWithBuild(buildId) {
    const stamped = {};
    for (const [key, route] of Object.entries(healthyRoutes())) {
      // AI 那条路由是按载荷分支的函数，改写它的 body 会把护栏头一起弄没
      if (typeof route === "function") {
        stamped[key] = route;
        continue;
      }
      let body = `${route.body}${key === "/zh" ? buildId : ""}`;
      // robots 那条断言比的是「sitemap 指向本域名」，夹具里的生产域名要换成被量的地址
      if (key === "/robots.txt") body = "User-agent: *\nSitemap: http://localhost:3111/sitemap.xml";
      stamped[key] = { ...route, body };
    }
    return stamped;
  }

  it("判据本身：没有标识可比时不判过期", () => {
    expect(servedBuildIsStale({ html: "<html>x</html>", buildId: "abc" })).toBe(true);
    expect(servedBuildIsStale({ html: "<html>abc</html>", buildId: "abc" })).toBe(false);
    expect(servedBuildIsStale({ html: "", buildId: "abc" })).toBe(false);
    expect(servedBuildIsStale({ html: "<html></html>", buildId: null })).toBe(false);
    expect(localBuildId(rootWithBuild(null))).toBeNull();
    expect(localBuildId(rootWithBuild(" abc \n"))).toBe("abc");
  });

  it("localhost 目标 + 驻留的旧构建 → 退出 1，且十条断言一条都不跑", async () => {
    const io = collector();
    const { impl, calls } = fakeFetch(healthyRoutes());
    const code = await run({
      root: rootWithBuild("stale-build-id"),
      env: { SMOKE_BASE_URL: "http://localhost:3111" },
      stdout: io.stdout,
      stderr: io.stderr,
      fetchImpl: impl,
    });
    expect(code).toBe(1);
    expect(io.err.join("\n")).toContain("不含本次构建标识");
    expect(io.out.join("\n")).not.toContain("条断言");
    expect(calls.map((c) => c.key)).toEqual(["/zh"]);
  });

  it("localhost 目标 + 构建标识对得上 → 照常跑完全部断言", async () => {
    const io = collector();
    const { impl, calls } = fakeFetch(routesWithBuild("fresh-build-id"));
    const code = await run({
      root: rootWithBuild("fresh-build-id"),
      env: { SMOKE_BASE_URL: "http://localhost:3111" },
      stdout: io.stdout,
      stderr: io.stderr,
      fetchImpl: impl,
    });
    expect(code).toBe(0);
    const total = buildChecks({ expectedVersion: VERSION }).length;
    expect(calls).toHaveLength(total + 2); // 一次身份探针 + 每条断言（AI 占两条）
  });

  it("打生产域名时不做本地身份核对，也不读 .next", async () => {
    const io = collector();
    const { impl, calls } = fakeFetch(healthyRoutes());
    const code = await run({
      root: rootWithBuild("some-build-id"),
      env: { SMOKE_BASE_URL: BASE },
      stdout: io.stdout,
      stderr: io.stderr,
      fetchImpl: impl,
    });
    expect(code).toBe(0);
    expect(calls[0].url).toBe(`${BASE}/zh`);
    expect(io.err.join("\n")).not.toContain("构建标识");
  });
});

/**
 * R16.237：冒烟表那句「每一条都对应历史上真出过问题的入口」是不实的——`/zh`、`/en`、课文页
 * 这三个面从来没过事故，而课文页那一行甚至把 API 那一侧的 500 算到了自己头上（仓库在补兜底的
 * 那次明写「线上暂无暴露」）。所以表的第三列现在必须逐条交代来历：真出过事的给得出落点，
 * 没出过的直写「无事故记录」。下面三条就是把这一列钉住：落点查不到即红、声称事故却给不出落点
 * 即红、给不出落点的那一行在叙述里又被说成出过事即红。
 */
describe("冒烟表逐条交代自己的来历", () => {
  const roadmap = fs.readFileSync("docs/roadmap.md", "utf8");
  const progress = fs.readFileSync("docs/progress.md", "utf8");
  const NO_RECORD = "无事故记录";
  /** 行内那些「出过事」口吻的说法——只有第三列给得出落点时才许出现在正文里 */
  const INCIDENT_TONE = /历史上|曾经|出过问题|出过事故|漏掉过/;

  /** `docs/release-checklist.md` 冒烟那节里紧跟总起句的那段 bullet（含各自的续行） */
  function checklistBullets() {
    const lines = fs.readFileSync("docs/release-checklist.md", "utf8").split("\n");
    const start = lines.findIndex((l) => /不是每一条\s*都出过事故/.test(l));
    expect(start, "release-checklist 的冒烟总起句找不到了——那一节换了写法就要同步这条判据").toBeGreaterThan(-1);
    // 总起句自己占好几行，所以要从它之后的第一条 bullet 起步，而不是从下一行起步。
    const from = lines.findIndex((l, i) => i > start && l.startsWith("- "));
    expect(from, "总起句后面那段 bullet 不见了").toBeGreaterThan(-1);
    const out = [];
    for (const line of lines.slice(from)) {
      if (line.startsWith("- ") || (out.length > 0 && line.startsWith("  "))) out.push(line);
      else if (out.length > 0 && line.trim() === "") break;
    }
    // 数 bullet 条数而不是行数：这里每条 bullet 长短不一（有的带续行），按行数出来的
    // 「有没有扫到东西」不作数。地板是 4 而不是当前的 5——这一段本来就是「摘几条」，
    // 少一条不是假话，整段没了才是。
    const bullets = out.filter((l) => l.startsWith("- ")).length;
    expect(bullets, "那段 bullet 扫不出东西来").toBeGreaterThanOrEqual(4);
    return out.join("\n");
  }

  /** 一处出处文本里的所有落点，逐个回仓库查；返回查不到的那些 */
  function unresolved(text) {
    const bad = [];
    for (const ref of new Set(text.match(/R\d+\.\d+/g) ?? [])) {
      if (!roadmap.includes(ref)) bad.push(`${ref} 在 docs/roadmap.md 里查不到这一条`);
    }
    for (const ref of new Set(text.match(/#\d+/g) ?? [])) {
      if (!progress.includes(ref)) bad.push(`${ref} 在 docs/progress.md 里查不到这次回归`);
    }
    for (const ref of new Set(text.match(/\b\d+\.\d+\.\d+\b/g) ?? [])) {
      if (!progress.includes(ref)) bad.push(`${ref} 这次发布在 docs/progress.md 里查不到`);
    }
    for (const ref of new Set(text.match(/docs\/[\w./-]+\.md/g) ?? [])) {
      if (!fs.existsSync(ref)) bad.push(`${ref} 这个文件不存在`);
    }
    return bad;
  }

  /** 出处里那一类落点的个数（用来区分「给了落点」和「只写了句好话」） */
  const citationCount = (text) =>
    (text.match(/R\d+\.\d+|#\d+|\b\d+\.\d+\.\d+\b|docs\/[\w./-]+\.md/g) ?? []).length;

  const rows = opsSmokeTableRows();

  it("每一行的第三列要么给得出落点，要么直写「无事故记录」", () => {
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) {
      expect(row.provenance, `「${row.name}」这一行没有第三列——来历不许空着`).not.toBe("");
      if (row.provenance.startsWith(NO_RECORD)) continue;
      expect(
        citationCount(row.provenance),
        `「${row.name}」的出处既没写「${NO_RECORD}」也给不出任何落点（PR 编号 / R 编号 / 版本号 / 仓库文档路径）`,
      ).toBeGreaterThan(0);
    }
  });

  it("写出来的落点逐个回仓库查得到（不许凭印象引一次事故）", () => {
    const complaints = rows.flatMap((row) =>
      unresolved(row.provenance).map((why) => `「${row.name}」：${why}`),
    );
    expect(complaints).toEqual([]);
  });

  it("标了「无事故记录」的行，正文与两份文档都不许再把它说成出过事", () => {
    const noRecord = rows.filter((r) => r.provenance.startsWith(NO_RECORD));
    expect(noRecord.length, "整张表都声称出过事故——那这一列就没有意义了").toBeGreaterThan(0);
    for (const row of noRecord) {
      expect(
        INCIDENT_TONE.test(row.reason),
        `「${row.name}」第三列写着「${NO_RECORD}」，第二列却用「出过事」的口吻描述它`,
      ).toBe(false);
    }
    // 总起句同理：只要还有一行给不出事故，「每一条都对应真出过问题的入口」就是假话。
    // 前面带「也不是」的那一句是本轮改成的真话，不算谎报。
    for (const file of ["docs/ops.md", "docs/release-checklist.md"]) {
      const doc = fs.readFileSync(file, "utf8");
      expect(
        doc,
        `${file} 又声称每一条都对应真出过问题的入口，可表里有 ${noRecord.length} 行写着「${NO_RECORD}」`,
      ).not.toMatch(/(?<!也不是)每一条[^。]{0,30}(真出过问题|出过事故)/);
      expect(doc, `${file} 不再交代「不是每一条都出过事故」这件事了`).toMatch(/不是每一条\s*都出过事故/);
    }
  });

  it("release-checklist 摘的那几条，落点也逐个查得到", () => {
    // 那张表有判据了，清单里那几条 bullet 还是手抄的——而手抄的地方正是本轮之前发明故的
    // 那一处（第二十四轮我在 ops.md 凭印象写过一次「内容空过一次」）。这里不比对措辞，
    // 只要求 bullet 里出现的每一个落点都真在仓库里。
    const block = checklistBullets();
    const found = block.match(/R\d+\.\d+|PR #\d+|\b\d+\.\d+\.\d+\b|docs\/[\w./-]+\.md/g) ?? [];
    expect(found.length, "release-checklist 冒烟那节摘的 bullet 里一个落点都没有了——引用不许只写成叙述").toBeGreaterThanOrEqual(
      2,
    );
    expect(unresolved(block)).toEqual([]);
  });
});
