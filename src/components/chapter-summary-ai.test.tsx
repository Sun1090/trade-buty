// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

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

const dict = { title: "AI 章节导读", generate: "生成导读", generating: "生成中…", error: "生成失败" };

function setup(ok = true, body: unknown = { summary: "本章讲市场结构与参与者。" }) {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as Response);
}

describe("ChapterSummaryAi（R3.5/R3.6/R3.9/R3.11）", () => {
  it("生成成功并写入 7 天 TTL 缓存", async () => {
    const fetchMock = setup();
    vi.stubGlobal("fetch", fetchMock);
    render(<ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />);
    fireEvent.click(screen.getByText(dict.generate));
    await screen.findByText("本章讲市场结构与参与者。");
    const cached = JSON.parse(store.get("tb-summary-v2-zh-spot")!);
    expect(cached.text).toContain("市场结构");
    expect(cached.at).toBeLessThanOrEqual(Date.now());
  });

  it("缓存 7 天内命中时直接展示，不调 API", () => {
    store.set("tb-summary-v2-zh-spot", JSON.stringify({ text: "缓存导读", at: Date.now() - 6 * 86400_000 }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />);
    expect(screen.getByText("缓存导读")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("缓存超过 7 天过期，重新出现生成按钮", () => {
    store.set("tb-summary-v2-zh-spot", JSON.stringify({ text: "旧导读", at: Date.now() - 8 * 86400_000 }));
    render(<ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />);
    expect(screen.queryByText("旧导读")).not.toBeInTheDocument();
    expect(screen.getByText(dict.generate)).toBeInTheDocument();
  });

  it("失败降级：整个入口隐藏，不展示错误文案（R3.6）", async () => {
    vi.stubGlobal("fetch", setup(false));
    const { container } = render(<ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />);
    fireEvent.click(screen.getByText(dict.generate));
    await waitFor(() => expect(container.querySelector("section, div")).toBeNull());
    expect(container.textContent).not.toContain(dict.error);
  });

  it("aiEnabled=false 或总开关关闭时不渲染（R3.9/3.10）", () => {
    const { container: c1 } = render(
      <ChapterSummaryAi chapter="spot" title="现货" locale="zh" aiEnabled={false} dict={dict} />
    );
    expect(c1.textContent).toBe("");
    vi.stubGlobal("fetch", setup());
    const { container: c2 } = render(
      <ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />
    );
    // NEXT_PUBLIC_AI_ENABLED 未设置时默认开启，c2 应正常渲染
    expect(c2.textContent).toContain(dict.title);
  });

  it("点击生成触发埋点（R3.11）", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("fetch", setup());
    render(<ChapterSummaryAi chapter="spot" title="现货" locale="zh" dict={dict} />);
    fireEvent.click(screen.getByText(dict.generate));
    await screen.findByText("本章讲市场结构与参与者。");
    expect(spy).toHaveBeenCalledWith("[ai-track]", "chapter-summary", expect.anything());
    spy.mockRestore();
  });
});

describe("analytics.trackAiClick", () => {
  it("输出 [ai-track] 前缀且永不抛错", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    trackAiClick("lesson-ask-ai", { chapter: "spot" });
    expect(spy).toHaveBeenCalledWith("[ai-track]", "lesson-ask-ai", { chapter: "spot" });
    spy.mockRestore();
  });
});
