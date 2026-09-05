import { describe, it, expect } from "vitest";
import { BADGES, getUnlockedBadges, type LearnStats } from "./learn-stats";

const base: LearnStats = {
  totalDocs: 100,
  readDocs: 0,
  doneChapters: 0,
  totalChapters: 27,
  wrongCount: 0,
  currentWrong: 0,
  quizzesDone: 0,
  totalQuizzes: 27,
  avgQuizScore: null,
  replayRounds: 0,
  replayAccuracy: null,
  replayBest: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalReadingTime: 0,
  totalStudySeconds: 0,
  overallPct: 0,
};

describe("BADGES", () => {
  it("10 个徽章", () => {
    expect(BADGES.length).toBe(10);
  });

  it("每个徽章有 id/icon/name/desc/check", () => {
    for (const b of BADGES) {
      expect(b.id).toBeTruthy();
      expect(b.icon).toBeTruthy();
      expect(b.name).toBeTruthy();
      expect(b.desc).toBeTruthy();
      expect(typeof b.check).toBe("function");
    }
  });
});

describe("getUnlockedBadges", () => {
  it("空 stats 无徽章", () => {
    expect(getUnlockedBadges(base)).toHaveLength(0);
  });

  it("第一步：读 1 篇", () => {
    const out = getUnlockedBadges({ ...base, readDocs: 1 });
    expect(out.map((b) => b.id)).toContain("first-step");
  });

  it("过半：读 50%", () => {
    const out = getUnlockedBadges({ ...base, readDocs: 50, overallPct: 50 });
    expect(out.map((b) => b.id)).toContain("halfway");
  });

  it("回放连击王：best≥5", () => {
    const out = getUnlockedBadges({ ...base, replayBest: 5 });
    expect(out.map((b) => b.id)).toContain("replay-streak-5");
  });

  it("七日坚持：streak≥7", () => {
    const out = getUnlockedBadges({ ...base, longestStreak: 7 });
    expect(out.map((b) => b.id)).toContain("streak-7");
  });

  it("测验达人：quizzesDone≥5", () => {
    const out = getUnlockedBadges({ ...base, quizzesDone: 5 });
    expect(out.map((b) => b.id)).toContain("quiz-master");
  });

  it("清空错题需要 readDocs>0", () => {
    // readDocs=0 时即使错题=0 也不解锁
    expect(getUnlockedBadges({ ...base, readDocs: 0, currentWrong: 0 }).map((b) => b.id)).not.toContain("wrongbook-empty");
    // readDocs>0 时才解锁
    expect(getUnlockedBadges({ ...base, readDocs: 1, currentWrong: 0 }).map((b) => b.id)).toContain("wrongbook-empty");
  });

  it("全满 stats 解锁全部", () => {
    const full: LearnStats = {
      totalDocs: 100,
      readDocs: 60,
      doneChapters: 5,
      totalChapters: 27,
      wrongCount: 0,
      currentWrong: 0,
      quizzesDone: 10,
      totalQuizzes: 27,
      avgQuizScore: 80,
      replayRounds: 10,
      replayAccuracy: 70,
      replayBest: 8,
      currentStreak: 30,
      longestStreak: 30,
      totalReadingTime: 3600,
      totalStudySeconds: 7200,
      overallPct: 60,
    };
    const out = getUnlockedBadges(full);
    expect(out.length).toBe(BADGES.length);
  });
});
