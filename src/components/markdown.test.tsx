// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./markdown";
import { prepareForRender } from "@/lib/content";

describe("Markdown", () => {
  it("渲染段落", () => {
    render(<Markdown content="这是普通段落" />);
    expect(screen.getByText("这是普通段落")).toBeInTheDocument();
  });

  it("渲染 H2", () => {
    const { container } = render(<Markdown content="## 标题" />);
    expect(container.querySelector("h2")).toBeTruthy();
  });

  it("渲染代码块", () => {
    const { container } = render(<Markdown content={"```js\nconsole.log(1)\n```"} />);
    expect(container.textContent).toContain("console.log");
    const badge = container.querySelector("pre + span, div.relative > span");
    expect(badge?.textContent).toBe("js");
    expect(badge?.className).toContain("text-muted");
  });

  it("外链加 target=_blank", () => {
    const { container } = render(<Markdown content="[Google](https://google.com)" />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("内链不加 target=_blank", () => {
    const { container } = render(<Markdown content="[课](/knowledge/spot)" />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("target")).toBeNull();
  });

  it("rewriteLinks 加了 locale 前缀的站内地址不算外链", () => {
    // 生产者（rewriteLinks）与消费者（isInternal）必须对同一个形状达成一致：
    // 课文里写 [坑](../pitfalls/)，落到页面上是 /zh/knowledge/pitfalls。
    const prepared = prepareForRender("[坑](../pitfalls/)", "zh", "getting-started");
    expect(prepared).toContain("](/zh/knowledge/pitfalls)");
    const { container } = render(<Markdown content={prepared} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/zh/knowledge/pitfalls");
    expect(link?.getAttribute("target"), "站内链不该开新标签").toBeNull();
    expect(link?.textContent, "站内链不该挂外链标记 ↗").toBe("坑");
  });

  it("en 的站内地址同样留在本页", () => {
    const prepared = prepareForRender("[basics](./spot-basics.md)", "en", "spot");
    expect(prepared).toContain("](/en/knowledge/spot/spot-basics)");
    const { container } = render(<Markdown content={prepared} />);
    expect(container.querySelector("a")?.getAttribute("target")).toBeNull();
  });

  it("页内 #锚点 不开新标签", () => {
    const { container } = render(<Markdown content="[跳到第二节](#第二节)" />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("target")).toBeNull();
    expect(link?.textContent).toBe("跳到第二节");
  });
});

describe("R7.2 图片懒加载", () => {
  it("img 渲染带 loading=lazy，alt 原样落地", () => {
    const { container } = render(<Markdown content="![示例](/knowledge-assets/x.png)" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("alt")).toBe("示例");
  });

  it("课程图片可按键盘打开，并保留 alt 作为可访问名称", () => {
    const { container } = render(
      <Markdown
        content="![走势图](/knowledge-assets/x.png)"
        interactiveImages
        interactiveImageLabel="打开大图"
      />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("role")).toBe("button");
    expect(img?.getAttribute("tabindex")).toBe("0");
    expect(img?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(img?.getAttribute("aria-label")).toBeNull();
    expect(screen.getByRole("button", { name: "走势图" })).toBe(img);
  });

  it("空 alt 课程图片使用本地化打开标签", () => {
    render(
      <Markdown
        content="![](/knowledge-assets/x.png)"
        interactiveImages
        interactiveImageLabel="打开大图"
      />,
    );
    expect(screen.getByRole("button", { name: "打开大图" })).toBeInTheDocument();
  });
});
