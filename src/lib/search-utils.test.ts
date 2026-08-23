import { describe, it, expect } from "vitest";
import { score, escapeHtml, highlight, snippetHtml, type SearchEntry } from "./search-utils";

const mkEntry = (o: Partial<SearchEntry>): SearchEntry => ({
  url: "/", title: "", chapter: "", text: "", ...o,
});

describe("score", () => {
  it("标题命中加分最高", () => {
    const e = mkEntry({ title: "止损是什么", chapter: "a", text: "b" });
    expect(score(e, "止损")).toBe(100);
  });

  it("篇章命中加 30", () => {
    const e = mkEntry({ title: "x", chapter: "getting-started", text: "" });
    expect(score(e, "getting")).toBe(30);
  });

  it("正文多次命中累加（封顶 10 次）", () => {
    const e = mkEntry({ title: "x", chapter: "", text: "ma ma ma ma ma ma ma ma ma ma ma ma" });
    // 12 次命中，封顶 10 × 2 = 20
    expect(score(e, "ma")).toBe(20);
  });

  it("不命中返回 0", () => {
    const e = mkEntry({ title: "abc", chapter: "def", text: "ghi" });
    expect(score(e, "xyz")).toBe(0);
  });
});

describe("escapeHtml", () => {
  it("转义 < > &", () => {
    expect(escapeHtml("a<b>&c")).toBe("a&lt;b&gt;&amp;c");
  });

  it("无特殊字符不变", () => {
    expect(escapeHtml("plain text")).toBe("plain text");
  });
});

describe("highlight", () => {
  it("无 query 返回转义文本", () => {
    expect(highlight("a<b>", "")).toBe("a&lt;b&gt;");
  });

  it("包裹 mark 标签", () => {
    expect(highlight("止损重要", "止损")).toBe("<mark>止损</mark>重要");
  });

  it("大小写不敏感", () => {
    expect(highlight("Stop Loss", "stop")).toBe("<mark>Stop</mark> Loss");
  });

  it("转义后再高亮（不注入原始 HTML）", () => {
    const out = highlight("<script>x</script>", "script");
    expect(out).not.toContain("<script>"); // 原始标签未注入
    expect(out).toContain("&lt;"); // 已转义
    expect(out).toContain("<mark>");
  });

  it("特殊正则字符不报错", () => {
    expect(() => highlight("a(b)c", "(b)")).not.toThrow();
  });
});

describe("snippetHtml", () => {
  it("无命中返回前 80 字符", () => {
    expect(snippetHtml("短文本", "xyz")).toBe("短文本");
  });

  it("命中返回上下文片段", () => {
    const text = "前文".repeat(20) + "止损" + "后文".repeat(20);
    const out = snippetHtml(text, "止损");
    expect(out).toContain("止损");
    expect(out).toContain("<mark>");
    expect(out.startsWith("…")).toBe(true);
  });

  it("命中在开头不加前省略号", () => {
    const out = snippetHtml("止损在后文", "止损");
    expect(out.startsWith("…")).toBe(false);
  });
});
