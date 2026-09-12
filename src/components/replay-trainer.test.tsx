// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReplayTrainer, type ReplayDict } from "./replay-trainer";

// Node 22 的实验性 localStorage 在 jsdom 下可能不可用，显式提供内存实现。
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
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
  measureFps: () => Promise.resolve(60),
  LOW_END_FPS_THRESHOLD: 24,
  REPLAY_REDUCED_CANDLES: 150,
}));

function makeKlines(count = 300) {
  return Array.from({ length: count }, (_, i) => ({
    time: 1_700_000_000 + i * 3600,
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 101 + i,
    volume: 10 + i,
  }));
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
  downloadFailed: "下载失败",
};

describe("ReplayTrainer 难度切换（回归：难度变更必须重置上下文）", () => {
  beforeEach(() => {
    store.clear();
    mocks.series.setData.mockClear();
    mocks.fetchRandomHistoryWindow.mockReset();
    mocks.fetchRandomHistoryWindow.mockImplementation(async () => makeKlines());
  });

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
    // 图表只渲染到新的起点位置
    expect(mocks.series.setData.mock.lastCall?.[0]).toHaveLength(15);
  });
});
