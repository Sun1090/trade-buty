// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { aggregateStats, BADGES, getUnlockedBadges, readSummary, type LearnStats } from "./learn-stats";
import { QUIZZES } from "./quizzes";
import { quizScorePct } from "./quiz-score";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

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

  it("「没错题」这枚需要 readDocs>0", () => {
    // readDocs=0 时即使错题=0 也不解锁
    expect(getUnlockedBadges({ ...base, readDocs: 0, currentWrong: 0 }).map((b) => b.id)).not.toContain("wrongbook-empty");
    // readDocs>0 时才解锁
    expect(getUnlockedBadges({ ...base, readDocs: 1, currentWrong: 0 }).map((b) => b.id)).toContain("wrongbook-empty");
  });

  /**
   * 徽章是从这里的数据数组直接渲染成界面文字的，`check:localized-labels` 看不到
   * （它扫的是 JSX 属性与文本节点），所以两版文字由用例守着。
   */
  describe("徽章文案两版齐全", () => {
    const CJK = /[㐀-鿿぀-ヿ가-힣]/;
    it("每一枚都有中英名称与条件，英文版里不留汉字", () => {
      for (const badge of BADGES) {
        expect(badge.name.zh.length, `${badge.id} 缺中文名称`).toBeGreaterThan(0);
        expect(badge.name.en.length, `${badge.id} 缺英文名称`).toBeGreaterThan(0);
        expect(badge.desc.zh.length, `${badge.id} 缺中文条件`).toBeGreaterThan(0);
        expect(badge.desc.en.length, `${badge.id} 缺英文条件`).toBeGreaterThan(0);
        expect(CJK.test(badge.name.en), `${badge.id} 英文名称含汉字`).toBe(false);
        expect(CJK.test(badge.desc.en), `${badge.id} 英文条件含汉字`).toBe(false);
      }
    });

    it("解锁条件是「此刻错题本为空」，不许写成用户清过错题", () => {
      // check 只看当下的 currentWrong，数据里没有任何「曾经错过」的历史
      const badge = BADGES.find((b) => b.id === "wrongbook-empty");
      const zh = `${badge.name.zh}${badge.desc.zh}`;
      const en = `${badge.name.en} ${badge.desc.en}`.toLowerCase();
      expect(zh).not.toMatch(/清零|清空/);
      expect(en).not.toMatch(/clear(ed)? ?up|cleared/);
    });
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

describe("aggregateStats quiz caliber", () => {
  beforeEach(() => store.clear());

  /**
   * R16.11：`avgQuizScore` 是各章最高百分比的**均值**，统计页把它标成 `avgBestPct`。
   * 两个分数刻意拉开差距：若实现回退成「取最好的一次」这条必须红。
   */
  it("是各章最高分的均值，不是其中最高的那个", () => {
    const [first, second] = Object.keys(QUIZZES);
    const totalA = QUIZZES[first].questions.length;
    const totalB = QUIZZES[second].questions.length;
    store.set(`tb-quiz-${first}`, JSON.stringify({ best: totalA, done: true }));
    store.set(`tb-quiz-${second}`, JSON.stringify({ best: 0, done: true }));

    const stats = aggregateStats([{ slug: first, docCount: 1 }]);

    const pctA = quizScorePct(totalA, totalA);
    const pctB = quizScorePct(0, totalB);
    expect(pctA).not.toBe(pctB);
    expect(stats.quizzesDone).toBe(2);
    expect(stats.avgQuizScore).toBe(Math.round((pctA + pctB) / 2));
    expect(stats.avgQuizScore).toBeLessThan(pctA);
  });

  it("只把已完成的篇章计入均值", () => {
    const [first, second] = Object.keys(QUIZZES);
    store.set(`tb-quiz-${first}`, JSON.stringify({ best: QUIZZES[first].questions.length, done: true }));
    store.set(`tb-quiz-${second}`, JSON.stringify({ best: QUIZZES[second].questions.length, done: false }));

    // 未完成的那一章不进分母：均值就是已完成那一章自己的分数
    expect(aggregateStats([]).avgQuizScore).toBe(100);

    store.set(`tb-quiz-${first}`, JSON.stringify({ best: 1, done: false }));
    expect(aggregateStats([]).avgQuizScore).toBeNull();
  });
});

describe("readSummary", () => {
  const chapters = [
    { slug: "a", docCount: 2 },
    { slug: "b", docCount: 2 },
  ];

  it("按篇章汇总已读数、完成篇章数与百分比", () => {
    expect(readSummary({ a: ["x", "y"], b: ["x"] }, chapters)).toEqual({
      readDocs: 3,
      totalDocs: 4,
      doneChapters: 1,
      overallPct: 75,
    });
  });

  it("旧已读键不存在的课：按篇章课数封顶，完成度不会超过 100%", () => {
    expect(readSummary({ a: ["x", "y", "z"], b: ["x", "y", "z"] }, chapters)).toEqual({
      readDocs: 4,
      totalDocs: 4,
      doneChapters: 2,
      overallPct: 100,
    });
  });

  it("没有篇章时不除零", () => {
    expect(readSummary({}, []).overallPct).toBe(0);
  });
});
