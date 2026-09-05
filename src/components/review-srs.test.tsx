// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ChapterQuiz } from "@/lib/quiz-types";

const store = new Map<string, string>();
beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  });
});
afterEach(() => {
  cleanup();
  store.clear();
  vi.unstubAllGlobals();
});

const { ReviewClient } = await import("./review-client");
const { localDateStr, shiftDate } = await import("@/lib/date-utils");

const quizzes: ChapterQuiz[] = [
  {
    chapterNum: "spot",
    title: "现货测验",
    docSlug: "d",
    questions: [
      { question: "过期的旧题", options: ["a", "b", "c", "d"], answer: 0, explain: "e" },
      { question: "未来的新题", options: ["a", "b", "c", "d"], answer: 1, explain: "e" },
    ],
  },
];

const dict = {
  title: "错题本", intro: "说明", label: "错题", showAnswer: "看答案",
  yourPick: "你选", correctPick: "正确", resolved: "已掌握", empty: "空空如也",
  emptyHint: "去做测验", browseCta: "浏览课程",
};

function seed() {
  const today = localDateStr();
  const yesterday = shiftDate(today, -1);
  const later = shiftDate(today, 20);
  store.set("tb-wrong", JSON.stringify({
    // 后写入的「未来新题」排前面入库，验证 SRS 排序能覆盖入库倒序
    "spot:1": { chapterNum: "spot", questionIdx: 1, picked: 0, at: 2, srsStage: 3, srsDue: later },
    "spot:0": { chapterNum: "spot", questionIdx: 0, picked: 0, at: 1, srsStage: 0, srsDue: yesterday },
  }));
  return { later };
}

describe("ReviewClient SRS（R5.3/R5.4/R5.12）", () => {
  it("到期/过期项置顶，过期项带温和红色提醒（R5.3/R5.4）", () => {
    seed();
    const { container } = render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    const html = container.innerHTML;
    expect(html.indexOf("过期的旧题")).toBeLessThan(html.indexOf("未来的新题"));
    expect(container.textContent).toContain("过期 1 天——今天补上就好");
    expect(container.textContent).toContain("今日到期");
    expect(container.textContent).toContain("20 天后");
  });

  it("全部未到期时展示鼓励文案而非空列表（R5.12）", () => {
    const today = localDateStr();
    store.set("tb-wrong", JSON.stringify({
      "spot:1": { chapterNum: "spot", questionIdx: 1, picked: 0, at: 2, srsStage: 3, srsDue: shiftDate(today, 10) },
    }));
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(screen.getByText(/今天没有到期的复习/)).toBeInTheDocument();
    expect(screen.getByText("未来的新题")).toBeInTheDocument();
  });

  it("关闭 SRS（R5.9）后按入库倒序、不显示到期徽章", async () => {
    seed();
    store.set("tb-srs-mode", "off");
    const { container } = render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    const html = container.innerHTML;
    // 纯列表模式回到入库时间倒序（spot:1 的 at 更大排前）
    expect(html.indexOf("未来的新题")).toBeLessThan(html.indexOf("过期的旧题"));
    expect(container.textContent).not.toContain("过期 1 天");
    expect(screen.getByText(/复习计划关/)).toBeInTheDocument();
  });

  it("R5.10：孤儿条目（题库映射不到）被清理", () => {
    seed();
    store.set("tb-wrong", JSON.stringify({
      ...JSON.parse(store.get("tb-wrong")!),
      "ghost:99": { chapterNum: "ghost", questionIdx: 99, picked: 0, at: 3 },
    }));
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(JSON.parse(store.get("tb-wrong")!)["ghost:99"]).toBeUndefined();
  });
});
