import { describe, it, expect } from "vitest";
import { diffMergeSummary, mergeReplayHistory } from "./sync-layer";
import type { ProgressMap } from "./progress";
import type { WrongEntry } from "./wrongbook";
import type { ReplayRecord } from "./replay-store";

describe("diffMergeSummary", () => {
  it("本地与云端完全相同时 hasAny=false", () => {
    const localProgress: ProgressMap = { "getting-started": ["doc-a"] };
    const localWrong: Record<string, WrongEntry> = {
      "ch1:0": { chapterNum: "ch1", questionIdx: 0, picked: 1, at: 1000 },
    };
    const localQuiz = { ch1: { best: 8, done: true } };
    const localReplay: ReplayRecord[] = [
      { at: 100, symbol: "BTCUSDT", interval: "1h", total: 10, correct: 5, bestStreak: 3 },
    ];
    const summary = diffMergeSummary(
      localProgress,
      [{ chapter_num: "getting-started", doc_slug: "doc-a" }],
      localWrong,
      [{ chapter_num: "ch1", question_idx: 0, picked: 1, answered_at: "1970-01-01T00:00:01Z" }],
      localQuiz,
      [{ chapter_num: "ch1", best: 8, total: 10, done: true }],
      localReplay,
      [{ symbol: "BTCUSDT", interval: "1h", total: 10, correct: 5, best_streak: 3, recorded_at: "1970-01-01T00:00:00.100Z" }],
    );
    expect(summary.newProgress).toBe(0);
    expect(summary.newWrong).toBe(0);
    expect(summary.quizFromCloud).toBe(0);
    // 这一轮就是本机自己上传云端的（指纹相同、时间只差打点），合并不会带它进来
    expect(summary.newReplays).toBe(0);
    expect(summary.hasAny).toBe(false);
  });

  it("回放摘要只数合并真正带入的轮次，云端重复行算一次", () => {
    const localReplay: ReplayRecord[] = [
      { at: 100, symbol: "BTCUSDT", interval: "1h", total: 10, correct: 5, bestStreak: 3 },
    ];
    const cloudReplay = [
      // 本机上传的那一轮（recorded_at 晚 200ms）
      { symbol: "BTCUSDT", interval: "1h", total: 10, correct: 5, best_streak: 3, recorded_at: "1970-01-01T00:00:00.300Z" },
      // 另一台设备的一轮
      { symbol: "ETHUSDT", interval: "15m", total: 20, correct: 18, best_streak: 12, recorded_at: "1970-01-02T00:00:00Z" },
      // 云端重复行（append-only 表没有唯一约束）
      { symbol: "ETHUSDT", interval: "15m", total: 20, correct: 18, best_streak: 12, recorded_at: "1970-01-02T00:00:00Z" },
      // 坏时间戳：合并会跳过，摘要也不能算它
      { symbol: "XRPUSDT", interval: "1d", total: 5, correct: 1, best_streak: 1, recorded_at: "not-a-date" },
    ];
    const summary = diffMergeSummary({}, [], {}, [], {}, [], localReplay, cloudReplay);
    expect(summary.newReplays).toBe(1);
    expect(summary.hasAny).toBe(true);
    // 同一批数据、同一把尺子：摘要说带入几轮，合并就多出几轮
    expect(mergeReplayHistory(localReplay, cloudReplay).length).toBe(localReplay.length + summary.newReplays);
  });

  it("云端有本地没有的进度 → newProgress 计数", () => {
    const local: ProgressMap = { "getting-started": ["doc-a"] };
    const cloud = [
      { chapter_num: "getting-started", doc_slug: "doc-a" },
      { chapter_num: "getting-started", doc_slug: "doc-b" },
      { chapter_num: "futures", doc_slug: "margin" },
    ];
    const summary = diffMergeSummary(
      local, cloud, {}, [], {}, [], [], [],
    );
    expect(summary.newProgress).toBe(2);
    expect(summary.hasAny).toBe(true);
  });

  it("云端有本地没有的错题 → newWrong 计数", () => {
    const local: Record<string, WrongEntry> = {
      "ch1:0": { chapterNum: "ch1", questionIdx: 0, picked: 1, at: 1000 },
    };
    const cloud = [
      { chapter_num: "ch1", question_idx: 0, picked: 1, answered_at: "1970-01-01T00:00:01Z" },
      { chapter_num: "ch1", question_idx: 1, picked: 2, answered_at: "1970-01-01T00:00:02Z" },
      { chapter_num: "ch2", question_idx: 0, picked: 0, answered_at: "1970-01-01T00:00:03Z" },
    ];
    const summary = diffMergeSummary(
      {}, [], local, cloud, {}, [], [], [],
    );
    expect(summary.newWrong).toBe(2);
  });

  it("云端测验成绩更高 → quizFromCloud 计数", () => {
    const local = { ch1: { best: 5, done: true } };
    const cloud = [
      { chapter_num: "ch1", best: 8, total: 10, done: true },
      { chapter_num: "ch2", best: 9, total: 10, done: true },
    ];
    const summary = diffMergeSummary(
      {}, [], {}, [], local, cloud, [], [],
    );
    expect(summary.quizFromCloud).toBe(2);
  });

  it("云端测验成绩相等时不计入（覆盖必须是真更高）", () => {
    const local = { ch1: { best: 8, done: true } };
    const cloud = [{ chapter_num: "ch1", best: 8, total: 10, done: true }];
    const summary = diffMergeSummary(
      {}, [], {}, [], local, cloud, [], [],
    );
    expect(summary.quizFromCloud).toBe(0);
  });

  it("本地没有这一章、云端带来一个分数，也算「从云端来」（它不是一次提升）", () => {
    const cloud = [{ chapter_num: "ch1", best: 5, total: 10, done: true }];
    const summary = diffMergeSummary(
      {}, [], {}, [], {}, cloud, [], [],
    );
    expect(summary.quizFromCloud).toBe(1);
  });

  it("多种合并：summary 同时有多个非零字段", () => {
    const localProgress: ProgressMap = { "getting-started": ["doc-a"] };
    const localWrong: Record<string, WrongEntry> = {};
    const localQuiz = { ch1: { best: 3, done: true } };
    const summary = diffMergeSummary(
      localProgress,
      [
        { chapter_num: "getting-started", doc_slug: "doc-a" },
        { chapter_num: "getting-started", doc_slug: "doc-b" },
        { chapter_num: "futures", doc_slug: "margin" },
      ],
      localWrong,
      [{ chapter_num: "ch1", question_idx: 0, picked: 2, answered_at: "2026-01-01T00:00:00Z" }],
      localQuiz,
      [{ chapter_num: "ch1", best: 9, total: 10, done: true }],
      [],
      [],
    );
    expect(summary).toEqual({
      newProgress: 2,
      newWrong: 1,
      quizFromCloud: 1,
      newReplays: 0,
      hasAny: true,
    });
  });
});
