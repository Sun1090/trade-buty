// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./markdown";

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
    const { container } = render(<Markdown content="```js\nconsole.log(1)\n```" />);
    expect(container.textContent).toContain("console.log");
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
});

describe("R7.2 图片懒加载", () => {
  it("img 渲染带 loading=lazy 与 decoding=async", () => {
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
