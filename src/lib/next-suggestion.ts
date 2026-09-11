/**
 * R12.7：个性化下一步学习建议——纯决策函数。
 *
 * 数据全部来自本地学习记录（错题 SRS、阅读进度、测验成绩、回放历史），
 * 优先级反映了学习闭环「复习 → 新学 → 检验 → 实战」：
 *
 *   1. 到期复习（SRS 到期错题最有时效性，先消化）
 *   2. 继续读下一篇未读课程（保持主线推进）
 *   3. 已读完但没做的章节测验（检验刚学的章）
 *   4. 回放轮数 < 3 的热身建议（把知识变成手感）
 *   5. 全部完成 → 保持手感的回访入口
 *
 * 只陈述事实数据，不夸大、不承诺收益（内容宪法）。
 */

export type NextSuggestionKind = "review" | "read" | "quiz" | "replay" | "explore";

export interface NextSuggestion {
  version: 1;
  kind: NextSuggestionKind;
  /** 站内链接 */
  href: string;
  /** 相关数量（到期复习数等；无则 null） */
  count: number | null;
  /** 章节上下文（标题可直接展示） */
  chapterTitle: string | null;
  docTitle: string | null;
  reason: "due-reviews" | "next-unread" | "chapter-quiz" | "replay-warmup" | "all-clear";
}

const REPLAY_WARMUP_ROUNDS = 3;

const safeNonNegative = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

const clean = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export function buildNextSuggestion(input: {
  dueReviews?: unknown;
  nextUnread?: { chapter: string; chapterTitle?: unknown; doc: string; docTitle?: unknown } | null;
  /** 已读完但测验未完成的章节（含标题） */
  pendingQuizChapter?: { chapter: string; chapterTitle?: unknown } | null;
  replayRounds?: unknown;
  locale?: string;
}): NextSuggestion {
  const locale = input.locale === "en" ? "en" : "zh";
  const dueReviews = safeNonNegative(input.dueReviews);

  if (dueReviews > 0) {
    return {
      version: 1,
      kind: "review",
      href: `/${locale}/review`,
      count: dueReviews,
      chapterTitle: null,
      docTitle: null,
      reason: "due-reviews",
    };
  }

  const unread = input.nextUnread;
  if (unread && clean(unread.chapter) && clean(unread.doc)) {
    const chapter = clean(unread.chapter)!;
    const doc = clean(unread.doc)!;
    return {
      version: 1,
      kind: "read",
      href: `/${locale}/knowledge/${chapter}/${doc}`,
      count: null,
      chapterTitle: clean(unread.chapterTitle),
      docTitle: clean(unread.docTitle) ?? doc,
      reason: "next-unread",
    };
  }

  const quizChapter = input.pendingQuizChapter;
  if (quizChapter && clean(quizChapter.chapter)) {
    return {
      version: 1,
      kind: "quiz",
      href: `/${locale}/knowledge/${clean(quizChapter.chapter)!}`,
      count: null,
      chapterTitle: clean(quizChapter.chapterTitle),
      docTitle: null,
      reason: "chapter-quiz",
    };
  }

  if (safeNonNegative(input.replayRounds) < REPLAY_WARMUP_ROUNDS) {
    return {
      version: 1,
      kind: "replay",
      href: `/${locale}/replay`,
      count: null,
      chapterTitle: null,
      docTitle: null,
      reason: "replay-warmup",
    };
  }

  return {
    version: 1,
    kind: "explore",
    href: `/${locale}/path`,
    count: null,
    chapterTitle: null,
    docTitle: null,
    reason: "all-clear",
  };
}
