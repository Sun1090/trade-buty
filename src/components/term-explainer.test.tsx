// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { TermExplainer, shouldExplain } = await import("./term-explainer");

afterEach(cleanup);

const dict = {
  hint: "AI 解释这个术语",
  loading: "查阅知识库中…",
  error: "解释暂时不可用",
  disclaimer: "⚠️ 仅供学习",
};

/** 模拟一次选区：anchorNode 指向 article 内节点 */
function fakeSelection(text: string, insideArticle = true) {
  vi.spyOn(document, "getSelection").mockReturnValue({
    isCollapsed: false,
    toString: () => text,
    anchorNode: { parentElement: { closest: () => (insideArticle ? {} : null) } },
    getRangeAt: () => ({
      getBoundingClientRect: () => ({ bottom: 100, left: 100, width: 50 }),
    }),
  } as unknown as Selection);
}

function setupChat(ok = true, text = "止损是限制单笔亏损的订单。") {
  return vi.fn(async () =>
    ok
      ? ({ ok: true, status: 200, text: async () => text } as unknown as Response)
      : ({ ok: false, status: 500, json: async () => ({}) } as unknown as Response),
  );
}

describe("shouldExplain", () => {
  it("长度 2–30 且在文章内通过", () => {
    const inside = (n: Node) => true;
    expect(shouldExplain("止损", {} as Node, inside)).toBe("止损");
    expect(shouldExplain("a".repeat(30), {} as Node, inside)).toHaveLength(30);
  });
  it("过短/过长/不在文章内/空选区拒绝", () => {
    const inside = (n: Node) => true;
    expect(shouldExplain("止", {} as Node, inside)).toBeNull();
    expect(shouldExplain("a".repeat(31), {} as Node, inside)).toBeNull();
    expect(shouldExplain("止损", null, inside)).toBeNull();
    expect(shouldExplain("止损", {} as Node, () => false)).toBeNull();
  });
});

describe("TermExplainer（R3.3）", () => {
  it("选中术语后显示浮层，点击解释并展示定义", async () => {
    const fetchMock = setupChat();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <article>
        <p>止损是最基础的风险控制工具。</p>
        <TermExplainer locale="zh" chapterSlug="spot" dict={dict} />
      </article>,
    );
    fakeSelection("止损");
    fireEvent.mouseUp(document.body);

    fireEvent.click(await screen.findByText(dict.hint));
    expect(await screen.findByText("止损是限制单笔亏损的订单。")).toBeInTheDocument();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("/api/ai/chat");
    expect(JSON.parse(call[1].body as string).contextChapter).toBe("spot");
  });

  it("解释失败展示错误文案（浮层保留，不崩页）", async () => {
    vi.stubGlobal("fetch", setupChat(false));
    render(
      <article>
        <p>止损。</p>
        <TermExplainer locale="zh" chapterSlug="spot" dict={dict} />
      </article>,
    );
    fakeSelection("止损");
    fireEvent.mouseUp(document.body);
    fireEvent.click(await screen.findByText(dict.hint));
    await waitFor(() => expect(screen.getByText(dict.error)).toBeInTheDocument());
  });

  it("aiEnabled=false 时不响应选区（R3.9）", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <article>
        <p>止损。</p>
        <TermExplainer locale="zh" chapterSlug="spot" aiEnabled={false} dict={dict} />
      </article>,
    );
    fakeSelection("止损");
    fireEvent.mouseUp(document.body);
    expect(screen.queryByText(dict.hint)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
