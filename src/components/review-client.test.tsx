// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewClient } from "./review-client";
import type { ChapterQuiz } from "@/lib/quiz-types";
import { localDateStr, shiftDate } from "@/lib/date-utils";
import { buildWrongbookEfficiency } from "@/lib/wrongbook-efficiency";

type Entry = {
  chapterNum: string;
  questionIdx: number;
  picked: number;
  at: number;
  srsStage?: number;
  srsDue?: string;
};

const wrongState = vi.hoisted(() => ({
  items: {} as Record<string, Entry>,
}));

const wrongMock = vi.hoisted(() => ({
  resolveWrong: vi.fn(),
  clearAllWrong: vi.fn(),
  applySrsResult: vi.fn(),
  pruneOrphanWrong: vi.fn(),
}));

vi.mock("@/lib/wrongbook", () => ({
  readWrong: () => wrongState.items,
  resolveWrong: wrongMock.resolveWrong,
  clearAllWrong: wrongMock.clearAllWrong,
  applySrsResult: wrongMock.applySrsResult,
  pruneOrphanWrong: wrongMock.pruneOrphanWrong,
}));

const addStudyTime = vi.hoisted(() => vi.fn());
vi.mock("@/lib/study-time", () => ({ addStudyTime }));

// 真实的 next/link 会触发 prefetch；换成纯 <a> 消除抖动。
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// AI 区块整体替换为探针，断言错题列表被原样传下去（#59 契约回归的客户端一侧）。
const aiQuizSpy = vi.hoisted(() => vi.fn(() => null));
vi.mock("@/components/ai-quiz", () => ({
  AiQuiz: aiQuizSpy,
}));

const quizzes: ChapterQuiz[] = [
  {
    chapterNum: "spot",
    title: "现货测验",
    docSlug: "spot-basics",
    questions: [
      { question: "Q1", options: ["a", "b"], answer: 0, explain: "e1" },
      { question: "Q2", options: ["c", "d"], answer: 1, explain: "e2" },
    ],
  } as unknown as ChapterQuiz,
];

const dict = {
  title: "错题本", intro: "说明", label: "错题", showAnswer: "看答案",
  yourPick: "你选", correctPick: "正确", resolved: "已掌握", empty: "空空如也",
  emptyHint: "去做测验", browseCta: "浏览课程",
};

const localStorageBacking = new Map<string, string>();
beforeEach(() => {
  localStorageBacking.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => localStorageBacking.get(k) ?? null,
    setItem: (k: string, v: string) => void localStorageBacking.set(k, v),
    removeItem: (k: string) => void localStorageBacking.delete(k),
    clear: () => localStorageBacking.clear(),
    key: (i: number) => Array.from(localStorageBacking.keys())[i] ?? null,
    get length() {
      return localStorageBacking.size;
    },
  });
  wrongState.items = {};
  addStudyTime.mockClear();
  wrongMock.resolveWrong.mockClear();
  wrongMock.clearAllWrong.mockClear();
  wrongMock.applySrsResult.mockClear();
  aiQuizSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function today() {
  return localDateStr();
}

function entry(over: Partial<Entry> = {}): Entry {
  return { chapterNum: "spot", questionIdx: 0, picked: 1, at: 1, ...over };
}

describe("ReviewClient (空态)", () => {
  it("无错题显示空态", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(screen.getByText("空空如也")).toBeInTheDocument();
  });

  it("空态显示引导 CTA", () => {
    const { container } = render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(container.textContent).toContain("浏览课程");
  });
});

describe("ReviewClient 重答选项键盘可达（R13.9）", () => {
  beforeEach(() => {
    wrongState.items = {
      "spot:0": entry(),
    };
  });

  it("重答选项是按钮，作答后禁用", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText("开始快速重答"));

    const optionA = screen.getByRole("button", { name: "A. a" });
    expect(optionA).toBeEnabled();
    fireEvent.click(optionA);
    expect(optionA).toBeDisabled();
  });
});

describe("ReviewClient 孤儿条目清理（R5.10）", () => {
  it("题库里已不存在的条目会被标记删除", () => {
    wrongState.items = {
      "spot:0": entry(),
      "removed:3": entry({ chapterNum: "removed", questionIdx: 3 }),
    };
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(wrongMock.pruneOrphanWrong).toHaveBeenCalledTimes(1);
    const valid = wrongMock.pruneOrphanWrong.mock.calls[0][0] as Set<string>;
    expect(valid.has("spot:0")).toBe(true);
    expect(valid.has("removed:3")).toBe(false);
  });
});

describe("ReviewClient 展示与到期提示（R5.2/R5.4）", () => {
  it("过期条目显示红色补上提醒，未来条目显示剩余天数", () => {
    wrongState.items = {
      "spot:0": entry({ srsStage: 0, srsDue: shiftDate(today(), -3) }),
      "spot:1": entry({ questionIdx: 1, srsDue: shiftDate(today(), 5) }),
    };
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);

    expect(screen.getByText(/过期 3 天/)).toBeInTheDocument();
    expect(screen.getByText("5 天后")).toBeInTheDocument();
    expect(screen.getByText(/2 道错题，1 道今日到期（1 道已过期）/)).toBeInTheDocument();
  });

  it("今天到期条目显示「今日到期」，全部未到期时给鼓励文案", () => {
    wrongState.items = {
      "spot:0": entry({ srsDue: today() }),
    };
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(screen.getByText("今日到期")).toBeInTheDocument();
    // 到期日改为未来后重新挂载（readWrong 只在挂载时读取）
    wrongState.items = { "spot:0": entry({ srsDue: shiftDate(today(), 2) }) };
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(screen.getByText(/今天没有到期的复习/)).toBeInTheDocument();
  });

  it("英文 locale 输出英文文案", () => {
    wrongState.items = {
      "spot:0": entry({ srsDue: shiftDate(today(), -2) }),
    };
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="en" />);
    expect(screen.getByText(/2d overdue/)).toBeInTheDocument();
    expect(screen.getByText(/due now/)).toBeInTheDocument();
  });

  // R16.4 的另一半：复习页的「已过期」与错题效率统计的 overdue 必须是同一个数。
  // 「今日到期」按 R5.6 回填（旧数据该出现就出现），「已过期」只看系统真正排过的
  // srsDue（R5.4 不拿推断日期宣布逾期天数）——两把尺子各自成立，但两处入口不能各用一把。
  it("回填的旧数据算今日到期但不标红，且与错题效率统计同口径", () => {
    const dayAt = (date: string) => new Date(`${date}T12:00:00`).getTime();
    const items = {
      // 入库 5 天前、没有 srs_due：回填到期日 = 4 天前 → 该出现在队列里，但不算「已过期」
      "spot:0": entry({ at: dayAt(shiftDate(today(), -5)) }),
      // 真正排过且已过期的条目
      "spot:1": entry({ questionIdx: 1, srsStage: 1, srsDue: shiftDate(today(), -2) }),
    };
    wrongState.items = items;
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);

    expect(screen.getByText("今日到期")).toBeInTheDocument();
    expect(screen.getByText(/过期 2 天/)).toBeInTheDocument();
    expect(screen.queryByText(/过期 4 天/)).not.toBeInTheDocument();

    const header = screen.getByText(/道错题/).textContent ?? "";
    const shown = {
      dueToday: Number(header.match(/(\d+) 道今日到期/)?.[1]),
      overdue: Number(header.match(/（(\d+) 道已过期）/)?.[1]),
    };
    const efficiency = buildWrongbookEfficiency({
      wrongEntries: items,
      attempts: {},
      today: today(),
    });
    expect(shown).toEqual({
      dueToday: efficiency.latest.dueToday,
      overdue: efficiency.latest.overdue,
    });
    expect(shown).toEqual({ dueToday: 2, overdue: 1 });
  });
});

describe("ReviewClient SRS 模式切换（R5.9）", () => {
  beforeEach(() => {
    wrongState.items = { "spot:0": entry({ srsDue: today() }) };
  });

  it("默认开启；点击后关闭并写入 localStorage", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    const toggle = screen.getByText(/复习计划开/);
    fireEvent.click(toggle);
    expect(screen.getByText(/复习计划关/)).toBeInTheDocument();
    expect(localStorage.getItem("tb-srs-mode")).toBe("off");
  });

  it("localStorage 已置 off 时以关闭态启动", () => {
    localStorage.setItem("tb-srs-mode", "off");
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(screen.getByText(/复习计划关/)).toBeInTheDocument();
    // 关闭后不再展示「今日到期」徽标
    expect(screen.queryByText("今日到期")).toBeNull();
  });

  it("关闭模式下显示已掌握按钮，点击移除错题且不再依赖 SRS", () => {
    localStorage.setItem("tb-srs-mode", "off");
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText("看答案"));
    fireEvent.click(screen.getByText("已掌握"));
    expect(wrongMock.resolveWrong).toHaveBeenCalledWith("spot", 0);
    // 关闭模式下不应走 SRS 状态机
    expect(wrongMock.applySrsResult).not.toHaveBeenCalled();
  });
});

describe("ReviewClient 复习应答（R5.5/R5.8）", () => {
  beforeEach(() => {
    wrongState.items = { "spot:0": entry({ srsDue: today() }) };
  });

  it("掌握了 → SRS 推进 + 记入每日目标", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText("看答案"));
    fireEvent.click(screen.getByText("掌握了"));
    expect(wrongMock.applySrsResult).toHaveBeenCalledWith("spot", 0, true);
    expect(addStudyTime).toHaveBeenCalledWith("quiz", 60);
  });

  it("还没掌握 → SRS 重置并带上次选项", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText("看答案"));
    fireEvent.click(screen.getByText("还没掌握，明天再见"));
    expect(wrongMock.applySrsResult).toHaveBeenCalledWith("spot", 0, false, 1);
    expect(addStudyTime).toHaveBeenCalledWith("quiz", 60);
  });
});

describe("ReviewClient 答案揭晓", () => {
  beforeEach(() => {
    wrongState.items = { "spot:0": entry({ srsDue: today() }) };
  });

  it("揭晓后显示你的选择/正确答案/解析，可再次收起", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText("看答案"));
    expect(screen.getByText(/你选/).textContent).toContain("b");
    expect(screen.getByText(/正确/).textContent).toContain("a");
    expect(screen.getByText("e1")).toBeInTheDocument();

    // SRS 下「看答案」按钮消失（被操作区替代）
    expect(screen.queryByText("看答案")).toBeNull();
  });
});

describe("ReviewClient 导出与清空", () => {
  beforeEach(() => {
    wrongState.items = { "spot:0": entry({ srsDue: today() }) };
  });

  it("导出生成 txt 下载并回收 ObjectURL", () => {
    const createObjectURL = vi.fn(() => "blob:wrongbook");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText("导出"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const [blob] = createObjectURL.mock.calls[0] as unknown as [Blob];
    expect(blob.type).toBe("text/plain;charset=utf-8");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:wrongbook");
  });

  it("英文界面导出的 txt 四条标签都是英文（R16.51：此前写死中文）", async () => {
    const createObjectURL = vi.fn(() => "blob:en-export");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="en" />);
    fireEvent.click(screen.getByText("Export"));

    const [blob] = createObjectURL.mock.calls[0] as unknown as [Blob];
    const text = await blob.text();
    expect(text).toContain("Trade Buty wrong-answer export");
    expect(text).toContain("Exported at: ");
    expect(text).toContain("Your pick: ");
    expect(text).toContain("Correct answer: ");
    // 课文本身的中文不在断言范围内：导出的是访客做错的那道题，语言跟着内容走
    expect(text).not.toContain("错题本导出");
    expect(text).not.toContain("导出时间");
    expect(text).not.toContain("你的选择");
    expect(text).not.toContain("正确答案");
  });

  it("确认框取消 / 确认分别不调用 / 调用清空", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText("清空"));
    expect(wrongMock.clearAllWrong).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByText("清空"));
    expect(wrongMock.clearAllWrong).toHaveBeenCalledTimes(1);
  });
});

describe("ReviewClient 快速重答", () => {
  beforeEach(() => {
    wrongState.items = { "spot:0": entry({ srsDue: today() }) };
  });

  it("答对显示 ✅，可进入下一道随机题", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText("开始快速重答"));
    fireEvent.click(screen.getByRole("button", { name: "A. a" }));
    expect(screen.getByText(/✅ 正确/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("下一道随机题"));
    // 回到未作答状态
    expect(screen.queryByText(/✅ 正确/)).toBeNull();
    expect(screen.getByRole("button", { name: "A. a" })).toBeEnabled();
  });

  it("答错显示正确答案，且不重复计分", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText("开始快速重答"));
    fireEvent.click(screen.getByRole("button", { name: "B. b" }));
    expect(screen.getByText(/❌ 错误，正确答案是 a/)).toBeInTheDocument();
  });

  it("返回按钮退出重答回到列表", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText("开始快速重答"));
    fireEvent.click(screen.getByText("返回"));
    expect(screen.getByText(/今天的复习任务/)).toBeInTheDocument();
  });

  it("英文界面的重答面板整块都是英文（R16.51：这一片的文字此前写死中文）", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="en" />);
    fireEvent.click(screen.getByText("Start a quick redo"));
    expect(screen.getByText("Random redo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "A. a" }));
    expect(screen.getByText(/✅ Correct/)).toBeInTheDocument();
    expect(screen.getByText("Another random question")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText("Today’s review")).toBeInTheDocument();
    expect(screen.queryByText("随机抽题重答")).not.toBeInTheDocument();
  });
});

describe("ReviewClient AI 变体题入口（#59 契约：错题列表原样下传）", () => {
  beforeEach(() => {
    wrongState.items = {
      "spot:0": entry({ srsDue: today() }),
      "spot:1": entry({ questionIdx: 1, srsDue: today() }),
    };
  });

  it("把 chapterNum/questionIdx 列表交给 AiQuiz，而不是数字索引", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(aiQuizSpy).toHaveBeenCalled();
    const [props] = aiQuizSpy.mock.calls.at(-1) as unknown as [
      { wrongItems: { chapterNum: string; questionIdx: number }[]; aiEnabled?: boolean },
    ];
    expect(props.wrongItems).toEqual([
      { chapterNum: "spot", questionIdx: 0 },
      { chapterNum: "spot", questionIdx: 1 },
    ]);
    expect(props.aiEnabled).toBe(true);
  });

  it("aiEnabled=false 时把开关原样传给 AiQuiz", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" aiEnabled={false} />);
    const [props] = aiQuizSpy.mock.calls.at(-1) as unknown as [{ aiEnabled?: boolean }];
    expect(props.aiEnabled).toBe(false);
  });

  it("空错题本时不渲染 AI 区块", () => {
    wrongState.items = {};
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(aiQuizSpy).not.toHaveBeenCalled();
  });
});

describe("ReviewClient 分组与跳转", () => {
  it("按篇章分组并给出重做本章测验的链接", () => {
    wrongState.items = { "spot:0": entry({ srsDue: today() }) };
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    const heading = screen.getByText(/现货测验 · 1/);
    expect(heading).toBeInTheDocument();
    const link = screen.getByText("重做本章测验 →").closest("a");
    expect(link).toHaveAttribute("href", "/zh/knowledge/spot/spot-basics");
  });

  it("英文界面的两条错题出口都是英文（R16.51：这两处此前写死中文）", () => {
    wrongState.items = { "spot:0": entry({ srsDue: today() }) };
    render(<ReviewClient quizzes={quizzes} dict={{ ...dict, showAnswer: "Reveal" }} locale="en" />);
    expect(screen.getByText("Redo this chapter quiz →")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reveal"));
    expect(screen.getByText("Ask AI to go deeper")).toBeInTheDocument();
    expect(screen.queryByText("重做本章测验 →")).not.toBeInTheDocument();
    expect(screen.queryByText("问 AI 深入理解")).not.toBeInTheDocument();
  });
});
