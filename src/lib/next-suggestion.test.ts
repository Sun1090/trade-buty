import { describe, expect, it } from "vitest";
import { buildNextSuggestion } from "./next-suggestion";
import { STATS_DICTS } from "./i18n-stats";

describe("buildNextSuggestion", () => {
  it("prioritizes due reviews above everything else", () => {
    const result = buildNextSuggestion({
      dueReviews: 4,
      nextUnread: { chapter: "spot", chapterTitle: "01 · 现货", doc: "order-types", docTitle: "02 · 订单" },
      pendingQuizChapter: { chapter: "spot", chapterTitle: "01 · 现货" },
      replayRounds: 0,
      locale: "zh",
    });
    expect(result).toMatchObject({
      kind: "review",
      href: "/zh/review",
      count: 4,
      reason: "due-reviews",
    });
  });

  it("continues with the next unread doc when no reviews are due", () => {
    const result = buildNextSuggestion({
      dueReviews: 0,
      nextUnread: { chapter: "futures", chapterTitle: "02 · 合约", doc: "margin", docTitle: "03 · 保证金" },
      pendingQuizChapter: { chapter: "spot", chapterTitle: "01 · 现货" },
      replayRounds: 10,
      locale: "en",
    });
    expect(result).toMatchObject({
      kind: "read",
      href: "/en/knowledge/futures/margin",
      chapterTitle: "02 · 合约",
      docTitle: "03 · 保证金",
      reason: "next-unread",
    });
  });

  it("suggests the chapter quiz once every doc is read", () => {
    const result = buildNextSuggestion({
      dueReviews: 0,
      nextUnread: null,
      pendingQuizChapter: { chapter: "spot", chapterTitle: "01 · 现货" },
      replayRounds: 10,
      locale: "zh",
    });
    expect(result).toMatchObject({
      kind: "quiz",
      href: "/zh/knowledge/spot",
      chapterTitle: "01 · 现货",
      reason: "chapter-quiz",
    });
  });

  it("warms up with replay when everything is read/quizzed but replay rounds < 3", () => {
    const result = buildNextSuggestion({
      dueReviews: 0,
      nextUnread: null,
      pendingQuizChapter: null,
      replayRounds: 2,
      locale: "en",
    });
    expect(result).toMatchObject({ kind: "replay", href: "/en/replay", reason: "replay-warmup" });

    const done = buildNextSuggestion({
      dueReviews: 0,
      nextUnread: null,
      pendingQuizChapter: null,
      replayRounds: 3,
      locale: "en",
    });
    expect(done).toMatchObject({ kind: "explore", href: "/en/path", reason: "all-clear" });
  });

  it("sanitizes corrupt inputs and falls back to slugs when titles are missing", () => {
    const result = buildNextSuggestion({
      dueReviews: "bad",
      nextUnread: { chapter: "spot", doc: "order-types", chapterTitle: "", docTitle: null as never },
      pendingQuizChapter: { chapter: "  " },
      replayRounds: Number.NaN,
      locale: "fr",
    });
    expect(result.kind).toBe("read");
    expect(result.href).toBe("/zh/knowledge/spot/order-types");
    expect(result.docTitle).toBe("order-types");
    expect(result.chapterTitle).toBeNull();
  });

  it("ignores structurally broken unread/quiz inputs", () => {
    const result = buildNextSuggestion({
      dueReviews: 0,
      nextUnread: { chapter: "", doc: "x" } as never,
      pendingQuizChapter: { chapter: null as never },
      replayRounds: 99,
      locale: "en",
    });
    expect(result.kind).toBe("explore");
  });
});

/**
 * R16.171：这张卡是「一句文案 + 一个箭头」，两者必须指同一页。
 *
 * 以前全部读完那条写的是「课程全部完成——用回放保持手感」，可 `kind:"explore"` 的 href 是
 * `/[locale]/path`（`next-suggestion.ts:104-107`），而同一屏另一条说回放的（`nextReplay`）
 * 才真的通向 `/replay`。两条断言分别被不同用例钉着（这句的字面文案、那个 href），
 * 谁也没把它们放在一起比——所以矛盾一直活着。
 */
describe("建议卡那句话说的是箭头真正去的那一页", () => {
  const cleared = {
    dueReviews: 0,
    nextUnread: null,
    pendingQuizChapter: null,
    replayRounds: 99,
    locale: "zh",
  };

  it("全部读完这条通向 /path，所以话里只能点学习路线", () => {
    const zh = STATS_DICTS.zh;
    const en = STATS_DICTS.en;
    expect(buildNextSuggestion(cleared)).toMatchObject({ kind: "explore", href: "/zh/path" });
    expect(zh.nextAllClear).toMatch(/路线/);
    expect(en.nextAllClear).toMatch(/learning path/i);
    expect(zh.nextAllClear + en.nextAllClear).not.toMatch(/回放|replay/i);
    // 对照：旧写法许的就是那个不该许的地方，禁令不是空转
    for (const legacy of ["课程全部完成——用回放保持手感", "Everything complete — stay sharp with replay practice"]) {
      expect(legacy).toMatch(/回放|replay/i);
    }
  });

  it("正向对照：点名回放的那条，href 真的是 /replay", () => {
    const zh = STATS_DICTS.zh;
    const en = STATS_DICTS.en;
    expect(buildNextSuggestion({ ...cleared, replayRounds: 0 })).toMatchObject({
      kind: "replay",
      href: "/zh/replay",
    });
    expect(zh.nextReplay).toMatch(/回放/);
    expect(en.nextReplay).toMatch(/replay/i);
  });
});
