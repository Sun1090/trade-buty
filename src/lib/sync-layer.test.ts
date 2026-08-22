import { describe, expect, it } from "vitest";
import {
  mergeProgress,
  mergeWrongbook,
  mergeQuizScore,
  mergeReplayHistory,
  mergeReplayBest,
} from "./sync-layer";
import type { ProgressMap } from "./progress";
import type { WrongEntry } from "./wrongbook";
import type { ReplayRecord } from "./replay-store";

describe("mergeProgress", () => {
  it("本地与云端取并集", () => {
    const local: ProgressMap = { "getting-started": ["doc-a", "doc-b"] };
    const cloud = [
      { chapter_num: "getting-started", doc_slug: "doc-b" },
      { chapter_num: "getting-started", doc_slug: "doc-c" },
      { chapter_num: "futures", doc_slug: "margin" },
    ];
    const out = mergeProgress(local, cloud);
    expect(out["getting-started"].sort()).toEqual(["doc-a", "doc-b", "doc-c"]);
    expect(out["futures"]).toEqual(["margin"]);
  });

  it("云端重复不膨胀", () => {
    const out = mergeProgress({}, [
      { chapter_num: "ch1", doc_slug: "d1" },
      { chapter_num: "ch1", doc_slug: "d1" },
    ]);
    expect(out.ch1).toEqual(["d1"]);
  });

  it("本地为空时只用云端", () => {
    expect(mergeProgress({}, [{ chapter_num: "ch", doc_slug: "d" }])).toEqual({ ch: ["d"] });
  });
});

describe("mergeWrongbook", () => {
  it("并集，冲突取较新 at", () => {
    const local: Record<string, WrongEntry> = {
      "ch1:0": { chapterNum: "ch1", questionIdx: 0, picked: 1, at: 1000 },
    };
    const cloud = [
      { chapter_num: "ch1", question_idx: 0, picked: 2, answered_at: "2000-01-01T00:00:02Z" }, // 更新 → 覆盖
      { chapter_num: "ch2", question_idx: 1, picked: 3, answered_at: "2000-01-01T00:00:00Z" }, // 新增
    ];
    const out = mergeWrongbook(local, cloud);
    expect(out["ch1:0"].picked).toBe(2); // 云端较新
    expect(out["ch2:1"].picked).toBe(3);
  });

  it("本地较新时不被覆盖", () => {
    const local: Record<string, WrongEntry> = {
      "ch1:0": { chapterNum: "ch1", questionIdx: 0, picked: 1, at: 946684800999 }, // 比 2000-01-01 大
    };
    const cloud = [
      { chapter_num: "ch1", question_idx: 0, picked: 2, answered_at: "2000-01-01T00:00:00Z" },
    ];
    const out = mergeWrongbook(local, cloud);
    expect(out["ch1:0"].picked).toBe(1); // 本地较新，保留
  });
});

describe("mergeQuizScore", () => {
  it("取 max best", () => {
    const out = mergeQuizScore({ best: 8, done: true }, { chapter_num: "ch1", best: 6, total: 10, done: true });
    expect(out.best).toBe(8);
  });

  it("云端更高时取云端", () => {
    const out = mergeQuizScore({ best: 3, done: true }, { chapter_num: "ch1", best: 9, total: 10, done: true });
    expect(out.best).toBe(9);
  });

  it("本地无记录时取云端", () => {
    const out = mergeQuizScore(null, { chapter_num: "ch1", best: 5, total: 10, done: true });
    expect(out).toEqual({ best: 5, done: true });
  });
});

describe("mergeReplayHistory", () => {
  const mkRec = (at: number, sym = "BTCUSDT"): ReplayRecord => ({
    at, symbol: sym, interval: "1h", total: 10, correct: 5, bestStreak: 3,
  });

  it("并集去重", () => {
    const local = [mkRec(1000), mkRec(2000)];
    const cloud = [
      { symbol: "BTCUSDT", interval: "1h", total: 10, correct: 5, best_streak: 3, recorded_at: "1970-01-01T00:00:01Z" }, // dup
      { symbol: "ETHUSDT", interval: "1h", total: 8, correct: 4, best_streak: 2, recorded_at: "1970-01-01T00:00:03Z" },
    ];
    const out = mergeReplayHistory(local, cloud);
    expect(out.length).toBe(3);
    expect(out.map((r) => r.symbol)).toEqual(["BTCUSDT", "BTCUSDT", "ETHUSDT"]);
  });

  it("超过 100 条只保留最近 100", () => {
    const local = Array.from({ length: 90 }, (_, i) => mkRec(i));
    const cloud = Array.from({ length: 30 }, (_, i) => ({
      symbol: "ETHUSDT", interval: "1h", total: 10, correct: 5, best_streak: 3,
      recorded_at: new Date(100 + i).toISOString(),
    }));
    const out = mergeReplayHistory(local, cloud);
    expect(out.length).toBe(100);
  });

  it("按 at 升序排列", () => {
    const local = [mkRec(3000), mkRec(1000)];
    const cloud = [{ symbol: "X", interval: "1h", total: 1, correct: 1, best_streak: 1, recorded_at: "1970-01-01T00:00:20Z" }];
    const out = mergeReplayHistory(local, cloud);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].at).toBeGreaterThanOrEqual(out[i - 1].at);
    }
  });
});

describe("mergeReplayBest", () => {
  it("取 max", () => {
    expect(mergeReplayBest(5, 8)).toBe(8);
    expect(mergeReplayBest(10, 3)).toBe(10);
    expect(mergeReplayBest(0, 0)).toBe(0);
  });
});
