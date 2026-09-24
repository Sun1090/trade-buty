// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

type QuizFixture = { title: string; questions: unknown[] };
type Attempt = { chapter: string; best: number; total: number; at: number };

const mocks = vi.hoisted(() => ({
  readQuizProgress: vi.fn<(slug: string) => { best: number; done: boolean } | null>(
    () => null,
  ),
  attempts: [] as Attempt[],
  quizzes: {} as Record<string, QuizFixture>,
}));

vi.mock("@/lib/quiz-store", () => ({
  readQuizProgress: mocks.readQuizProgress,
}));
vi.mock("@/lib/quizzes", () => ({ QUIZZES: mocks.quizzes }));
vi.mock("@/lib/quiz-attempt-ledger", () => ({
  readQuizAttemptLedger: () =>
    Object.fromEntries(mocks.attempts.map((a) => [`${a.chapter}:${a.at}`, a])),
}));

import { RadarChart } from "./radar-chart";

function setQuizzes(map: Record<string, QuizFixture>) {
  for (const key of Object.keys(mocks.quizzes)) delete mocks.quizzes[key];
  Object.assign(mocks.quizzes, map);
}

/** 逐章给出「做过且最好成绩是 best」，没列出来的章节就是没做过 */
function doneScores(map: Record<string, number>) {
  mocks.readQuizProgress.mockImplementation((slug: string) =>
    Object.prototype.hasOwnProperty.call(map, slug) ? { best: map[slug], done: true } : null,
  );
}

function axisLabels(): string[] {
  return Array.from(
    screen.getByRole("img", { name: "掌握度" }).querySelectorAll("text"),
  ).map((node) => node.textContent ?? "");
}

const BASE = {
  "getting-started": { title: "01 · 入门基础", questions: new Array(10).fill({}) },
  spot: { title: "02 · 现货交易", questions: new Array(4).fill({}) },
  stocks: { title: "03 · 股票基础", questions: new Array(5).fill({}) },
  bonds: { title: "04 · 债券基础", questions: new Array(4).fill({}) },
};

beforeEach(() => {
  mocks.readQuizProgress.mockReset();
  mocks.readQuizProgress.mockReturnValue(null);
  mocks.attempts = [];
  setQuizzes(BASE);
});

describe("RadarChart", () => {
  it("不足三章做过时给空态，不围一个全 0 的形状", () => {
    doneScores({ "getting-started": 5, spot: 3 });
    render(<RadarChart label="掌握度" emptyLabel="还早" />);
    expect(screen.getByText("还早")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("没做过的章节不进轴，也不被画成 0 掌握", () => {
    doneScores({ "getting-started": 5, spot: 3, stocks: 4 });
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    const labels = axisLabels();
    expect(labels).toHaveLength(3);
    expect(labels).not.toContain("债券基础");
  });

  it("轴按最近一次作答排前面，账本里没日期的不编日期、排在后面", () => {
    doneScores({ "getting-started": 5, spot: 3, stocks: 4, bonds: 2 });
    const DAY = 86_400_000;
    const now = Date.now();
    mocks.attempts = [
      { chapter: "spot", best: 3, total: 4, at: now - DAY },
      { chapter: "stocks", best: 4, total: 5, at: now - 3 * DAY },
      { chapter: "bonds", best: 2, total: 4, at: now - 2 * DAY },
    ];
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    // getting-started 没有作答日期，只能排在有日期的三章之后
    expect(axisLabels()).toEqual(["现货交易", "债券基础", "股票基础", "入门基础"]);
  });

  it("题库顺序只作同分时的落定次序", () => {
    doneScores({ "getting-started": 5, spot: 3, stocks: 4, bonds: 2 });
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    expect(axisLabels()).toEqual(["入门基础", "现货交易", "股票基础", "债券基础"]);
  });

  it("最多五根轴", () => {
    setQuizzes(
      Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [
          `ch-${i}`,
          { title: `0${i} · 章节${i}`, questions: new Array(4).fill({}) },
        ]),
      ),
    );
    doneScores(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`ch-${i}`, 2])));
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    expect(axisLabels()).toHaveLength(5);
  });

  it("剥掉标题里的章节编号前缀", () => {
    doneScores({ "getting-started": 5, spot: 3, stocks: 4 });
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    const labels = axisLabels();
    expect(labels).toContain("入门基础");
    expect(labels).not.toContain("01 · 入门基础");
  });

  it("顶点落在 best/题数 换算出的半径上", () => {
    doneScores({ "getting-started": 5, spot: 3, stocks: 4 });
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    const dataPolygon = screen
      .getByRole("img", { name: "掌握度" })
      .querySelectorAll("polygon")[4];
    expect(dataPolygon).toBeTruthy();

    const points = (dataPolygon.getAttribute("points") ?? "")
      .split(" ")
      .map((pair) => pair.split(",").map(Number));
    // N=3 → 第二个顶点在 +30° 方向，spot 的 3/4 正确率应落在 0.75r 处
    const rr = 0.75 * 90;
    expect(points[1][0]).toBeCloseTo(130 + rr * Math.cos(Math.PI / 6), 3);
    expect(points[1][1]).toBeCloseTo(130 + rr * Math.sin(Math.PI / 6), 3);
  });

  it("作答进度事件会重读", () => {
    doneScores({ "getting-started": 5, spot: 3 });
    render(<RadarChart label="掌握度" emptyLabel="空" />);
    expect(screen.queryByRole("img")).toBeNull();

    doneScores({ "getting-started": 5, spot: 3, stocks: 4 });
    act(() => {
      window.dispatchEvent(new Event("tb-progress"));
    });
    expect(axisLabels()).toHaveLength(3);
  });
});
