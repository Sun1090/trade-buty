"use client";

/**
 * 本地学习镜像的归属账号。
 *
 * `tb-*` 镜像键是**按设备**存的，不是按账号存的：A 在同一台浏览器登出、B 登录后，
 * `hydrateFromCloud(B)` 会把 A 留下的镜像并进 B 的本地状态，还会以 `user_id = B`
 * 补传回云端（RLS 允许，因为那是 B 自己的行）。B 从此分不清哪些进度是自己的。
 *
 * 这里给镜像盖一个归属戳：换一个账号登录时先丢弃上一账号的镜像，合并只在同一个人的
 * 数据里发生。首次登录前（游客）的镜像没有归属戳，由第一个登录的账号认领——
 * 这正是「登录前进度补传到云端」的既有产品行为。
 */

/** 镜像归属戳的存储键 */
export const MIRROR_OWNER_KEY = "tb-data-owner";

/**
 * 由 `hydrateFromCloud` 合并 / 补传的镜像键，以及随之失效的派生记录。
 *
 * 只清这一组是刻意的：它们要么在云端有对应行（账号回来重新登录即可恢复），要么完全由
 * 这份镜像派生（留着会让新账号看到「没有进度却有完成时间」的自相矛盾页面）。
 * **不**包含设备偏好（主题、字号、难度选择、最近搜索），也**不**包含云端没有
 * 对应表的本地记录（书签、连续天数、学习时长、活动日历、答题账本）——清掉那些是真丢数据，
 * 它们的归属问题是要人拍板的产品决策，记在 docs/roadmap.md 的 R15.2。
 */
const ACCOUNT_MIRROR_KEYS = [
  "tb-progress",
  "tb-progress-completions",
  "tb-wrong",
  "tb-replay-history",
  "tb-replay-best",
  "tb-daily-goal-min",
  "tb-daily-goal-date",
  "tb-weekly-goal-min",
  "tb-sync-conflicts",
  "tb-last-cloud-sync",
];

/**
 * 每章测验成绩 `tb-quiz-<chapterSlug>` 属于账号镜像，换账号必须清；
 * 但同前缀不等于同归属，这两个是本地独有记录，清掉就是真丢数据（文件头列过）：
 * - `tb-quiz-difficulty`：设备偏好；
 * - `tb-quiz-attempts`：答题账本（`quiz-attempt-ledger.ts`），测验分数趋势读的就是它，
 *   云端没有对应表，换账号后无从恢复。
 */
export const PER_CHAPTER_QUIZ_EXCLUSIONS = ["tb-quiz-difficulty", "tb-quiz-attempts"];

function isPerChapterQuizKey(key: string): boolean {
  return key.startsWith("tb-quiz-") && !PER_CHAPTER_QUIZ_EXCLUSIONS.includes(key);
}

/** 当前镜像归属的账号；从未盖过戳时返回 null。 */
export function getMirrorOwner(): string | null {
  try {
    return globalThis.localStorage?.getItem(MIRROR_OWNER_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * 清掉上一账号的本地镜像（含归属戳），供换账号与账号注销时复用。
 * localStorage 不可用（SSR / 隐私模式）时静默返回，不影响主流程。
 */
export function resetAccountMirror(): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    for (const key of ACCOUNT_MIRROR_KEYS) storage.removeItem(key);
    const quizKeys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && isPerChapterQuizKey(key)) quizKeys.push(key);
    }
    for (const key of quizKeys) storage.removeItem(key);
    storage.removeItem(MIRROR_OWNER_KEY);
  } catch {
    // best-effort
  }
}

/**
 * 让 `userId` 成为本地镜像的归属账号：
 * - 归属戳是同一账号（含刷新/重登）→ 什么都不做，幂等；
 * - 还没有归属戳（游客数据）→ 盖戳认领，保留「登录前进度补传到云端」的行为；
 * - 归属戳是别人 → 先丢弃别人的镜像再盖戳，绝不把别人的学习记录并进这个账号。
 */
export function adoptAccountMirror(userId: string): void {
  if (!userId) return;
  const owner = getMirrorOwner();
  if (owner === userId) return;
  if (owner !== null) resetAccountMirror();
  try {
    globalThis.localStorage?.setItem(MIRROR_OWNER_KEY, userId);
  } catch {
    // 盖不上戳（隐私模式 / 配额）：下次仍按「无归属」处理，最坏是少一次保护，不会误判成别人
  }
}
