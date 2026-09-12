// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

type QuizFixture = { title: string; questions: unknown[] };

const mocks = vi.hoisted(() => ({
  readQuizProgress: vi.fn<(slug: string) => { best: number; done: boolean } | null>(
    () => null,
  ),
  quizzes: {} as Record<string, QuizFixture>,
}));

vi.mock("@/lib/quiz-store", () => ({
  readQuizProgress: mocks.readQuizProgress,
}));
vi.mock("@/lib/quizzes", () => ({ QUIZZES: mocks.quizzes }));

import { RadarChart } from "./radar-chart";

function setQuizzes(map: Record<string, QuizFixture>) {
  for (const key of Object.keys(mocks.quizzes)) delete mocks.quizzes[key];
  Object.assign(mocks.quizzes, map);
}

beforeEach(() => {
  mocks.readQuizProgress.mockReset();
  mocks.readQuizProgress.mockReturnValue(null);
  setQuizzes({
    "getting-started": {
      title: "01 · 入门基础",
      questions: new Array(10).fill({}),
    },
    spot: { title: "02 · 现货交易", questions: new Array(4).fill({}) },
    stocks: { title: "03 · 股票基础", questions: new Array(5).fill({}) },
  });
});

describe("RadarChart", () => {
  it("shows the empty state when no quiz is registered", () => {
    setQuizzes({});
    render(<RadarChart label="掌握度" emptyLabel="还没有测验数据" />);
    expect(screen.getByText("还没有测验数据")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders a labelled SVG with one axis per quiz", () => {
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    const svg = screen.getByRole("img", { name: "掌握度" });
    expect(svg.querySelectorAll("circle").length).toBe(3);
  });

  it("strips the chapter number prefix from axis labels", () => {
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    const labels = Array.from(
      screen.getByRole("img", { name: "掌握度" }).querySelectorAll("text"),
    ).map((t) => t.textContent);
    expect(labels).toContain("入门基础");
    expect(labels).not.toContain("01 · 入门基础");
  });

  it("plots best/question-count as a percentage of the axis radius", () => {
    mocks.readQuizProgress.mockImplementation((slug: string) =>
      slug === "spot" ? { best: 3, done: true } : null,
    );
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    const svg = screen.getByRole("img", { name: "掌握度" });
    const dataPolygon = svg.querySelectorAll("polygon")[4];
    expect(dataPolygon).toBeTruthy();

    const points = (dataPolygon.getAttribute("points") ?? "")
      .split(" ")
      .map((pair) => pair.split(",").map(Number));
    // N=3 → 第二个顶点在 +30° 方向，3/4 正确率应落在 0.75r 处
    const rr = 0.75 * 90;
    expect(points[1][0]).toBeCloseTo(130 + rr * Math.cos(Math.PI / 6), 3);
    expect(points[1][1]).toBeCloseTo(130 + rr * Math.sin(Math.PI / 6), 3);
  });

  it("caps the chart at five axes", () => {
    setQuizzes(
      Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [
          `ch-${i}`,
          { title: `0${i} · 章节${i}`, questions: new Array(4).fill({}) },
        ]),
      ),
    );
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    const svg = screen.getByRole("img", { name: "掌握度" });
    expect(svg.querySelectorAll("text").length).toBe(5);
  });

  it("re-reads progress when the progress event fires", () => {
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    expect(mocks.readQuizProgress).toHaveBeenCalledTimes(3);
    act(() => {
      window.dispatchEvent(new Event("tb-progress"));
    });
    expect(mocks.readQuizProgress).toHaveBeenCalledTimes(6);
    expect(mocks.readQuizProgress).toHaveBeenCalledWith("spot");
  });
});
