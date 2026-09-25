/**
 * R9.9：隐私导出。
 *
 * 用户点击"导出我的数据"时，生成一份 JSON 文件下载到本地，包含：
 * 1. localStorage 中除登录会话外的全部 key/value（供用户自行留存或搬去别处；
 *    站内没有导回入口，所以这份产物是「读得懂的备份」，不是导入格式）
 * 2. 学习进度摘要（每章已读文档数、错题数、SRS 阶段、当前连续天数、活动日历）
 * 3. 同步状态摘要（离线写队列长度与 nextId、上次访问时间、引导进度、邀请参数）
 * 4. schemaVersion / exportedAt 元信息
 *
 * 设计原则：
 * - 纯函数 `buildPrivacyExport()` 返回可序列化对象（不直接下载，便于测试）
 * - `downloadPrivacyExport()` 浏览器侧触发下载（用 Blob + a.download）
 * - SSR 安全：所有 storage 访问走 try/catch
 * - 不包含 Supabase 服务端数据、用户邮箱或登录会话（`sb-*` 令牌）；前端只导出本机存储的学习数据
 */

import { readProgress } from "./progress";
import { readWrong } from "./wrongbook";
import { readStreak } from "./streak";
import { readActivityDates } from "./activity-calendar";
import { getLastVisitAt } from "./last-visit";
import { hasOnboarded, getCurrentStep } from "./onboarding";
import { readInvite } from "./invite-ref";
import { loadQueueAndNextId } from "./sync-queue-store";

const SCHEMA_VERSION = 1;

/** 学习进度摘要（脱敏、不含 PII） */
export interface ProgressSummary {
  /** 每章 [chapterNum] 已读文档数 */
  readCounts: Record<string, number>;
  /** 已读文档总数（去重） */
  totalRead: number;
  /** 错题总数 */
  wrongCount: number;
  /** 各 SRS 阶段统计 */
  srsStages: Record<string, number>;
  /** 当前连续天数 */
  currentStreak: number;
  /** 历史最长 */
  longestStreak: number;
  /** 活动日期列表（YYYY-MM-DD，按时间升序） */
  activityDates: string[];
  /** 错题详情（chapter/questionIdx/picked/SRS） */
  wrongDetails: Array<{
    key: string;
    chapterNum: string;
    questionIdx: number;
    picked: number;
    srsStage: number | null;
    srsDue: string | null;
  }>;
}

/** 同步状态摘要（脱敏） */
export interface SyncSummary {
  /** 是否有未同步的离线写队列 */
  pendingQueueLength: number;
  /** 队列 nextId（供调试） */
  nextId: number | null;
  /** 上次访问时间戳（ms） */
  lastVisitAt: number | null;
  /** 是否完成新手引导 */
  onboarded: boolean;
  /** 当前引导步骤（若未完成） */
  currentOnboardStep: string | null;
  /** 是否带邀请参数 */
  inviteRef: { ref: string; recordedAt: number; expiresAt: number } | null;
}

export interface PrivacyExport {
  schemaVersion: number;
  exportedAt: string;
  /** localStorage 全部条目 */
  localStorage: Record<string, string>;
  progress: ProgressSummary;
  sync: SyncSummary;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 导出必须剔除的键：登录会话材料（`{access_token, refresh_token, expires_at, …}`）。
 *
 * 但要说清这台客户端把它们放在哪儿：`src/lib/supabase/client.ts` 用的是
 * `@supabase/ssr` 的 `createBrowserClient`，它自己写死「always manages the session via
 * cookies, so the `auth.storage` option you passed is ignored」（见
 * `node_modules/@supabase/ssr/dist/main/createBrowserClient.js`）。也就是说会话在
 * **cookie** 里，而这个导出只遍历 `localStorage`——今天这份文件里根本不会有令牌，
 * 不是「剔除掉了」，是「压根没写进去」。
 *
 * 那这条 `sb-` 过滤还留着做什么：防的是这台浏览器上曾经存在过的键。supabase-js 的默认
 * storage 就是 `sb-<project-ref>-auth-token` 一族键名，早于 @supabase/ssr 的构建、
 * 或任何直接走 `createClient` 的代码都会把它们落进 localStorage；导出文件天生要被人下载、
 * 转发、贴进 issue，所以宁可继续按整族跳过。站内自己的键一律 `tb-` 开头，不会误伤学习数据。
 */
const SESSION_STORAGE_KEY = /^sb-/;

function collectLocalStorage(): Record<string, string> {
  const ls = safeStorage();
  if (!ls) return {};
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k || SESSION_STORAGE_KEY.test(k)) continue;
      const v = ls.getItem(k);
      if (v != null) out[k] = v;
    }
  } catch {
    // ignore
  }
  return out;
}

function buildProgressSummary(): ProgressSummary {
  const prog = readProgress();
  const wrong = readWrong();
  const streak = readStreak();
  const activity = readActivityDates();

  const readCounts: Record<string, number> = {};
  let totalRead = 0;
  for (const [chapter, docs] of Object.entries(prog)) {
    const n = Array.isArray(docs) ? docs.length : 0;
    readCounts[chapter] = n;
    totalRead += n;
  }

  const srsStages: Record<string, number> = {};
  const wrongDetails: ProgressSummary["wrongDetails"] = [];
  for (const [key, entry] of Object.entries(wrong)) {
    const stage = entry.srsStage == null ? "none" : `s${entry.srsStage}`;
    srsStages[stage] = (srsStages[stage] ?? 0) + 1;
    wrongDetails.push({
      key,
      chapterNum: entry.chapterNum,
      questionIdx: entry.questionIdx,
      picked: entry.picked,
      srsStage: entry.srsStage ?? null,
      srsDue: entry.srsDue ?? null,
    });
  }

  return {
    readCounts,
    totalRead,
    wrongCount: wrongDetails.length,
    srsStages,
    currentStreak: streak.current ?? 0,
    longestStreak: streak.longest ?? 0,
    activityDates: activity,
    wrongDetails,
  };
}

function buildSyncSummary(now: number): SyncSummary {
  const queue = loadQueueAndNextId();
  const invite = readInvite(now);
  return {
    pendingQueueLength: queue.queue.length,
    nextId: queue.nextId,
    lastVisitAt: getLastVisitAt(),
    onboarded: hasOnboarded(),
    currentOnboardStep: getCurrentStep(),
    inviteRef: invite ? { ref: invite.ref, recordedAt: invite.recordedAt, expiresAt: invite.expiresAt } : null,
  };
}

/** 生成可序列化的导出对象。SSR 安全（无 storage 时返回空对象）。 */
export function buildPrivacyExport(now: number = Date.now()): PrivacyExport {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    localStorage: collectLocalStorage(),
    progress: buildProgressSummary(),
    sync: buildSyncSummary(now),
  };
}

/** 浏览器侧触发下载。SSR / 无 document 时抛错（业务侧不调即可）。 */
export function downloadPrivacyExport(now: number = Date.now()): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("downloadPrivacyExport only works in the browser");
  }
  const data = buildPrivacyExport(now);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trade-buty-export-${data.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
