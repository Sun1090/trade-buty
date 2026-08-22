/**
 * Drizzle schema 镜像（服务端专用，不进客户端 bundle）
 * 用于 API route 内的服务端查询；DDL 以 supabase/migrations/0001_init.sql 为准
 */
import { pgTable, uuid, text, integer, timestamp, boolean, unique } from "drizzle-orm/pg-core";

export const progress = pgTable("progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  chapterNum: text("chapter_num").notNull(),
  docSlug: text("doc_slug").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqUserChapterDoc: unique("uq_user_chapter_doc").on(t.userId, t.chapterNum, t.docSlug),
}));

export const wrongbook = pgTable("wrongbook", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  chapterNum: text("chapter_num").notNull(),
  questionIdx: integer("question_idx").notNull(),
  picked: integer("picked").notNull(),
  answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqUserWrong: unique("uq_user_wrong").on(t.userId, t.chapterNum, t.questionIdx),
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
});

export const replayBest = pgTable("replay_best", {
  userId: uuid("user_id").primaryKey(),
  bestStreak: integer("best_streak").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
