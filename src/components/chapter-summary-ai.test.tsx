// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";

// localStorage mock（同 daily-goal.test.ts 惯例）
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
};
vi.stubGlobal("localStorage", localStorageMock);

const { ChapterSummaryAi } = await import("./chapter-summary-ai");
const { trackAiClick } = await import("@/lib/analytics");

beforeEach(() => {
  vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => {
  cleanup();
  store.clear();
  vi.unstubAllGlobals();
});

const dict = {
  title: "AI 章节导读",
  generate: "生成导读",
  generating: "生成中…",
  error: "生成失败",
};

function setup(
  ok = true,
  body: unknown = { summary: "本章讲市场结构与参与者。" },
) {
  return vi.fn(
    async () =>
      ({
        ok,
        status: ok ? 200 : 500,
        json: async () => body,
      }) as unknown as Response,
  );
}

describe("ChapterSummaryAi（R3.5/R3.6/R3.9/R3.11）", () => {
  it("生成成功并写入 7 天 TTL 缓存", async () => {
    const fetchMock = setup();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />,
    );
    fireEvent.click(screen.getByText(dict.generate));
    await screen.findByText("本章讲市场结构与参与者。");
    const cached = JSON.parse(store.get("tb-summary-v2-zh-spot")!);
    expect(cached.text).toContain("市场结构");
    // 时间戳不得来自未来。读数在断言之外取，断言里只比变量——
    // 时钟卫生巡检（R14.6）要抓的就是「expect 里直接读墙钟」这种写法。
    const readAt = Date.now();
    expect(cached.at).toBeLessThanOrEqual(readAt);
  });

  it("缓存 7 天内命中时直接展示，不调 API", () => {
    store.set(
      "tb-summary-v2-zh-spot",
      JSON.stringify({ text: "缓存导读", at: Date.now() - 6 * 86400_000 }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />,
    );
    expect(screen.getByText("缓存导读")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("缓存超过 7 天过期，重新出现生成按钮", () => {
    store.set(
      "tb-summary-v2-zh-spot",
      JSON.stringify({ text: "旧导读", at: Date.now() - 8 * 86400_000 }),
    );
    render(
      <ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />,
    );
    expect(screen.queryByText("旧导读")).not.toBeInTheDocument();
    expect(screen.getByText(dict.generate)).toBeInTheDocument();
  });

  it("损坏的缓存快照回落到初始空态，不展示坏数据", () => {
    store.set("tb-summary-v2-zh-spot", "{not-json");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />,
    );

    expect(screen.queryByText("{not-json")).not.toBeInTheDocument();
    expect(screen.getByText(dict.generate)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("接口未返回 summary 时回落展示章节标题且不写缓存", async () => {
    vi.stubGlobal("fetch", setup(true, {}));
    render(
      <ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />,
    );

    fireEvent.click(screen.getByText(dict.generate));
    await screen.findByText("现货");
    expect(store.get("tb-summary-v2-zh-spot")).toBeUndefined();
  });

  it("失败不再卸掉整张卡片：说清失败，按钮也还在（R16.77 改掉 R3.6 的整卡隐藏）", async () => {
    const fetchMock = setup(false);
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />,
    );
    fireEvent.click(screen.getByText(dict.generate));

    expect(await screen.findByText(dict.error)).toBeInTheDocument();
    // 「请重试」不是空话：同一个按钮还在，点它真的再发一次
    fireEvent.click(screen.getByText(dict.generate));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("本章讲市场结构与参与者。")).toBeNull();
  });

  it("aiEnabled=false 或总开关关闭时不渲染（R3.9/3.10）", () => {
    const { container: c1 } = render(
      <ChapterSummaryAi
        chapter="spot"
        title="现货"
        locale="zh"
        aiEnabled={false}
        dict={dict}
      />,
    );
    expect(c1.textContent).toBe("");
    vi.stubGlobal("fetch", setup());
    const { container: c2 } = render(
      <ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />,
    );
    // NEXT_PUBLIC_AI_ENABLED 未设置时默认开启，c2 应正常渲染
    expect(c2.textContent).toContain(dict.title);
  });

  it("点击生成触发埋点（R3.11）", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("fetch", setup());
    render(
      <ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />,
    );
    fireEvent.click(screen.getByText(dict.generate));
    await screen.findByText("本章讲市场结构与参与者。");
    expect(spy).toHaveBeenCalledWith(
      "[ai-track]",
      "chapter-summary",
      expect.anything(),
    );
    spy.mockRestore();
  });
});

describe("analytics.trackAiClick", () => {
  it("输出 [ai-track] 前缀且永不抛错", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    trackAiClick("lesson-ask-ai", { chapter: "spot" });
    expect(spy).toHaveBeenCalledWith("[ai-track]", "lesson-ask-ai", {
      chapter: "spot",
    });
    spy.mockRestore();
  });
});

/**
 * R16.199：那颗卡片旁边的注释还停在 R3.6 的口径上——「失败降级——隐藏整个入口，不展示
 * 错误」。这件事在 R16.77 就改过了（行为用例的名字里写着），只有注释没跟着改：读代码的
 * 人照着它以为失败会把入口卸掉，而 55 行之下正好渲染着一条 `role="status"` 的错误句，
 * 同文件另一处注释还专门解释了为什么不再卸卡。注释与它下面那行代码打架时，红的是注释。
 */
describe("失败降级的注释说的是现在这套（R16.199）", () => {
  const STALE_HIDE = /隐藏整个入口|不展示错误/;

  it("源码里不许留着「失败就把入口藏掉」的说法", () => {
    const src = readFileSync(path.join(process.cwd(), "src/components/chapter-summary-ai.tsx"), "utf8");
    expect(src, "失败不再卸卡是 R16.77 定下的口径，注释留着旧的那句就是在指一条不存在的路").not.toMatch(STALE_HIDE);
    // 而且它真的把错误说出来：`failed` 渲染成一条 role="status"
    expect(src).toMatch(/failed && !summary && \([\s\S]{0,200}role="status"/);
  });

  it("正向对照——旧那行注释必须被同一个判据报出来", () => {
    expect("  // R3.6：失败降级——隐藏整个入口，不展示错误").toMatch(STALE_HIDE);
  });
});
