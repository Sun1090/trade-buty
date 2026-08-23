import { describe, it, expect } from "vitest";
import { readFirstParagraph, extractH1, titleOrder } from "./md-utils";

describe("readFirstParagraph", () => {
  it("跳过标题取首段", () => {
    const md = "# 标题\n## 子标题\n这是正文第一段。";
    expect(readFirstParagraph(md)).toBe("这是正文第一段。");
  });

  it("跳过 frontmatter 分隔线 ---", () => {
    const md = "---\n---\n正文内容";
    expect(readFirstParagraph(md)).toBe("正文内容");
  });

  it("去掉引用前缀 >", () => {
    expect(readFirstParagraph("> 这是引用\n正文")).toBe("这是引用");
  });

  it("去掉粗体标记", () => {
    expect(readFirstParagraph("**重点**内容")).toBe("重点内容");
  });

  it("截断到 120 字符", () => {
    const long = "a".repeat(200);
    expect(readFirstParagraph(long).length).toBe(120);
  });

  it("空内容返回空字符串", () => {
    expect(readFirstParagraph("")).toBe("");
  });
});

describe("extractH1", () => {
  it("提取第一个 H1", () => {
    expect(extractH1("# 入门基础\n## 子标题")).toBe("入门基础");
  });

  it("H1 带空格", () => {
    expect(extractH1("# 01 · 入门\n正文")).toBe("01 · 入门");
  });

  it("无 H1 返回空", () => {
    expect(extractH1("## 只有 H2\n正文")).toBe("");
  });

  it("只取第一个 H1", () => {
    expect(extractH1("# 第一\n# 第二")).toBe("第一");
  });
});

describe("titleOrder", () => {
  it("数字开头返回数字", () => {
    expect(titleOrder("01 · 入门")).toBe(1);
    expect(titleOrder("10 测试")).toBe(10);
  });

  it("无数字返回 999", () => {
    expect(titleOrder("入门基础")).toBe(999);
  });

  it("非数字开头返回 999", () => {
    expect(titleOrder("入门 01")).toBe(999);
  });
});
