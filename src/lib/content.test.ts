import { describe, expect, it } from "vitest";
import {
  convertContainers,
  prepareForRender,
  rewriteLinks,
  stripLeadingH1,
  stripVitePressArtifacts,
} from "./content";

describe("convertContainers", () => {
  it("warning 容器转换为 callout 引用块（带标题）", () => {
    const md = "正文\n\n::: warning ⚠️ 风险提示\n小心爆仓\n\n第二段\n:::\n\n结尾";
    const out = convertContainers(md);
    expect(out).toContain("> **⚠️ 风险提示**");
    expect(out).toContain("> 小心爆仓");
    expect(out).toContain("> 第二段");
    expect(out).not.toContain(":::");
  });

  it("无标题的 tip 容器使用默认图标标题", () => {
    const out = convertContainers("::: tip\n提示内容\n:::");
    expect(out).toContain("> **💡 提示**");
    expect(out).toContain("> 提示内容");
  });

  it("danger 容器使用 🚨 危险 默认标题", () => {
    const out = convertContainers("::: danger\n危险内容\n:::");
    expect(out).toContain("> **🚨 危险**");
  });

  it("无容器时原样返回", () => {
    const md = "# 标题\n\n普通段落";
    expect(convertContainers(md)).toBe(md);
  });
});

describe("rewriteLinks", () => {
  it("同篇章 .md 链接重写为数字路由", () => {
    const out = rewriteLinks("[K线入门](02-K线与图表.md)", "01");
    expect(out).toBe("[K线入门](/knowledge/01/02)");
  });

  it("跨篇章目录链接重写为篇章路由", () => {
    const out = rewriteLinks("[期货篇](../03-期货篇/)", "01");
    expect(out).toBe("[期货篇](/knowledge/03)");
  });

  it("跨篇章文档链接取目标篇章号与文件序号", () => {
    const out = rewriteLinks("[指标](../06-技术分析篇/02-技术指标.md)", "01");
    expect(out).toBe("[指标](/knowledge/06/02)");
  });

  it("README 链接指向篇章页", () => {
    const out = rewriteLinks("[导语](../03-期货篇/README.md)", "01");
    expect(out).toBe("[导语](/knowledge/03)");
  });

  it("_assets 图片路径重写为 knowledge-assets（同篇章）", () => {
    const out = rewriteLinks("![图](_assets/macd.svg)", "06");
    expect(out).toBe('![图](/knowledge-assets/06-技术分析篇/macd.svg)');
  });

  it("_assets 跨篇章引用归属目标篇章", () => {
    const out = rewriteLinks("![图](../01-入门基础/_assets/k.svg)", "06");
    expect(out).toBe("![图](/knowledge-assets/01-入门基础/k.svg)");
  });

  it("锚点保留", () => {
    const out = rewriteLinks("[量价](03-量价分析.md#5-筹码分布)", "06");
    expect(out).toBe("[量价](/knowledge/06/03#5-筹码分布)");
  });

  it("外部链接不重写", () => {
    const md = "[官网](https://example.com)";
    expect(rewriteLinks(md, "01")).toBe(md);
  });

  it("无法识别的链接宽容保持原样", () => {
    const md = "[怪链接](not-a-page)";
    expect(rewriteLinks(md, "01")).toBe(md);
  });
});

describe("stripVitePressArtifacts", () => {
  it("移除「篇目一览」整节", () => {
    const md = "# 篇章\n\n## 各篇简介\n\n内容\n\n## 篇目一览\n\n<DocCards dir=\"01-x\" />\n";
    const out = stripVitePressArtifacts(md);
    expect(out).not.toContain("篇目一览");
    expect(out).not.toContain("DocCards");
    expect(out).toContain("各篇简介");
  });

  it("移除游离的 DocCards 标签行", () => {
    const out = stripVitePressArtifacts("前文\n<DocCards dir=\"x\" />\n后文");
    expect(out).not.toContain("DocCards");
    expect(out).toContain("前文");
    expect(out).toContain("后文");
  });
});

describe("stripLeadingH1", () => {
  it("剥离文首 H1", () => {
    expect(stripLeadingH1("# 01 · 标题\n\n正文")).toBe("\n正文");
  });

  it("H1 在 200 字符之外时保留", () => {
    const far = "x".repeat(300) + "\n\n# 远处标题\n";
    expect(stripLeadingH1(far)).toContain("# 远处标题");
  });

  it("无 H1 原样返回", () => {
    expect(stripLeadingH1("只有段落")).toBe("只有段落");
  });
});

describe("prepareForRender 端到端", () => {
  it("容器 + 链接 + H1 剥离一次完成", () => {
    const md = [
      "# 01 · 金融市场全景",
      "",
      "::: warning ⚠️ 风险提示",
      "本篇有 [现货篇](../02-现货篇/) 和 [内链](03-x.md#anchor)",
      ":::",
    ].join("\n");
    const out = prepareForRender(md, "01");
    expect(out).not.toMatch(/^\s*#\s/m); // H1 已剥
    expect(out).toContain("**⚠️ 风险提示**");
    expect(out).toContain("/knowledge/02");
    expect(out).toContain("/knowledge/01/03#anchor");
  });
});
