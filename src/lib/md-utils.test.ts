import { describe, it, expect } from "vitest";
import { plainText, readFirstParagraph, extractH1, titleOrder } from "./md-utils";

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

describe("plainText（R16.55：导语与摘要里的 markdown 语法不该原样上屏）", () => {
  it("内联链接只留链接文字", () => {
    expect(plainText("后者请看 [15-量化实战篇](../quant-practice/) 的清单")).toBe(
      "后者请看 15-量化实战篇 的清单",
    );
  });

  it("引用式链接、尖括号裸链与行内 HTML 标签一起收掉", () => {
    expect(
      plainText("见 [下一章][ref]，源页 <https://example.com>，换行标记 <br> 也不该留下"),
    ).toBe("见 下一章，源页 https://example.com，换行标记 也不该留下");
  });

  it("反引号只删记号：`code` 里的普通文字保留", () => {
    expect(plainText("参数 `risk_pct` 要留得住")).toBe("参数 risk_pct 要留得住");
  });

  it("没闭合的标签留不下尖括号：标签正则吃不掉的那一半由最后一步兜住", () => {
    // `<script` 没有右尖括号，`</?[a-zA-Z][^>]*>` 匹配不到它
    expect(plainText("停在 <script 结尾")).toBe("停在 script 结尾");
    // 嵌套写法会被标签清理整段吃掉，两种情况下都不可能再拼出元素
    expect(plainText("拼不回来 <scr<scriptipt>")).toBe("拼不回来");
  });

  it("折叠空白并去掉首尾空格", () => {
    expect(plainText("  第一行\n   第二行  ")).toBe("第一行 第二行");
  });

  it("readFirstParagraph 走同一个出口：链接语法不再出现在截出来的导语里", () => {
    expect(
      readFirstParagraph(
        "# 09 · 外汇篇\n\n> [09-市场与品种专题篇/01-外汇市场.md](../markets-instruments/forex-market.md) 讲清了外汇的「概念」\n",
      ),
    ).toBe("09-市场与品种专题篇/01-外汇市场.md 讲清了外汇的「概念」");
  });
});
