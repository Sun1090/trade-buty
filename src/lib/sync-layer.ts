"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { enqueueWrite } from "./sync-queue-store";
import type { ProgressMap } from "./progress";
import type { WrongEntry } from "./wrongbook";
import type { ReplayRecord } from "./replay-store";

/**
 * 双写同步层：已登录时，lib 写函数在写 localStorage 后调这些函数，
 * fire-and-forget 写 Supabase（anon key + RLS，仅写自己的行）。
 * 未登录时直接 return，零开销。
 */

let authenticated = false;
let userId: string | null = null;

/** 设置认证状态 —— auth-provider 挂载/监听时调用 */
export function setAuthState(isAuth: boolean, id?: string) {
  authenticated = isAuth;
  userId = isAuth && id ? id : null;
}

// ---- 进度 ----
export function syncProgressWrite(chapterNum: string, docSlug: string) {
  if (!authenticated || !userId) return;
  // R9.5：失败入队而非丢弃；flushPersistedQueue 在 hydrateFromCloud / online 时重放
  void getSupabaseBrowser()
    .from("progress")
    .insert({ user_id: userId, chapter_num: chapterNum, doc_slug: docSlug })
    .then(undefined, (err) => {
      enqueueWrite("progress", `${chapterNum}:${docSlug}`, {
        chapter_num: chapterNum,
        doc_slug: docSlug,
      });
      if (process.env.NODE_ENV !== "production") console.warn("[sync] progress write failed → queued", err);
    });
}

// ---- 错题本 ----
export function syncWrongbookWrite(
  chapterNum: string,
  questionIdx: number,
  picked: number,
  srsStage?: number,
  srsDue?: string,
) {
  if (!authenticated || !userId) return;
  void getSupabaseBrowser()
    .from("wrongbook")
    .upsert(
      {
        user_id: userId,
        chapter_num: chapterNum,
        question_idx: questionIdx,
        picked,
        srs_stage: srsStage ?? null,
        srs_due: srsDue ?? null,
      },
      { onConflict: "user_id,chapter_num,question_idx" },
    )
    .then(undefined, (err) => {
      enqueueWrite("wrongbook-upsert", `${chapterNum}:${questionIdx}`, {
        chapter_num: chapterNum,
        question_idx: questionIdx,
        picked,
        srs_stage: srsStage ?? null,
        srs_due: srsDue ?? null,
      });
      if (process.env.NODE_ENV !== "production") console.warn("[sync] wrongbook upsert failed → queued", err);
    });
}

export function syncWrongbookDelete(chapterNum: string, questionIdx: number) {
  if (!authenticated || !userId) return;
  void getSupabaseBrowser()
    .from("wrongbook")
    .delete()
    .eq("user_id", userId)
    .eq("chapter_num", chapterNum)
    .eq("question_idx", questionIdx)
    .then(undefined, (err) => {
      enqueueWrite("wrongbook-delete", `${chapterNum}:${questionIdx}`, {
        chapter_num: chapterNum,
        question_idx: questionIdx,
      });
      if (process.env.NODE_ENV !== "production") console.warn("[sync] wrongbook delete failed → queued", err);
    });
}

// ---- 测验成绩 ----
export function syncQuizUpsert(chapterNum: string, best: number, total: number) {
  if (!authenticated || !userId) return;
  void getSupabaseBrowser()
    .from("quiz_scores")
    .upsert(
      { user_id: userId, chapter_num: chapterNum, best, total, done: true },
      { onConflict: "user_id,chapter_num" },
    )
    .then(undefined, (err) => {
      enqueueWrite("quiz", chapterNum, {
        chapter_num: chapterNum,
        best,
        total,
      });
      if (process.env.NODE_ENV !== "production") console.warn("[sync] quiz upsert failed → queued", err);
    });
}

// ---- 回放记录 ----
export function syncReplayHistoryWrite(rec: {
  symbol: string;
  interval: string;
  total: number;
  correct: number;
  bestStreak: number;
}) {
  if (!authenticated || !userId) return;
  void getSupabaseBrowser()
    .from("replay_history")
    .insert({
      user_id: userId,
      symbol: rec.symbol,
      interval: rec.interval,
      total: rec.total,
      correct: rec.correct,
      best_streak: rec.bestStreak,
    })
    .then(undefined, (err) => {
      enqueueWrite("replay-history", `${rec.symbol}:${rec.interval}:${Date.now()}`, {
        symbol: rec.symbol,
        interval: rec.interval,
        total: rec.total,
        correct: rec.correct,
        best_streak: rec.bestStreak,
      });
      if (process.env.NODE_ENV !== "production") console.warn("[sync] replay history failed → queued", err);
    });
}

// ---- 回放最佳 ----
export function syncReplayBestUpsert(best: number) {
  if (!authenticated || !userId) return;
  void getSupabaseBrowser()
    .from("replay_best")
    .upsert({ user_id: userId, best_streak: best }, { onConflict: "user_id" })
    .then(undefined, (err) => {
      enqueueWrite("replay-best", "global", { best_streak: best });
      if (process.env.NODE_ENV !== "production") console.warn("[sync] replay best failed → queued", err);
    });
}

/** R4.7：每日目标档位云端同步（登录后多设备一致） */
export function syncGoalUpsert(goalMin: number) {
  if (!authenticated || !userId) return;
  void getSupabaseBrowser()
    .from("user_settings")
    .upsert({ user_id: userId, daily_goal_min: goalMin }, { onConflict: "user_id" })
    .then(undefined, (err) => {
      enqueueWrite("goal", "daily-goal", { daily_goal_min: goalMin });
      if (process.env.NODE_ENV !== "production") console.warn("[sync] goal upsert failed → queued", err);
    });
}

// ---- 登录时从云端拉取并合并到本地 ----

interface CloudProgress { chapter_num: string; doc_slug: string }
interface CloudWrong { chapter_num: string; question_idx: number; picked: number; answered_at: string; srs_stage?: number | null; srs_due?: string | null }
interface CloudQuiz { chapter_num: string; best: number; total: number; done: boolean }
interface CloudReplay { symbol: string; interval: string; total: number; correct: number; best_streak: number; recorded_at: string }
interface CloudReplayBest { best_streak: number }

// ---- 合并纯函数（可独立测试，不依赖 localStorage / Supabase）----

/** 进度合并：并集（local ∪ cloud，按 chapter 分组） */
export function mergeProgress(local: ProgressMap, cloud: CloudProgress[]): ProgressMap {
  const merged: ProgressMap = { ...local };
  for (const row of cloud) {
    const set = new Set(merged[row.chapter_num] ?? []);
    set.add(row.doc_slug);
    merged[row.chapter_num] = [...set];
  }
  return merged;
}

/** 错题本合并：并集，冲突取较新 at */
export function mergeWrongbook(local: Record<string, WrongEntry>, cloud: CloudWrong[]): Record<string, WrongEntry> {
  const merged = { ...local };
  for (const row of cloud) {
    const key = `${row.chapter_num}:${row.question_idx}`;
    const cloudAt = new Date(row.answered_at).getTime();
    const localEntry = merged[key];
    if (!localEntry || cloudAt > localEntry.at) {
      merged[key] = {
        chapterNum: row.chapter_num,
        questionIdx: row.question_idx,
        picked: row.picked,
        at: cloudAt,
        // R5.7：SRS 字段随云端合并（空值不覆盖本地已有计划）
        srsStage: row.srs_stage ?? localEntry?.srsStage,
        srsDue: row.srs_due ?? localEntry?.srsDue,
      };
    }
  }
  return merged;
}

/** 测验成绩合并：取 max best，返回合并后的记录 */
export function mergeQuizScore(local: { best: number; done: boolean } | null, cloud: CloudQuiz): { best: number; done: boolean } {
  return { best: Math.max(local?.best ?? 0, cloud.best), done: true };
}

/** 回放记录合并：并集去重（按 at+symbol+interval+total+correct），取最近 100 */
export function mergeReplayHistory(local: ReplayRecord[], cloud: CloudReplay[]): ReplayRecord[] {
  const seen = new Set<string>();
  const merged: ReplayRecord[] = [];
  const add = (r: ReplayRecord) => {
    const sig = `${r.at}|${r.symbol}|${r.interval}|${r.total}|${r.correct}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    merged.push(r);
  };
  local.forEach(add);
  cloud.forEach((row) =>
    add({
      at: new Date(row.recorded_at).getTime(),
      symbol: row.symbol,
      interval: row.interval,
      total: row.total,
      correct: row.correct,
      bestStreak: row.best_streak,
    }),
  );
  merged.sort((a, b) => a.at - b.at);
  return merged.slice(-100);
}

/** 回放最佳合并：取 max */
export function mergeReplayBest(local: number, cloudBest: number): number {
  return Math.max(local, cloudBest);
}

/**
 * 登录后调用：从云端拉取全部数据，与 localStorage 取并集后覆盖写回，
 * 最后 dispatch 一次 tb-progress 让所有消费组件刷新。
 * 失败静默降级（保留本地数据）。
 */
export async function hydrateFromCloud(id: string) {
  if (!id) return;

  // R9.4：整体降级——任意一张表失败都不能抛（断网/RLS deny 都不该影响本地体验）
  let progressRes: { data: CloudProgress[] | null } | undefined;
  let wrongRes: { data: CloudWrong[] | null } | undefined;
  let quizRes: { data: CloudQuiz[] | null } | undefined;
  let replayRes: { data: CloudReplay[] | null } | undefined;
  let bestRes: { data: CloudReplayBest[] | null } | undefined;
  let settingsRes: { data: { daily_goal_min: number }[] | null } | undefined;
  try {
    const results = await Promise.all([
      getSupabaseBrowser().from("progress").select("chapter_num, doc_slug").eq("user_id", id),
      getSupabaseBrowser().from("wrongbook").select("chapter_num, question_idx, picked, answered_at, srs_stage, srs_due").eq("user_id", id),
      getSupabaseBrowser().from("quiz_scores").select("chapter_num, best, total, done").eq("user_id", id),
      getSupabaseBrowser().from("replay_history").select("symbol, interval, total, correct, best_streak, recorded_at").eq("user_id", id).order("recorded_at", { ascending: false }).limit(100),
      getSupabaseBrowser().from("replay_best").select("best_streak").eq("user_id", id),
      getSupabaseBrowser().from("user_settings").select("daily_goal_min").eq("user_id", id),
    ]);
    [progressRes, wrongRes, quizRes, replayRes, bestRes, settingsRes] = results as [typeof progressRes, typeof wrongRes, typeof quizRes, typeof replayRes, typeof bestRes, typeof settingsRes];
  } catch {
    // 网络/RLS/任意失败：保留本地数据，dispatch 通知后直接返回
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new Event("tb-progress"));
      } catch {
        // ignore
      }
    }
    return;
  }

  if (progressRes?.data) {
    const merged = mergeProgress(
      readLocalJson<ProgressMap>("tb-progress", {}),
      progressRes.data as CloudProgress[],
    );
    writeLocalJson("tb-progress", merged);

    // 首次登录时，把登录前仅存在 localStorage 的进度补写到云端，
    // 否则合并结果只停留在当前设备，换设备仍会丢失。
    const localRows = Object.entries(merged).flatMap(([chapterNum, docs]) =>
      docs.map((docSlug) => ({
        user_id: id,
        chapter_num: chapterNum,
        doc_slug: docSlug,
      })),
    );
    if (localRows.length > 0) {
      await getSupabaseBrowser().from("progress").upsert(localRows, {
        onConflict: "user_id,chapter_num,doc_slug",
        ignoreDuplicates: true,
      });
    }
  }

  if (wrongRes?.data) {
    writeLocalJson("tb-wrong", mergeWrongbook(readLocalJson<Record<string, WrongEntry>>("tb-wrong", {}), wrongRes.data as CloudWrong[]));
  }

  if (quizRes?.data) {
    for (const row of quizRes.data as CloudQuiz[]) {
      const key = `tb-quiz-${row.chapter_num}`;
      writeLocalJson(key, mergeQuizScore(readLocalJson(key, null), row));
    }
  }

  if (replayRes?.data) {
    writeLocalJson("tb-replay-history", mergeReplayHistory(readLocalJson<ReplayRecord[]>("tb-replay-history", []), replayRes.data as CloudReplay[]));
  }

  if (bestRes?.data && bestRes.data.length > 0) {
    const cloudBest = (bestRes?.data?.[0] as CloudReplayBest | undefined)?.best_streak ?? 0;
    const local = parseInt(localStorage.getItem("tb-replay-best") ?? "0", 10) || 0;
    try {
      localStorage.setItem("tb-replay-best", String(mergeReplayBest(local, cloudBest)));
    } catch {
      // ignore
    }
  }

  // R4.7：云端目标档位——本地未设置时才采用云端（设备本地意图优先，之后随写随推）
  if (settingsRes?.data && settingsRes.data.length > 0) {
    const cloudGoal = (settingsRes?.data?.[0] as { daily_goal_min: number } | undefined)?.daily_goal_min ?? 0;
    const localGoal = localStorage.getItem("tb-daily-goal-min");
    if (cloudGoal && !localGoal) {
      try {
        localStorage.setItem("tb-daily-goal-min", String(cloudGoal));
      } catch {
        // ignore
      }
    }
  }

  // 一次性通知所有消费组件刷新
  try {
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
}

// ---- localStorage JSON 读写辅助（合并专用，不参与事件）----
function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
