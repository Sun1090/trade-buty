// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProgressRing } from "./progress-ring";

function ring(pct: number) {
  const { container } = render(<ProgressRing pct={pct} label="完成度" />);
  const circles = container.querySelectorAll("circle");
  // 第二个 circle 是进度环
  return circles[1] as SVGCircleElement;
}

describe("ProgressRing", () => {
  it("0% 时 dashoffset 等于周长（无进度）", () => {
    const c = ring(0);
    const circumference = Number(c.getAttribute("stroke-dasharray"));
    expect(Number(c.getAttribute("stroke-dashoffset"))).toBeCloseTo(circumference, 5);
  });

  it("50% 时 dashoffset 为周长一半", () => {
    const c = ring(50);
    const circumference = Number(c.getAttribute("stroke-dasharray"));
    expect(Number(c.getAttribute("stroke-dashoffset"))).toBeCloseTo(circumference / 2, 5);
  });

  it("100% 时 dashoffset 为 0", () => {
    const c = ring(100);
    expect(Number(c.getAttribute("stroke-dashoffset"))).toBeCloseTo(0, 5);
  });

  it("超过 100 时封顶（dashoffset 不为负）", () => {
    const c = ring(150);
    expect(Number(c.getAttribute("stroke-dashoffset"))).toBeCloseTo(0, 5);
  });
});
