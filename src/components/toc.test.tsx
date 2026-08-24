// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toc } from "./toc";
import type { TocItem } from "@/lib/toc";

describe("Toc", () => {
  const items: TocItem[] = [
    { text: "第一节", depth: 2, id: "section-1" },
    { text: "子节", depth: 3, id: "subsection" },
    { text: "第二节", depth: 2, id: "section-2" },
  ];

  it("渲染导航标签", () => {
    render(<Toc items={items} heading="目录" />);
    expect(screen.getByText("目录")).toBeInTheDocument();
  });

  it("渲染所有标题链接", () => {
    const { container } = render(<Toc items={items} heading="目录" />);
    const links = container.querySelectorAll("nav a");
    expect(links.length).toBe(3);
    expect(links[0].textContent).toBe("第一节");
    expect(links[1].textContent).toBe("子节");
    expect(links[2].textContent).toBe("第二节");
  });

  it("少于 3 项不渲染", () => {
    const { container } = render(
      <Toc items={[{ text: "仅一项", depth: 2, id: "one" }]} heading="目录" />
    );
    expect(container.querySelector("nav")).toBeNull();
  });

  it("链接 href 含 #id", () => {
    const { container } = render(<Toc items={items} heading="目录" />);
    const link = container.querySelectorAll("nav a")[0];
    expect(link?.getAttribute("href")).toBe("#section-1");
  });
});
