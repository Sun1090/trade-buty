import { describe, it, expect } from "vitest";
import {
  convertContainers,
  stripVitePressArtifacts,
  stripLeadingH1,
  rewriteLinks,
  prepareForRender,
} from "./content";

describe("convertContainers", () => {
  it("::: tip 转为 callout div", () => {
    const out = convertContainers("::: tip\n这是提示\n:::");
    expect(out).toContain('class="callout callout-tip"');
    expect(out).toContain("callout-title");
    expect(out).toContain("这是提示");
    expect(out).toContain("</div>");
  });

  it("自定义标签保留", () => {
    const out = convertContainers("::: warning 自定义标题\n内容\n:::");
    expect(out).toContain("自定义标题");
  });

  it("无容器的内容原样保留", () => {
    const out = convertContainers("普通段落\n另一段");
    expect(out).toBe("普通段落\n另一段");
  });

  it("未闭合容器兜底关 div", () => {
    const out = convertContainers("::: info\n内容");
    expect(out).toContain("</div>");
  });
});

describe("stripVitePressArtifacts", () => {
  it("移除「篇目一览」节到下一个 H2", () => {
    const md = "## 篇目一览\n<DocCards />\n## 真正内容\n正文";
    const out = stripVitePressArtifacts(md);
    expect(out).not.toContain("篇目一览");
    expect(out).not.toContain("DocCards");
    expect(out).toContain("真正内容");
  });

  it("移除独立 DocCards 行", () => {
    const md = "正文\n<DocCards />\n后文";
    const out = stripVitePressArtifacts(md);
    expect(out).not.toContain("DocCards");
    expect(out).toContain("正文");
    expect(out).toContain("后文");
  });

  it("无 VitePress 内容不变", () => {
    const md = "普通内容";
    expect(stripVitePressArtifacts(md)).toBe("普通内容");
  });
});

describe("stripLeadingH1", () => {
  it("移除开头的 H1", () => {
    expect(stripLeadingH1("# 标题\n正文")).toBe("正文");
  });

  it("H1 带空格", () => {
    expect(stripLeadingH1("#  标题\n正文")).toBe("正文");
  });

  it("无 H1 不变", () => {
    expect(stripLeadingH1("## H2\n正文")).toBe("## H2\n正文");
  });

  it("H1 在 200 字符后不删", () => {
    const padding = "a".repeat(250);
    const md = padding + "\n# 标题\n正文";
    expect(stripLeadingH1(md)).toBe(md);
  });
});

describe("rewriteLinks", () => {
  it("相对链接 ../futures/ 改为站内路由", () => {
    const md = "[保证金](../futures/margin.md)";
    const out = rewriteLinks(md, "zh", "getting-started");
    expect(out).toContain("/zh/knowledge/futures/margin");
    expect(out).not.toContain("../");
  });

  it("外部链接不重写", () => {
    const md = "[Google](https://google.com)";
    expect(rewriteLinks(md, "zh", "spot")).toBe(md);
  });

  it("锚点链接不重写", () => {
    const md = "[跳转](#section)";
    expect(rewriteLinks(md, "zh", "spot")).toBe(md);
  });

  it("保留锚点 hash", () => {
    const md = "[跳](../futures/margin.md#section)";
    const out = rewriteLinks(md, "zh", "spot");
    expect(out).toContain("#section");
  });
});

describe("prepareForRender", () => {
  it("完整管线：去 VitePress → 去 H1 → 转容器 → 重写链接", () => {
    const md = `# 标题

## 篇目一览
<DocCards />

## 正文
::: tip
提示内容
:::

[链接](../futures/margin.md)`;
    const out = prepareForRender(md, "zh", "getting-started");
    expect(out).not.toContain("篇目一览");
    expect(out).not.toContain("DocCards");
    expect(out).toContain("callout");
    expect(out).toContain("/zh/knowledge/futures/margin");
    // H1 已被剥离（正文不再以 # 开头）
    expect(out.trim().startsWith("# 标题")).toBe(false);
  });
});
