// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReplayTrainer, SPEEDS, type ReplayDict } from "./replay-trainer";
import { gradeFromReplayAccuracy } from "@/lib/share-card";
import { getDict } from "@/lib/i18n";

// Node 22 的实验性 localStorage 在 jsdom 下可能不可用，显式提供内存实现。
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
});

// jsdom 无 canvas：用探针替身接管 lightweight-charts。
const mocks = vi.hoisted(() => {
  const series = {
    setData: vi.fn(),
    update: vi.fn(),
    priceScale: () => ({ applyOptions: vi.fn() }),
  };
  const chart = {
    addSeries: vi.fn(() => series),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
  };
  return {
    series,
    chart,
    createChart: vi.fn(() => chart),
    CandlestickSeries: { __kind: "candlestick" },
    fetchKlines: vi.fn(),
    fetchRandomHistoryWindow: vi.fn(),
    measureFps: vi.fn(),
    LOW_END_FPS_THRESHOLD: 24,
    REPLAY_REDUCED_CANDLES: 5,
    saveReplayRecord: vi.fn(),
    saveReplayBest: vi.fn(),
    addStudyTime: vi.fn(),
    shareCard: vi.fn(() => null),
  };
});

vi.mock("lightweight-charts", () => ({
  createChart: mocks.createChart,
  CandlestickSeries: mocks.CandlestickSeries,
}));

vi.mock("@/lib/binance", () => ({
  fetchKlines: mocks.fetchKlines,
  fetchRandomHistoryWindow: mocks.fetchRandomHistoryWindow,
}));

vi.mock("@/lib/perf", () => ({
  measureFps: mocks.measureFps,
  LOW_END_FPS_THRESHOLD: mocks.LOW_END_FPS_THRESHOLD,
  REPLAY_REDUCED_CANDLES: mocks.REPLAY_REDUCED_CANDLES,
}));

vi.mock("@/lib/replay-store", () => ({
  saveReplayRecord: mocks.saveReplayRecord,
  saveReplayBest: mocks.saveReplayBest,
}));

vi.mock("@/lib/study-time", () => ({ addStudyTime: mocks.addStudyTime }));

vi.mock("@/lib/study-time", () => ({ addStudyTime: mocks.addStudyTime }));

/** 日界只允许取自本地日历 helper：哨兵值与任何 UTC 换算结果都不相等，写回 UTC 口径当场红 */
const LOCAL_DAY_END_SENTINEL = 1_700_000_000_123;
const mockLocalDateStr = vi.fn(() => "1970-01-01");
vi.mock("@/lib/date-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/date-utils")>("@/lib/date-utils");
  return {
    ...actual,
    localDateStr: (...args: []) => mockLocalDateStr(...args),
    // 校验照旧（非法日历日仍返回 NaN），只把结果换成 UTC 换算不可能命中的哨兵
    localDayEndMs: (dateStr: string) =>
      Number.isNaN(actual.localDayEndMs(dateStr)) ? Number.NaN : LOCAL_DAY_END_SENTINEL,
  };
});

vi.mock("@/components/replay-share-card", () => ({
  ReplayShareCard: mocks.shareCard,
}));

function makeKlines(count = 300, opts: { rise?: boolean } = {}) {
  const rise = opts.rise ?? true;
  return Array.from({ length: count }, (_, i) => {
    const base = 100 + i;
    const open = base;
    const close = rise ? base + 1 : base - 1;
    return {
      time: 1_700_000_000 + i * 3600,
      open,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      close,
      volume: 10 + i,
    };
  });
}

const dict: ReplayDict = {
  newRound: "新一轮",
  play: "播放",
  pause: "暂停",
  step: "下一根",
  speed: "速度",
  symbolLabel: "交易对",
  intervalLabel: "周期",
  difficultyLabel: "难度",
  difficultyNew: "新手",
  difficultyIntermediate: "进阶",
  difficultyChallenge: "挑战",
  skipToEnd: "跳到结尾",
  modeFree: "自由",
  modeGuess: "竞猜",
  guessPrompt: "猜涨跌",
  up: "涨",
  down: "跌",
  feedbackUp: "上涨",
  feedbackDown: "下跌",
  youGot: "你答对了",
  summaryTitle: "本轮总结",
  streak: "连击",
  best: "最佳",
  accuracy: "正确率",
  rounds: "进度",
  contextNote: "历史上下文",
  fetchError: "行情暂时不可用，请稍后重试",
  disclaimer: "仅为训练用途",
  modeBlind: "盲测",
  modeCustom: "自定义",
  endDateLabel: "截止日期",
  startCustom: "开始",
  shareReplay: "分享",
  previewReplay: "预览",
  download: "下载",
  previewAlt: "预览图",
  copyLink: "复制链接",
  copiedLink: "已复制",
  copyFailed: "复制失败，请手动选择复制",
  downloadFailed: "下载失败",
};

beforeEach(() => {
  store.clear();
  mocks.series.setData.mockClear();
  mocks.series.update.mockClear();
  mocks.createChart.mockClear();
  mocks.chart.remove.mockClear();
  mocks.fetchRandomHistoryWindow.mockReset();
  mocks.fetchRandomHistoryWindow.mockImplementation(async () => makeKlines());
  mocks.fetchKlines.mockReset();
  mocks.fetchKlines.mockImplementation(async () => makeKlines());
  mocks.measureFps.mockReset();
  mocks.measureFps.mockResolvedValue(60);
  mocks.saveReplayRecord.mockClear();
  mocks.saveReplayBest.mockClear();
  mocks.addStudyTime.mockClear();
  mocks.shareCard.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReplayTrainer 难度切换（回归：难度变更必须重置上下文）", () => {
  it("切换难度会重新载入历史窗口并把起点对齐到新的上下文根数", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);

    // 默认「进阶」= 30 根上下文 → 300 - 30 = 270 根可推进
    await waitFor(() => expect(screen.getByText(/0\/270/)).toBeInTheDocument());
    expect(mocks.fetchRandomHistoryWindow).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "挑战" }));

    // 「挑战」= 15 根上下文 → 起点必须跟着回到 15，否则会显示 15/285
    await waitFor(() => expect(screen.getByText(/0\/285/)).toBeInTheDocument());
    expect(screen.queryByText(/15\/285/)).toBeNull();
    expect(mocks.fetchRandomHistoryWindow).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(mocks.series.setData.mock.lastCall?.[0]).toHaveLength(15));
  });
});

describe("ReplayTrainer 难度持久化与脏数据兜底", () => {
  it("记住用户选择的难度", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(mocks.fetchRandomHistoryWindow).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "新手" }));
    await waitFor(() => expect(store.get("tb-replay-difficulty")).toBe("0"));
    expect(screen.getByRole("button", { name: "新手" })).toHaveAttribute("aria-pressed", "true");
  });

  it("读取已保存的合法难度", async () => {
    store.set("tb-replay-difficulty", "2");
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/285/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "挑战" })).toHaveAttribute("aria-pressed", "true");
  });

  it("脏数据（非数字）不会让组件崩溃，回退到默认难度", async () => {
    store.set("tb-replay-difficulty", "abc");
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/270/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "进阶" })).toHaveAttribute("aria-pressed", "true");
  });

  it("越界索引不会让组件崩溃，回退到默认难度", async () => {
    store.set("tb-replay-difficulty", "9");
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/270/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "进阶" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("ReplayTrainer 数据加载", () => {
  it("切换交易对与周期都会重新拉取历史窗口", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(mocks.fetchRandomHistoryWindow).toHaveBeenCalledTimes(1));
    expect(mocks.fetchRandomHistoryWindow).toHaveBeenLastCalledWith("BTCUSDT", "1h");

    fireEvent.change(screen.getByLabelText("交易对"), { target: { value: "ETHUSDT" } });
    await waitFor(() => expect(mocks.fetchRandomHistoryWindow).toHaveBeenCalledTimes(2));
    expect(mocks.fetchRandomHistoryWindow).toHaveBeenLastCalledWith("ETHUSDT", "1h");

    fireEvent.change(screen.getByLabelText("周期"), { target: { value: "4h" } });
    await waitFor(() => expect(mocks.fetchRandomHistoryWindow).toHaveBeenCalledTimes(3));
    expect(mocks.fetchRandomHistoryWindow).toHaveBeenLastCalledWith("ETHUSDT", "4h");
  });

  it("拉取失败时显示不可用提示", async () => {
    mocks.fetchRandomHistoryWindow.mockRejectedValueOnce(new Error("boom"));
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText("行情暂时不可用，请稍后重试")).toBeInTheDocument());
  });

  it("自定义截止日期走 fetchKlines 并开启新回合", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(mocks.fetchRandomHistoryWindow).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "自定义" }));
    const dateInput = screen.getByLabelText("截止日期") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2024-01-15" } });
    fireEvent.click(screen.getByRole("button", { name: "开始" }));

    await waitFor(() => expect(mocks.fetchKlines).toHaveBeenCalledTimes(1));
    const [symbol, interval, opts] = mocks.fetchKlines.mock.calls[0];
    expect(symbol).toBe("BTCUSDT");
    expect(interval).toBe("1h");
    expect(opts).toMatchObject({ limit: 300 });
    // 上界一律交给本地日历 helper 换算；组件自己拼 UTC 午夜就会砍掉当天尾部
    expect(opts.endTime).toBe(LOCAL_DAY_END_SENTINEL);
    // 无效日期不触发新回合
    fireEvent.change(screen.getByLabelText("截止日期"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "开始" }));
    expect(mocks.fetchKlines).toHaveBeenCalledTimes(1);
  });
});

describe("ReplayTrainer 自由模式控制", () => {
  it("下一根推进一根 K 线，跳过直接到底", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/270/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "下一根" }));
    expect(screen.getByText(/1\/270/)).toBeInTheDocument();
    expect(mocks.series.update).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "跳到结尾" }));
    expect(screen.getByText(/270\/270/)).toBeInTheDocument();
    // 跳到结尾必须真的把整段填进图表：播放推进走逐根 update()，全量 setData 只在数据变化
    // 那一刻跑，所以过去只改下标的写法会让图停在上一次的位置，而计数已经在说 270/270。
    const filled = mocks.series.setData.mock.lastCall?.[0] as unknown[] | undefined;
    expect(filled, "跳末之后图表应拿到整段 300 根").toHaveLength(300);
    // 到底后播放按钮禁用
    expect(screen.getByRole("button", { name: "播放" })).toBeDisabled();
  });

  it("播放/暂停切换，暂停后不再自动推进", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/270/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "4x" }));
    fireEvent.click(screen.getByRole("button", { name: "播放" }));
    expect(screen.getByRole("button", { name: "暂停" })).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => expect(screen.getByText(/[1-9]\d*\/270/)).toBeInTheDocument(), {
      timeout: 3000,
    });

    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    expect(screen.getByRole("button", { name: "播放" })).toHaveAttribute("aria-pressed", "false");
    const progressed = screen.getByText(/进度: \d+\/270/).textContent;
    // 探针必须跨过「所选倍速下至少两个 tick」，否则暂停失效也照样通过：
    // 等待时长跟着 SPEEDS 走，档位一改这里不会悄悄失去效力。
    const tickMs = 1000 / Math.max(...SPEEDS);
    await new Promise((r) => setTimeout(r, tickMs * 2 + 200));
    expect(screen.getByText(/进度: \d+\/270/).textContent).toBe(progressed);
  });

  it("切换倍速只改变选中态", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/270/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "2x" }));
    expect(screen.getByRole("button", { name: "2x" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1x" })).toHaveAttribute("aria-pressed", "false");
  });

  it("页面隐藏时自动暂停", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/270/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "播放" }));
    expect(screen.getByRole("button", { name: "暂停" })).toBeInTheDocument();

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("button", { name: "播放" })).toBeInTheDocument();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });
});

describe("ReplayTrainer 低端机降级（R7.3）", () => {
  it("帧率不达标时只渲染最近 REPLAY_REDUCED_CANDLES 根", async () => {
    mocks.measureFps.mockResolvedValue(10);
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => {
      const last = mocks.series.setData.mock.lastCall?.[0] as unknown[] | undefined;
      expect(Array.isArray(last)).toBe(true);
      expect(last).toHaveLength(mocks.REPLAY_REDUCED_CANDLES);
    });
  });
});

describe("ReplayTrainer 竞猜模式与战绩", () => {
  beforeEach(() => {
    mocks.fetchRandomHistoryWindow.mockImplementation(async () => makeKlines(32));
  });

  it("猜中累计连击，答错清零", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/2/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "自由" }));
    fireEvent.click(screen.getByRole("button", { name: "涨" }));
    await waitFor(() => expect(screen.getByText(/上涨 · ✅/)).toBeInTheDocument());
    expect(screen.getByText(/进度: 1\/2/)).toBeInTheDocument();
  });

  it("答错时给出下跌反馈并清零连击", async () => {
    mocks.fetchRandomHistoryWindow.mockImplementation(async () => makeKlines(32, { rise: false }));
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/2/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "自由" }));
    fireEvent.click(screen.getByRole("button", { name: "涨" }));
    await waitFor(() => expect(screen.getByText(/下跌 · ❌/)).toBeInTheDocument());
  });

  it("完成整轮后给出评价、记录战绩并交给分享卡", async () => {
    let tick = 0;
    vi.spyOn(Date, "now").mockImplementation(() => 1_700_000_000_000 + tick++ * 1000);
    mocks.shareCard.mockImplementation(() => null);

    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/2/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "自由" }));
    fireEvent.click(screen.getByRole("button", { name: "涨" }));
    await waitFor(() => expect(screen.getByText(/进度: 1\/2/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "涨" }));
    await waitFor(() => expect(screen.getByText(/进度: 2\/2/)).toBeInTheDocument());

    // 面板大字与同一块面板里的分享卡必须同一个评级：2/2 曾显示 S，
    // 而完全相同的数字画到卡上是 C（样本 <3 不给评级，见 share-card.test.ts）。
    const [cardProps] = mocks.shareCard.mock.calls.at(-1) as unknown as [
      { shareUrl?: string; correct: number; total: number; accuracy: number },
    ];
    expect(gradeFromReplayAccuracy(cardProps.accuracy, cardProps.total)).toBe("C");
    expect(screen.getByText("本轮总结")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();

    // 首轮（round=0）就必须入库，且只入库一次
    await waitFor(() => expect(mocks.saveReplayRecord).toHaveBeenCalledTimes(1));
    expect(mocks.saveReplayRecord).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "BTCUSDT", interval: "1h", total: 2, correct: 2, bestStreak: 2 }),
    );
    await waitFor(() => expect(mocks.addStudyTime).toHaveBeenCalledWith("replay", expect.any(Number)));

    expect(cardProps.correct).toBe(2);
    expect(cardProps.total).toBe(2);
    expect(cardProps.shareUrl).toMatch(/^http:\/\/localhost:\d+\/share\/replay\//);
  });

  it("全错时评价为 C 且最佳连击为 0", async () => {
    mocks.fetchRandomHistoryWindow.mockImplementation(async () => makeKlines(32, { rise: false }));
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/2/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "自由" }));
    fireEvent.click(screen.getByRole("button", { name: "涨" }));
    await waitFor(() => expect(screen.getByText(/进度: 1\/2/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "涨" }));
    await waitFor(() => expect(screen.getByText(/进度: 2\/2/)).toBeInTheDocument());

    expect(screen.getByText("C")).toBeInTheDocument();
    // 答错时也会把最新最佳连击（0）写回
    expect(mocks.saveReplayBest).toHaveBeenCalledWith(0);
  });

  it("连胜两轮各入一条记录，不多不少", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/2/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "自由" }));
    fireEvent.click(screen.getByRole("button", { name: "涨" }));
    await waitFor(() => expect(screen.getByText(/进度: 1\/2/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "涨" }));
    await waitFor(() => expect(screen.getByText(/进度: 2\/2/)).toBeInTheDocument());
    await waitFor(() => expect(mocks.saveReplayRecord).toHaveBeenCalledTimes(1));

    // 第二轮（完成后总结区也会出现「新一轮」，取顶栏那个）
    fireEvent.click(screen.getAllByRole("button", { name: "新一轮" })[0]);
    await waitFor(() => expect(screen.getByText(/进度: 0\/2/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "涨" }));
    await waitFor(() => expect(screen.getByText(/进度: 1\/2/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "涨" }));
    await waitFor(() => expect(screen.getByText(/进度: 2\/2/)).toBeInTheDocument());
    await waitFor(() => expect(mocks.saveReplayRecord).toHaveBeenCalledTimes(2));
  });

  it("竞猜模式下按空格等非预测操作不推进，必须先预测", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/2/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "自由" }));
    // 竞猜模式下没有「下一根」按钮
    expect(screen.queryByRole("button", { name: "下一根" })).toBeNull();
    expect(screen.getByText(/进度: 0\/2/)).toBeInTheDocument();
  });

  it("新一轮会清空上一轮反馈并重置进度", async () => {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(screen.getByText(/0\/2/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "自由" }));
    fireEvent.click(screen.getByRole("button", { name: "涨" }));
    await waitFor(() => expect(screen.getByText(/上涨 · ✅/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "新一轮" }));
    await waitFor(() => expect(screen.getByText(/进度: 0\/2/)).toBeInTheDocument());
    expect(screen.queryByText(/上涨 · ✅/)).toBeNull();
  });
});

describe("ReplayTrainer 图表生命周期", () => {
  it("挂载时创建图表、卸载时销毁", async () => {
    const { unmount } = render(<ReplayTrainer dict={dict} locale="zh" />);
    await waitFor(() => expect(mocks.createChart).toHaveBeenCalledTimes(1));
    unmount();
    expect(mocks.chart.remove).toHaveBeenCalledTimes(1);
  });
});

/**
 * 背景根数是难度档位的属性（新手 50 / 进阶 30 / 挑战 15），而控件下方那句说明
 * 曾经写死「前 30 根…从第 31 根开始」——选了别的难度，界面仍在报中间档的数。
 */
describe("ReplayTrainer 上下文说明跟着难度变", () => {
  const realZh = { ...dict, contextNote: getDict("zh").replay.contextNote };
  const realEn = { ...dict, contextNote: getDict("en").replay.contextNote };

  it("占位符必须真的在模板里，否则下面的断言会退化成匹配静态数字", () => {
    for (const locale of ["zh", "en"] as const) {
      const note = getDict(locale).replay.contextNote;
      expect(note, locale).toContain("{n}");
      expect(note, locale).toContain("{m}");
      expect(note, `模板里不该再留着写死的 30（${locale}）`).not.toMatch(/30|31/);
    }
  });

  it.each([
    ["新手", 50],
    ["进阶", 30],
    ["挑战", 15],
  ] as const)("中文选「%s」时说明写成 %i 根背景", async (label, context) => {
    render(<ReplayTrainer dict={realZh} locale="zh" />);
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() =>
      expect(screen.getByText(`前 ${context} 根为背景走势，从第 ${context + 1} 根开始回放。`)).toBeInTheDocument(),
    );
  });

  it("英文档位切换后说明同步（First 15 … starts from #16）", async () => {
    render(<ReplayTrainer dict={realEn} locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "挑战" }));
    await waitFor(() =>
      expect(screen.getByText("First 15 candles are context; replay starts from #16.")).toBeInTheDocument(),
    );
  });
});

describe("ReplayTrainer 截止日界取本地日历", () => {
  function openCustomMode(): HTMLInputElement {
    render(<ReplayTrainer dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText(dict.modeCustom));
    const input = document.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    return input as HTMLInputElement;
  }

  beforeEach(() => {
    mockLocalDateStr.mockReset();
  });

  it("日期上限与默认值都取自本地日历，不是 UTC 口径", () => {
    mockLocalDateStr.mockReturnValue("2019-03-04");
    const input = openCustomMode();

    // 哨兵值不可能是今天的 UTC 日期：写回 toISOString() 时这里必红
    expect(input.getAttribute("max")).toBe("2019-03-04");
    expect(input.value).toBe("2019-03-04");
    expect(new Date().toISOString().slice(0, 10)).not.toBe("2019-03-04");
  });

  it("默认截止日界是本地「今天」往前 30 天", () => {
    const seen: Date[] = [];
    mockLocalDateStr.mockImplementation((d?: Date) => {
      if (d) seen.push(d);
      return "2019-03-04";
    });
    openCustomMode();

    const thirtyDaysAgo = seen.find(
      (d) => Math.abs(Date.now() - 30 * 86400_000 - d.getTime()) < 5_000,
    );
    expect(thirtyDaysAgo, "初始值应由 localDateStr(30 天前) 得出").toBeDefined();
  });
});
