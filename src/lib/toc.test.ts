import { describe, expect, it } from "vitest";
import { extractHeadings } from "./toc";

describe("extractHeadings", () => {
  it("提取 H2/H3，忽略 H1 和 H4+", () => {
    const md = `# H1 标题
## 第一段
### 子节
#### H4 不该出现
## 第二段`;
    const out = extractHeadings(md);
    expect(out.map((h) => h.text)).toEqual(["第一段", "子节", "第二段"]);
    expect(out.every((h) => h.depth === 2 || h.depth === 3)).toBe(true);
  });

  it("跳过代码块里的标题", () => {
    const md = `## 真标题
\`\`\`
## 代码块里的假标题
### 也是假的
\`\`\`
## 真标题二`;
    const out = extractHeadings(md);
    expect(out.map((h) => h.text)).toEqual(["真标题", "真标题二"]);
  });

  it("清理内联标记：链接、加粗、mark", () => {
    const md = `## [链接文字](/url) 继续
### **加粗** 和 <mark>高亮</mark>`;
    const out = extractHeadings(md);
    expect(out[0].text).toBe("链接文字 继续");
    expect(out[1].text).toBe("加粗 和 高亮");
  });

  it("重复标题生成不同 slug", () => {
    const md = `## 止损
## 止损`;
    const out = extractHeadings(md);
    expect(out[0].id).toBe("止损");
    expect(out[1].id).toBe("止损-1");
  });

  it("空内容返回空数组", () => {
    expect(extractHeadings("")).toEqual([]);
  });

  it("没有标题返回空数组", () => {
    expect(extractHeadings("纯文本内容\n没有标题")).toEqual([]);
  });

  it("尾部 # 号被清理", () => {
    const md = "## 标题 ##";
    expect(extractHeadings(md)[0].text).toBe("标题");
  });
});
