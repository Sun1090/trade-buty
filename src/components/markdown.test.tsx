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
});
