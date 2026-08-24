// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroChart } from "./hero-chart";

describe("HeroChart", () => {
  it("渲染 BTCUSDT 标签", () => {
    render(<HeroChart />);
    expect(screen.getByText(/BTCUSDT/)).toBeInTheDocument();
  });

  it("渲染 SVG 图表", () => {
    const { container } = render(<HeroChart />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("渲染 K 线蜡烛 rect", () => {
    const { container } = render(<HeroChart />);
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(0);
  });

  it("locale=en 显示英文提示", () => {
    render(<HeroChart locale="en" />);
    expect(screen.getAllByText(/first lesson/i).length).toBeGreaterThan(0);
  });

  it("locale=zh 显示中文提示", () => {
    render(<HeroChart locale="zh" />);
    expect(screen.getAllByText(/第一课/).length).toBeGreaterThan(0);
  });
});
