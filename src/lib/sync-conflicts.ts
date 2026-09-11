/**
 * R12.9：多设备同步冲突提示——检测、记录、读取（本地元数据）。
 *
 * 合并规则（既有行为，此模块只负责「看见」）：
 * - 每日目标档位：本地意图优先（R4.7），云端不同 → 冲突（保留本机）；
 * - 错题本：并集，同键冲突取较新 at，SRS 计划随较新一方；
 * - 进度并集、测验取最高分、回放取 max——无歧义，不产生提示。
 *
 * 提示是 best-effort：每次 hydrate 重算覆盖 `tb-sync-conflicts`，
 * 用户关闭后直到下一次 hydrate 出现新冲突前不再打扰。
 */

export interface SyncConflictItem {
  kind: "goal" | "weekly-goal" | "wrongbook";
  /** 冲突对象标识（错题 key 等） */
  key: string;
  /** 本机值（展示用，简短） */
  local: string;
  /** 云端值（展示用，简短） */
  cloud: string;
  /** 自动合并方向 */
  resolution: "kept-local" | "took-cloud";
}

export interface SyncConflictRecord {
  at: number;
  items: SyncConflictItem[];
}

const KEY = "tb-sync-conflicts";
const DISMISS_KEY = "tb-sync-conflicts-dismissed";

/** 纯检测：目标档位 + 错题 SRS/作答分歧 */
export function detectMergeConflicts(input: {
  localGoalMin?: number | null;
  cloudGoalMin?: number | null;
  localWeeklyGoalMin?: number | null;
  cloudWeeklyGoalMin?: number | null;
  localWrong: Record<string, { at: number; picked: number; srsStage?: number; srsDue?: string }>;
  cloudWrong: { chapter_num: string; question_idx: number; picked: number; answered_at: string; srs_stage?: number | null; srs_due?: string | null }[];
}): SyncConflictItem[] {
  const items: SyncConflictItem[] = [];

  const detectGoalDrift = (local: number | null | undefined, cloud: number | null | undefined): boolean =>
    typeof local === "number" && Number.isFinite(local) && local > 0 &&
    typeof cloud === "number" && Number.isFinite(cloud) && cloud > 0 &&
    local !== cloud;

  if (detectGoalDrift(input.localGoalMin, input.cloudGoalMin)) {
    items.push({
      kind: "goal",
      key: "daily-goal-min",
      local: `${Math.round(input.localGoalMin!)}`,
      cloud: `${Math.round(input.cloudGoalMin!)}`,
      resolution: "kept-local",
    });
  }
  if (detectGoalDrift(input.localWeeklyGoalMin, input.cloudWeeklyGoalMin)) {
    items.push({
      kind: "weekly-goal",
      key: "weekly-goal-min",
      local: `${Math.round(input.localWeeklyGoalMin!)}`,
      cloud: `${Math.round(input.cloudWeeklyGoalMin!)}`,
      resolution: "kept-local",
    });
  }

  for (const row of input.cloudWrong ?? []) {
    const key = `${row.chapter_num}:${row.question_idx}`;
    const local = input.localWrong?.[key];
    if (!local) continue;
    const localStage = local.srsStage ?? null;
    const localDue = local.srsDue ?? null;
    const cloudStage = row.srs_stage ?? null;
    const cloudDue = row.srs_due ?? null;
    const differs =
      (localStage !== null && cloudStage !== null && localStage !== cloudStage) ||
      (localDue !== null && cloudDue !== null && localDue !== cloudDue) ||
      local.picked !== row.picked;
    if (!differs) continue;
    const cloudAt = new Date(row.answered_at).getTime();
    items.push({
      kind: "wrongbook",
      key,
      local: `${local.srsStage ?? "—"}/${local.srsDue ?? "—"}`,
      cloud: `${row.srs_stage ?? "—"}/${row.srs_due ?? "—"}`,
      resolution: Number.isFinite(cloudAt) && cloudAt > local.at ? "took-cloud" : "kept-local",
    });
  }

  return items;
}

export function recordSyncConflicts(items: SyncConflictItem[], at: number = Date.now()): void {
  try {
    if (items.length === 0) {
      localStorage.removeItem(KEY);
    } else {
      const record: SyncConflictRecord = { at: Math.round(at), items: items.slice(0, 20) };
      localStorage.setItem(KEY, JSON.stringify(record));
    }
    window.dispatchEvent(new Event("tb-sync-conflict"));
  } catch {
    // ignore
  }
}

export function readSyncConflicts(storage: Storage = globalThis.localStorage): SyncConflictRecord | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SyncConflictRecord;
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    if (!Number.isFinite(parsed.at)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 当前记录是否已被用户关闭 */
export function areSyncConflictsDismissed(record: SyncConflictRecord | null, storage: Storage = globalThis.localStorage): boolean {
  if (!record) return true;
  try {
    return storage.getItem(DISMISS_KEY) === String(record.at);
  } catch {
    return true;
  }
}

export function dismissSyncConflicts(at: number): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Math.round(at)));
    window.dispatchEvent(new Event("tb-sync-conflict"));
  } catch {
    // ignore
  }
}
