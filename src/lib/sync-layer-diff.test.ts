import { describe, it, expect } from "vitest";
import { diffMergeSummary } from "./sync-layer";
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
    expect(summary.quizImprovements).toBe(0);
    expect(summary.newReplays).toBe(1); // replay-history append-only：1 cloud row = 1 new
    expect(summary.hasAny).toBe(true); // 仅 replay 一项也算新
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

  it("云端测验成绩更高 → quizImprovements 计数", () => {
    const local = { ch1: { best: 5, done: true } };
    const cloud = [
      { chapter_num: "ch1", best: 8, total: 10, done: true },
      { chapter_num: "ch2", best: 9, total: 10, done: true },
    ];
    const summary = diffMergeSummary(
      {}, [], {}, [], local, cloud, [], [],
    );
    expect(summary.quizImprovements).toBe(2);
  });

  it("云端测验成绩相等时不计为 improvement", () => {
    const local = { ch1: { best: 8, done: true } };
    const cloud = [{ chapter_num: "ch1", best: 8, total: 10, done: true }];
    const summary = diffMergeSummary(
      {}, [], {}, [], local, cloud, [], [],
    );
    expect(summary.quizImprovements).toBe(0);
  });

  it("本地无此 chapter 但云端有也算 improvement", () => {
    const cloud = [{ chapter_num: "ch1", best: 5, total: 10, done: true }];
    const summary = diffMergeSummary(
      {}, [], {}, [], {}, cloud, [], [],
    );
    expect(summary.quizImprovements).toBe(1);
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
      quizImprovements: 1,
      newReplays: 0,
      hasAny: true,
    });
  });
});
