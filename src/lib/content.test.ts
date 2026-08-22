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
    const out = rewriteLinks("[K线入门](core-concepts.md)", "zh", "getting-started");
    expect(out).toBe("[K线入门](/zh/knowledge/getting-started/core-concepts)");
  });

  it("跨篇章目录链接重写为篇章路由", () => {
    const out = rewriteLinks("[期货篇](../futures/)", "zh", "getting-started");
    expect(out).toBe("[期货篇](/zh/knowledge/futures)");
  });

  it("跨篇章文档链接取目标篇章号与文件序号", () => {
    const out = rewriteLinks("[指标](../technical-analysis/indicators.md)", "zh", "getting-started");
    expect(out).toBe("[指标](/zh/knowledge/technical-analysis/indicators)");
  });

  it("README 链接指向篇章页", () => {
    const out = rewriteLinks("[导语](../futures/README.md)", "zh", "getting-started");
    expect(out).toBe("[导语](/zh/knowledge/futures)");
  });

  it("_assets 图片路径重写为 knowledge-assets（同篇章）", () => {
    const out = rewriteLinks("![图](_assets/macd.svg)", "zh", "technical-analysis");
    expect(out).toBe('![图](/knowledge-assets/zh/technical-analysis/macd.svg)');
  });

  it("_assets 跨篇章引用归属目标篇章", () => {
    const out = rewriteLinks("![图](../getting-started/_assets/k.svg)", "zh", "technical-analysis");
    expect(out).toBe("![图](/knowledge-assets/zh/getting-started/k.svg)");
  });

  it("锚点保留", () => {
    const out = rewriteLinks("[量价](volume-price.md#5-vpvr)", "zh", "technical-analysis");
    expect(out).toBe("[量价](/zh/knowledge/technical-analysis/volume-price#5-vpvr)");
  });

  it("外部链接不重写", () => {
    const md = "[官网](https://example.com)";
    expect(rewriteLinks(md, "zh", "getting-started")).toBe(md);
  });

  it("非 .md 相对链接一律视为篇章目录链接", () => {
    const out = rewriteLinks("[怪链接](not-a-page)", "zh", "getting-started");
    expect(out).toBe("[怪链接](/zh/knowledge/not-a-page)");
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
      "本篇有 [现货篇](../spot/) 和 [内链](core-concepts.md#anchor)",
      ":::",
    ].join("\n");
    const out = prepareForRender(md, "zh", "getting-started");
    expect(out).not.toMatch(/^\s*#\s/m); // H1 已剥
    expect(out).toContain("**⚠️ 风险提示**");
    expect(out).toContain("/zh/knowledge/spot");
    expect(out).toContain("/zh/knowledge/getting-started/core-concepts#anchor");
  });
});
