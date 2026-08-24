// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroCard } from "./hero-card";

describe("HeroCard", () => {
  it("渲染标题", () => {
    render(<HeroCard title="测试标题" />);
    expect(screen.getByText("测试标题")).toBeInTheDocument();
  });

  it("渲染 label 标签", () => {
    render(<HeroCard label="标签" title="标题" />);
    expect(screen.getByText("标签")).toBeInTheDocument();
  });

  it("渲染 children 内容", () => {
    render(<HeroCard title="标题">正文内容</HeroCard>);
    expect(screen.getByText("正文内容")).toBeInTheDocument();
  });

  it("无 label 时不渲染 label 段", () => {
    const { container } = render(<HeroCard title="标题" />);
    expect(container.querySelector(".text-accent")).toBeNull();
  });

  it("有渐变背景类", () => {
    const { container } = render(<HeroCard title="标题" />);
    const header = container.querySelector("header");
    expect(header?.className).toContain("bg-gradient");
  });
});
