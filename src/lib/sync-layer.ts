"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { adoptAccountMirror } from "./account-mirror";
// R9.6：sync-layer 仅在登录后才需要 enqueueWrite；改为通过独立模块动态 import
// 避免 sync-queue-store 被打进 layout 的共享 chunk（每个内容页 -12KB gzip）。
import { lazyEnqueueWrite as enqueueWriteLazy } from "./sync-layer-queue-fallback";
import type { QueueKind } from "./sync-queue";
import { recordCloudSync } from "./cloud-sync-meta";
import { detectMergeConflicts, recordSyncConflicts } from "./sync-conflicts";
import type { ProgressMap } from "./progress";
import type { WrongEntry } from "./wrongbook";
import type { ReplayRecord } from "./replay-store";
import { isLocalDateStr } from "./date-utils";
import { REPLAY_HISTORY_KEEP } from "./replay-history-limit";
import { isRecord, readStorageJson } from "./storage-json";

function safeSupabaseBrowser() {
  try {
    return { client: getSupabaseBrowser(), error: null as Error | null };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.warn("[sync] Supabase unavailable; write will be queued", err);
    return { client: null, error: err as Error };
  }
}

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
  // 同步里最早的一刻就把本地镜像的归属钉死：hydrateFromCloud 走动态 import，
  // 等它到达之前组件可能已经读到上一账号的镜像。
  if (userId) adoptAccountMirror(userId);
}

// ---- 云端写入的失败入队 ----

interface QueueTarget {
  kind: QueueKind;
  /** 队列去重键 */
  key: string;
  /** 云端列名形状的载荷：既能直接作为 upsert/insert 的行，也是重放所需内容 */
  payload: Record<string, unknown>;
  ownerId: string;
  label: string;
}

function queueFailedWrite(target: QueueTarget, reason: unknown, note: string): void {
  if (!authenticated || userId !== target.ownerId) return;
  void enqueueWriteLazy(
    target.kind,
    target.key,
    target.payload,
    target.ownerId,
    () => authenticated && userId === target.ownerId,
  );
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[sync] ${target.label} ${note}`, reason);
  }
}

/**
 * postgrest-js 默认**不 reject**：RLS 拒绝、5xx、断网的 fetch 失败都被它内部 catch 成
 * resolved 的 `{data:null, error}`。所以只挂在 rejected 分支上的「失败入队」在真实浏览器里
 * 一次都不会触发——R9.5 承诺的离线写队列对正常失败路径是死的（只有 Supabase 客户端
 * 构造不出来那条分支会入队）。两种形态都必须认：`{error}` 与 rejection。
 */
function settleCloudWrite(target: QueueTarget, result: { error?: unknown } | null | undefined): void {
  if (result && result.error) queueFailedWrite(target, result.error, "failed → queued");
}

// ---- 进度 ----
export function syncProgressWrite(chapterNum: string, docSlug: string) {
  const ownerId = userId;
  if (!authenticated || !ownerId) return;
  // R9.5：失败入队而非丢弃；flushPersistedQueue 在 hydrateFromCloud / online 时重放
  const target: QueueTarget = {
    kind: "progress",
    key: `${chapterNum}:${docSlug}`,
    payload: { chapter_num: chapterNum, doc_slug: docSlug },
    ownerId,
    label: "progress write",
  };
  const { client, error: clientError } = safeSupabaseBrowser();
  if (client) {
    void client
      .from("progress")
      .insert({ user_id: ownerId, ...target.payload })
      .then(
        (result) => settleCloudWrite(target, result),
        (err) => settleCloudWrite(target, { error: err }),
      );
  } else {
    queueFailedWrite(target, clientError, "queued without Supabase");
  }
}

// ---- 错题本 ----
export function syncWrongbookWrite(
  chapterNum: string,
  questionIdx: number,
  picked: number,
  srsStage?: number,
  srsDue?: string,
) {
  const ownerId = userId;
  if (!authenticated || !ownerId) return;
  const target: QueueTarget = {
    kind: "wrongbook-upsert",
    key: `${chapterNum}:${questionIdx}`,
    payload: {
      chapter_num: chapterNum,
      question_idx: questionIdx,
      picked,
      srs_stage: srsStage ?? null,
      srs_due: srsDue ?? null,
    },
    ownerId,
    label: "wrongbook upsert",
  };
  const { client, error: clientError } = safeSupabaseBrowser();
  if (client) {
    void client
      .from("wrongbook")
      .upsert(
        { user_id: ownerId, ...target.payload },
        { onConflict: "user_id,chapter_num,question_idx" },
      )
      .then(
        (result) => settleCloudWrite(target, result),
        (err) => settleCloudWrite(target, { error: err }),
      );
  } else {
    queueFailedWrite(target, clientError, "queued without Supabase");
  }
}

export function syncWrongbookDelete(chapterNum: string, questionIdx: number) {
  const ownerId = userId;
  if (!authenticated || !ownerId) return;
  const target: QueueTarget = {
    kind: "wrongbook-delete",
    key: `${chapterNum}:${questionIdx}`,
    payload: { chapter_num: chapterNum, question_idx: questionIdx },
    ownerId,
    label: "wrongbook delete",
  };
  const { client, error: clientError } = safeSupabaseBrowser();
  if (client) {
    void client
      .from("wrongbook")
      .delete()
      .eq("user_id", ownerId)
      .eq("chapter_num", chapterNum)
      .eq("question_idx", questionIdx)
      .then(
        (result) => settleCloudWrite(target, result),
        (err) => settleCloudWrite(target, { error: err }),
      );
  } else {
    queueFailedWrite(target, clientError, "queued without Supabase");
  }
}

/**
 * 清空错题本的云端侧。只删本地 `tb-wrong` 是不够的：下一次 `hydrateFromCloud` 会把
 * 云端整本错题重新并回本地，用户视角里「清空」等于没生效。
 *
 * 一次整表删除；失败（含 `{data:null,error}` 形态、或压根没有客户端）时退回逐条入队，
 * 由 flush 重放，语义与单条删除完全一致。传入的是清空前的本地快照。
 */
export function syncWrongbookClearAll(
  entries: { chapterNum: string; questionIdx: number }[],
) {
  const ownerId = userId;
  if (!authenticated || !ownerId) return;
  const fallBackToOneByOne = (reason: unknown, note: string) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[sync] wrongbook clear-all ${note}`, reason);
    }
    for (const entry of entries) syncWrongbookDelete(entry.chapterNum, entry.questionIdx);
  };
  const { client, error: clientError } = safeSupabaseBrowser();
  if (!client) {
    fallBackToOneByOne(clientError, "queued without Supabase");
    return;
  }
  void client
    .from("wrongbook")
    .delete()
    .eq("user_id", ownerId)
    .then(
      (result) => {
        if (result && result.error) fallBackToOneByOne(result.error, "failed → per-row queue");
      },
      (err) => fallBackToOneByOne(err, "failed → per-row queue"),
    );
}

// ---- 测验成绩 ----
export function syncQuizUpsert(chapterNum: string, best: number, total: number) {
  const ownerId = userId;
  if (!authenticated || !ownerId) return;
  const target: QueueTarget = {
    kind: "quiz",
    key: chapterNum,
    payload: { chapter_num: chapterNum, best, total },
    ownerId,
    label: "quiz upsert",
  };
  const { client, error: clientError } = safeSupabaseBrowser();
  if (client) {
    void client
      .from("quiz_scores")
      .upsert(
        { user_id: ownerId, ...target.payload, done: true },
        { onConflict: "user_id,chapter_num" },
      )
      .then(
        (result) => settleCloudWrite(target, result),
        (err) => settleCloudWrite(target, { error: err }),
      );
  } else {
    queueFailedWrite(target, clientError, "queued without Supabase");
  }
}

// ---- 回放记录 ----
export function syncReplayHistoryWrite(rec: {
  symbol: string;
  interval: string;
  total: number;
  correct: number;
  bestStreak: number;
  /** 本地这条的完成时刻；缺省时由服务端 `default now()` 兜底 */
  at?: number;
}) {
  const ownerId = userId;
  if (!authenticated || !ownerId) return;
  const payload: Record<string, unknown> = {
    symbol: rec.symbol,
    interval: rec.interval,
    total: rec.total,
    correct: rec.correct,
    best_streak: rec.bestStreak,
    // 云端 `recorded_at` 是 `default now()`：不带上的话它与本地 `at` 永远差一段网络
    // 延迟，合并认不出同一轮 → 每轮回放都被记两次（统计与周报一起翻倍）。
    ...(typeof rec.at === "number" && Number.isFinite(rec.at) && rec.at >= 0
      ? { recorded_at: new Date(rec.at).toISOString() }
      : {}),
  };
  const target: QueueTarget = {
    kind: "replay-history",
    key: `${rec.symbol}:${rec.interval}:${rec.at ?? Date.now()}`,
    payload,
    ownerId,
    label: "replay history",
  };
  const { client, error: clientError } = safeSupabaseBrowser();
  if (client) {
    void client
      .from("replay_history")
      .insert({ user_id: ownerId, ...payload })
      .then(
        (result) => settleCloudWrite(target, result),
        (err) => settleCloudWrite(target, { error: err }),
      );
  } else {
    queueFailedWrite(target, clientError, "queued without Supabase");
  }
}

// ---- 回放最佳 ----
export function syncReplayBestUpsert(best: number) {
  const ownerId = userId;
  if (!authenticated || !ownerId) return;
  const target: QueueTarget = {
    kind: "replay-best",
    key: "global",
    payload: { best_streak: best },
    ownerId,
    label: "replay best",
  };
  const { client, error: clientError } = safeSupabaseBrowser();
  if (client) {
    void client
      .from("replay_best")
      .upsert({ user_id: ownerId, ...target.payload }, { onConflict: "user_id" })
      .then(
        (result) => settleCloudWrite(target, result),
        (err) => settleCloudWrite(target, { error: err }),
      );
  } else {
    queueFailedWrite(target, clientError, "queued without Supabase");
  }
}

function enqueueGoalUpsert(payload: { daily_goal_min?: number; weekly_goal_min?: number }, key: "daily-goal" | "weekly-goal", warnLabel: string) {
  const ownerId = userId;
  if (!authenticated || !ownerId) return;
  const target: QueueTarget = {
    kind: "goal",
    key,
    payload,
    ownerId,
    label: warnLabel,
  };
  const { client, error: clientError } = safeSupabaseBrowser();
  if (client) {
    void client
      .from("user_settings")
      .upsert({ user_id: ownerId, ...payload }, { onConflict: "user_id" })
      .then(
        (result) => settleCloudWrite(target, result),
        (err) => settleCloudWrite(target, { error: err }),
      );
  } else {
    queueFailedWrite(target, clientError, "queued without Supabase");
  }
}

/**
 * R4.7：每日目标档位随写推送到云端。
 * 但「推上去」不等于「各设备读到的一样」：登录拉取那一步是本机意图优先
 * （见本文件下方的 `if (cloudGoal && !localGoal)`——只有本机没设过才采用云端），
 * 所以两台都设过档位时它们会各自保持自己的值，直到用户在其中一台改一次。
 * 这件事由同步差异横幅说给用户（`sync-conflicts.ts`），注释不许替它许诺一致。
 */
export function syncGoalUpsert(goalMin: number) {
  enqueueGoalUpsert({ daily_goal_min: goalMin }, "daily-goal", "goal upsert");
}

/** R12.19：每周目标档位云端同步 */
export function syncWeeklyGoalUpsert(weeklyGoalMin: number) {
  enqueueGoalUpsert({ weekly_goal_min: weeklyGoalMin }, "weekly-goal", "weekly goal upsert");
}

// ---- 登录时从云端拉取并合并到本地 ----

interface CloudProgress { chapter_num: string; doc_slug: string }
interface CloudWrong { chapter_num: string; question_idx: number; picked: number; answered_at: string; srs_stage?: number | null; srs_due?: string | null }
interface CloudQuiz { chapter_num: string; best: number; total: number; done: boolean }
interface CloudReplay { symbol: string; interval: string; total: number; correct: number; best_streak: number; recorded_at: string }
interface CloudReplayBest { best_streak: number }
/** postgrest 的失败形状：单表被 RLS 拒掉时不抛异常，而是回 `{data:null, error:{…}}`。 */
interface CloudReadError { message: string; code?: string }

function normalizeLocalProgress(value: unknown): ProgressMap {
  if (!isRecord(value)) return {};
  const out: ProgressMap = {};
  for (const [chapter, docs] of Object.entries(value)) {
    if (!chapter || !Array.isArray(docs)) continue;
    const normalized = [
      ...new Set(docs.filter((doc): doc is string => typeof doc === "string" && doc.length > 0)),
    ];
    out[chapter] = normalized;
  }
  return out;
}

export function normalizeLocalWrong(value: unknown): Record<string, WrongEntry> {
  if (!isRecord(value)) return {};
  const out: Record<string, WrongEntry> = {};
  for (const [key, rawEntry] of Object.entries(value)) {
    if (!isRecord(rawEntry)) continue;
    const { chapterNum, questionIdx, picked, at, srsStage, srsDue } = rawEntry;
    if (
      typeof chapterNum !== "string" || chapterNum.length === 0 ||
      typeof questionIdx !== "number" || !Number.isFinite(questionIdx) || questionIdx < 0 ||
      typeof picked !== "number" || !Number.isFinite(picked) || picked < -1 ||
      typeof at !== "number" || !Number.isFinite(at) || at < 0
    ) {
      continue;
    }
    const normalizedQuestionIdx = Math.round(questionIdx);
    if (key !== `${chapterNum}:${normalizedQuestionIdx}`) continue;
    const entry: WrongEntry = {
      chapterNum,
      questionIdx: normalizedQuestionIdx,
      picked: Math.round(picked),
      at: Math.round(at),
    };
    if (typeof srsStage === "number" && Number.isFinite(srsStage) && srsStage >= 0) {
      entry.srsStage = Math.round(srsStage);
    }
    if (isLocalDateStr(srsDue)) {
      entry.srsDue = srsDue;
    }
    out[key] = entry;
  }
  return out;
}

function isFiniteDateMs(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function normalizeLocalReplay(value: unknown): ReplayRecord[] {
  if (!Array.isArray(value)) return [];
  const out: ReplayRecord[] = [];
  for (const rawEntry of value) {
    if (!isRecord(rawEntry)) continue;
    const { at, symbol, interval, total, correct, bestStreak, durationSec } = rawEntry;
    if (
      typeof at !== "number" || !Number.isFinite(at) || at < 0 ||
      typeof symbol !== "string" || symbol.length === 0 ||
      typeof interval !== "string" || interval.length === 0 ||
      typeof total !== "number" || !Number.isFinite(total) || total < 0 ||
      typeof correct !== "number" || !Number.isFinite(correct) || correct < 0 ||
      typeof bestStreak !== "number" || !Number.isFinite(bestStreak) || bestStreak < 0
    ) {
      continue;
    }
    const normalizedTotal = Math.round(total);
    const record: ReplayRecord = {
      at: Math.round(at),
      symbol,
      interval,
      total: normalizedTotal,
      correct: Math.min(Math.round(correct), normalizedTotal),
      bestStreak: Math.min(Math.round(bestStreak), normalizedTotal),
    };
    if (typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec >= 0) {
      record.durationSec = Math.round(durationSec);
    }
    out.push(record);
  }
  return out;
}

function normalizeLocalQuiz(value: unknown): { best: number; done: boolean } | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.best !== "number" || !Number.isFinite(value.best) || value.best < 0 ||
    typeof value.done !== "boolean"
  ) {
    return null;
  }
  return { best: Math.round(value.best), done: value.done };
}

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
    if (!isFiniteDateMs(cloudAt)) continue;
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

/**
 * 同一轮回放在「本地 `at`」与「云端 `recorded_at`」之间的可容忍时间差。
 * 历史云端行的 `recorded_at` 是服务器落库时刻（`default now()`），与客户端完成时刻必然
 * 差一段网络延迟；不给容忍窗口，合并就认不出是同一轮，每轮回放都被统计两次。
 * 取 10 秒：网络延迟量级，远小于一轮训练的时长。
 *
 * 只在「云端行 vs 本地记录」之间做容忍，不在云端行之间做：离线批量补传的云端行彼此可能
 * 只隔 1–2 秒，若互相比对会把真实不同的轮次误并成一条。
 */
export const REPLAY_ROUND_DUP_WINDOW_MS = 10_000;

/** 一轮回放的统计指纹：同一轮不管在哪台设备做的，五个统计量都相同，只有打点时间不同 */
interface ReplayRound {
  symbol: string;
  interval: string;
  total: number;
  correct: number;
  bestStreak: number;
}

function replayRoundSig(r: ReplayRound): string {
  return `${r.symbol}|${r.interval}|${r.total}|${r.correct}|${r.bestStreak}`;
}

/** 云端行 → 本地轮次；`recorded_at` 不可解析时返回 null（坏时间戳不进本地历史） */
function cloudReplayRound(row: CloudReplay): (ReplayRound & { at: number }) | null {
  const at = new Date(row.recorded_at).getTime();
  if (!isFiniteDateMs(at)) return null;
  return {
    at,
    symbol: row.symbol,
    interval: row.interval,
    total: row.total,
    correct: row.correct,
    bestStreak: row.best_streak,
  };
}

/** 云端轮次是否就是本地某一轮（指纹相同、时间只差网络延迟） */
function matchesLocalReplayRound(
  localRounds: { sig: string; at: number }[],
  sig: string,
  at: number,
): boolean {
  return localRounds.some((l) => l.sig === sig && Math.abs(l.at - at) <= REPLAY_ROUND_DUP_WINDOW_MS);
}

/** 回放记录合并：并集去重（按 at+一轮的统计指纹，并对云端时间差给容忍），取最近 100 */
export function mergeReplayHistory(local: ReplayRecord[], cloud: CloudReplay[]): ReplayRecord[] {
  const seen = new Set<string>();
  const merged: ReplayRecord[] = [];
  const add = (r: ReplayRecord) => {
    const sig = `${r.at}|${replayRoundSig(r)}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    merged.push(r);
  };
  local.forEach(add);
  const localRounds = local.map((r) => ({ sig: replayRoundSig(r), at: r.at }));
  cloud.forEach((row) => {
    const round = cloudReplayRound(row);
    if (!round) return;
    // 同一轮的云端行（服务器打点）与本地记录（客户端打点）只差网络延迟，认成本地那条即可
    if (matchesLocalReplayRound(localRounds, replayRoundSig(round), round.at)) return;
    add(round);
  });
  merged.sort((a, b) => a.at - b.at);
  return merged.slice(-REPLAY_HISTORY_KEEP);
}

/**
 * 本次合并会从云端带来几轮新回放——必须与 mergeReplayHistory 同一判据，
 * 否则Toast 会对着同一批数据既说「新增 N 轮」又说「没有新内容」。
 * 云端 append-only 不等于每一行都是新的：本机自己上传的行也在里面。
 */
export function countNewReplayRounds(local: ReplayRecord[], cloud: CloudReplay[]): number {
  const localRounds = local.map((r) => ({ sig: replayRoundSig(r), at: r.at }));
  const counted = new Set<string>();
  let count = 0;
  for (const row of cloud) {
    const round = cloudReplayRound(row);
    if (!round) continue;
    const sig = replayRoundSig(round);
    if (matchesLocalReplayRound(localRounds, sig, round.at)) continue;
    const key = `${round.at}|${sig}`;
    if (counted.has(key)) continue; // 云端重复行只算一次
    counted.add(key);
    count += 1;
  }
  return count;
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
export async function hydrateFromCloud(
  id: string,
  isCurrent: () => boolean = () => true,
) {
  if (!id || !isCurrent()) return;

  // 换账号登录时先丢弃上一账号的本地镜像：否则下面的合并会把别人的进度并进当前账号，
  // 并以当前账号的 user_id 补传回云端（RLS 允许，因为那是当前账号的行）。
  adoptAccountMirror(id);

  // R9.4：整体降级——任意一张表失败都不能抛（断网/RLS deny 都不该影响本地体验）
  // `error` 也必须留着：postgrest 的单表失败**不抛**，回的是 `{data:null, error}`，
  // 所以下面那一串 `if (x?.data)` 会安静地逐个跳过，而「这次有没有真的并到过云端」只能靠它判断。
  let progressRes: { data: CloudProgress[] | null; error: CloudReadError | null } | undefined;
  let wrongRes: { data: CloudWrong[] | null; error: CloudReadError | null } | undefined;
  let quizRes: { data: CloudQuiz[] | null; error: CloudReadError | null } | undefined;
  let replayRes: { data: CloudReplay[] | null; error: CloudReadError | null } | undefined;
  let bestRes: { data: CloudReplayBest[] | null; error: CloudReadError | null } | undefined;
  let settingsRes: { data: { daily_goal_min: number; weekly_goal_min?: number | null }[] | null; error: CloudReadError | null } | undefined;
  try {
    const results = await Promise.all([
      getSupabaseBrowser().from("progress").select("chapter_num, doc_slug").eq("user_id", id),
      getSupabaseBrowser().from("wrongbook").select("chapter_num, question_idx, picked, answered_at, srs_stage, srs_due").eq("user_id", id),
      getSupabaseBrowser().from("quiz_scores").select("chapter_num, best, total, done").eq("user_id", id),
      getSupabaseBrowser().from("replay_history").select("symbol, interval, total, correct, best_streak, recorded_at").eq("user_id", id).order("recorded_at", { ascending: false }).limit(REPLAY_HISTORY_KEEP),
      getSupabaseBrowser().from("replay_best").select("best_streak").eq("user_id", id),
      getSupabaseBrowser().from("user_settings").select("daily_goal_min, weekly_goal_min").eq("user_id", id),
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

  // 账号可能在请求期间登出或切换。过期响应绝不能写入当前账号的本地状态。
  if (!isCurrent()) return;

  // R9.6：捕获合并前的本地快照，用于计算"新增了多少"摘要
  const preMergeProgress = readLocalJson("tb-progress", {}, normalizeLocalProgress);
  const preMergeWrong = readLocalJson("tb-wrong", {}, normalizeLocalWrong);
  const preMergeReplay = readLocalJson("tb-replay-history", [], normalizeLocalReplay);

  if (progressRes?.data) {
    const merged = mergeProgress(
      preMergeProgress,
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
      if (!isCurrent()) return;
    }
  }

  if (wrongRes?.data) {
    writeLocalJson("tb-wrong", mergeWrongbook(preMergeWrong, wrongRes.data as CloudWrong[]));
  }

  if (quizRes?.data) {
    for (const row of quizRes.data as CloudQuiz[]) {
      const key = `tb-quiz-${row.chapter_num}`;
      writeLocalJson(key, mergeQuizScore(readLocalJson(key, null, normalizeLocalQuiz), row));
    }
  }

  if (replayRes?.data) {
    writeLocalJson("tb-replay-history", mergeReplayHistory(preMergeReplay, replayRes.data as CloudReplay[]));
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
    // R12.19：每周目标同样的本地意图优先合并
    const cloudWeekly = (settingsRes.data[0] as { weekly_goal_min?: number | null } | undefined)?.weekly_goal_min ?? 0;
    const localWeekly = localStorage.getItem("tb-weekly-goal-min");
    if (cloudWeekly && cloudWeekly > 0 && !localWeekly) {
      try {
        localStorage.setItem("tb-weekly-goal-min", String(cloudWeekly));
      } catch {
        // ignore
      }
    }
  }

  // R9.6：计算合并摘要并通知 UI（R9.7 登录引导卡片消费）
  // 使用合并前的快照：cloud - localBefore 才代表"新增了多少"
  const localQuiz: Record<string, { best: number; done: boolean }> = {};
  for (const row of (quizRes?.data as CloudQuiz[] | undefined) ?? []) {
    const key = `tb-quiz-${row.chapter_num}`;
    localQuiz[row.chapter_num] = readLocalJson(
      key,
      { best: 0, done: false },
      normalizeLocalQuiz,
    );
  }
  const summary = diffMergeSummary(
    preMergeProgress,
    (progressRes?.data as CloudProgress[] | undefined) ?? [],
    preMergeWrong,
    (wrongRes?.data as CloudWrong[] | undefined) ?? [],
    localQuiz,
    (quizRes?.data as CloudQuiz[] | undefined) ?? [],
    preMergeReplay,
    (replayRes?.data as CloudReplay[] | undefined) ?? [],
  );
  emitMergeSummary(summary);

  // R12.9：多设备冲突检测——目标档位分歧 + 错题同键计划分歧，记录供统计页提示
  try {
    const localGoalRaw = localStorage.getItem("tb-daily-goal-min");
    const localGoal = localGoalRaw !== null && Number(localGoalRaw) > 0 ? Number(localGoalRaw) : null;
    const cloudGoal = settingsRes?.data?.[0]?.daily_goal_min ?? null;
    const cloudWeeklyGoalRaw = (settingsRes?.data?.[0] as { weekly_goal_min?: number | null } | undefined)?.weekly_goal_min ?? null;
    const localWeeklyGoalRaw = localStorage.getItem("tb-weekly-goal-min");
    const localWeeklyGoal = localWeeklyGoalRaw !== null && Number(localWeeklyGoalRaw) > 0 ? Number(localWeeklyGoalRaw) : null;
    const conflicts = detectMergeConflicts({
      localGoalMin: localGoal,
      cloudGoalMin: typeof cloudGoal === "number" && cloudGoal > 0 ? cloudGoal : null,
      localWeeklyGoalMin: localWeeklyGoal,
      cloudWeeklyGoalMin: typeof cloudWeeklyGoalRaw === "number" && cloudWeeklyGoalRaw > 0 ? cloudWeeklyGoalRaw : null,
      localWrong: preMergeWrong,
      cloudWrong: (wrongRes?.data as CloudWrong[] | undefined) ?? [],
    });
    recordSyncConflicts(conflicts);
  } catch {
    // 冲突提示是 best-effort，不影响合并
  }

  // R12.8：记录最近一次云端合并时间（统计页数据来源标识用）。
  // 条件是「六张表都读到了」而不是「这段代码跑到了末尾」：单表被 RLS 拒掉时 postgrest 不抛，
  // 上面那一串 `if (x?.data)` 会安静地全部跳过，于是一次云端数据都没并进来的运行
  // 也会给 `/stats` 那行「上次从云端合并 {t}」盖上新时间——那句话是「换设备不丢」的凭据。
  const cloudReadsClean = [progressRes, wrongRes, quizRes, replayRes, bestRes, settingsRes].every(
    (res) => res?.error == null,
  );
  if (cloudReadsClean) recordCloudSync();

  // 一次性通知所有消费组件刷新
  try {
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
}

// ---- R9.6：合并摘要（纯函数，可独立测试）----

export interface MergeSummary {
  /** 云端新增的进度条目数（不在本地） */
  newProgress: number;
  /** 云端新增的错题条目数 */
  newWrong: number;
  /**
   * 这一屏合并会从云端带入的测验成绩条数，两种情形各算一次：
   * 云端比本地高（覆盖），或本地根本没有这一章而云端有分数（补齐）。
   * 所以名字里没有「improve」——一次首次到达不是一次提升。
   */
  quizFromCloud: number;
  /** 合并真正会从云端带入的回放轮次数（与 mergeReplayHistory 同一判据，本机上传的那些不算） */
  newReplays: number;
  /** 是否有任何新内容 */
  hasAny: boolean;
}

/**
 * 计算本地 vs 云端合并后新增项的摘要。
 * 用于 hydrateFromCloud 完成后向用户展示"已为你同步 N 篇进度"。
 */
export function diffMergeSummary(
  localProgress: ProgressMap,
  cloudProgress: CloudProgress[],
  localWrong: Record<string, WrongEntry>,
  cloudWrong: CloudWrong[],
  localQuiz: Record<string, { best: number; done: boolean }>,
  cloudQuiz: CloudQuiz[],
  localReplay: ReplayRecord[],
  cloudReplay: CloudReplay[],
): MergeSummary {
  const newProgress = cloudProgress.filter(
    (row) => !(localProgress[row.chapter_num] ?? []).includes(row.doc_slug),
  ).length;
  const newWrong = cloudWrong.filter(
    (row) => !localWrong[`${row.chapter_num}:${row.question_idx}`],
  ).length;
  const quizFromCloud = cloudQuiz.filter((row) => {
    const l = localQuiz[row.chapter_num];
    return l ? row.best > l.best : row.best > 0;
  }).length;
  const newReplays = countNewReplayRounds(localReplay, cloudReplay);
  const hasAny = newProgress + newWrong + quizFromCloud + newReplays > 0;
  return { newProgress, newWrong, quizFromCloud, newReplays, hasAny };
}

/**
 * hydrateFromCloud 完成时计算摘要并 dispatch 到 UI 层（R9.7 卡片消费）。
 */
function emitMergeSummary(summary: MergeSummary): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("tb-merge-summary", { detail: summary }),
    );
  } catch {
    // ignore
  }
}

// ---- localStorage JSON 读写辅助（合并专用，不参与事件）----
function readLocalJson<T>(
  key: string,
  fallback: T,
  normalize: (value: unknown) => T | null,
): T {
  return normalize(readStorageJson(key)) ?? fallback;
}

function writeLocalJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
