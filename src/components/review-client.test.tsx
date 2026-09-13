// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewClient } from "./review-client";
import type { ChapterQuiz } from "@/lib/quiz-types";
import { localDateStr, shiftDate } from "@/lib/date-utils";

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
});
