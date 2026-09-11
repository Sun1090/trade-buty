import { describe, expect, it } from "vitest";
import { buildNextSuggestion } from "./next-suggestion";

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
