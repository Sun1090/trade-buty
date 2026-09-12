/**
 * Drizzle schema 镜像（服务端专用，不进客户端 bundle）。
 *
 * DDL 的唯一事实来源是 `supabase/migrations/` 的按序 SQL；本文件供需要类型化
 * 查询时复用。`schema.test.ts` 会核对这里与迁移是否漂移，并由 CI 的
 * `npm test` 阻断。
 */
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const progress = pgTable("progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  chapterNum: text("chapter_num").notNull(),
  docSlug: text("doc_slug").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqUserChapterDoc: unique("uq_user_chapter_doc").on(t.userId, t.chapterNum, t.docSlug),
  idxUser: index("idx_progress_user").on(t.userId),
}));

export const wrongbook = pgTable("wrongbook", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  chapterNum: text("chapter_num").notNull(),
  questionIdx: integer("question_idx").notNull(),
  picked: integer("picked").notNull(),
  answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  srsStage: integer("srs_stage"),
  srsDue: date("srs_due"),
}, (t) => ({
  uqUserWrong: unique("uq_user_wrong").on(t.userId, t.chapterNum, t.questionIdx),
  idxUser: index("idx_wrongbook_user").on(t.userId),
  idxChapter: index("idx_wrongbook_chapter").on(t.userId, t.chapterNum),
  idxSrsDue: index("idx_wrongbook_srs_due").on(t.userId, t.srsDue),
}));

export const quizScores = pgTable("quiz_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  chapterNum: text("chapter_num").notNull(),
  best: integer("best").notNull(),
  total: integer("total").notNull(),
  done: boolean("done").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqUserQuiz: unique("uq_user_quiz").on(t.userId, t.chapterNum),
  idxUser: index("idx_quiz_scores_user").on(t.userId),
}));

export const replayHistory = pgTable("replay_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  symbol: text("symbol").notNull(),
  interval: text("interval").notNull(),
  total: integer("total").notNull(),
  correct: integer("correct").notNull(),
  bestStreak: integer("best_streak").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxUserTime: index("idx_replay_user_time").on(t.userId, t.recordedAt),
}));

export const replayBest = pgTable("replay_best", {
  userId: uuid("user_id").primaryKey(),
  bestStreak: integer("best_streak").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kbEmbeddings = pgTable("kb_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  chunk: text("chunk").notNull(),
  chapter: text("chapter").notNull(),
  doc: text("doc").notNull(),
  locale: text("locale").notNull().default("zh"),
  embedding: vector("embedding", { dimensions: 1024 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxLocaleChapter: index("idx_kb_embeddings_locale_chapter").on(t.locale, t.chapter),
}));

export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  sources: jsonb("sources").$type<{ chapter: string; doc: string; title?: string }[] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  roleCheck: check("ai_conversations_role_check", sql`${t.role} in ('user', 'assistant')`),
  idxUserTime: index("idx_ai_conversations_user_time").on(t.userId, t.createdAt),
}));

export const aiFeedback = pgTable("ai_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  conversationId: uuid("conversation_id"),
  rating: text("rating").notNull(),
  question: text("question"),
  answer: text("answer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ratingCheck: check("ai_feedback_rating_check", sql`${t.rating} in ('helpful', 'unhelpful')`),
  idxRating: index("idx_ai_feedback_rating").on(t.rating),
}));

export const aiCitationClicks = pgTable("ai_citation_clicks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  kind: text("kind").notNull(),
  chapter: text("chapter").notNull(),
  doc: text("doc"),
  question: text("question"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  kindCheck: check("ai_citation_clicks_kind_check", sql`${t.kind} in ('source', 'suggested')`),
  idxChapterTime: index("idx_ai_citation_clicks_chapter").on(t.chapter, t.createdAt),
  idxKind: index("idx_ai_citation_clicks_kind").on(t.kind),
}));

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey(),
  dailyGoalMin: integer("daily_goal_min").notNull().default(15),
  weeklyGoalMin: integer("weekly_goal_min").notNull().default(90),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  dailyGoalCheck: check("user_settings_daily_goal_min_check", sql`${t.dailyGoalMin} in (5, 15, 30)`),
  weeklyGoalCheck: check("user_settings_weekly_goal_min_check", sql`${t.weeklyGoalMin} in (45, 90, 150)`),
}));
