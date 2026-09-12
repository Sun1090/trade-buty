/**
 * R12.15–R12.17：错题复习提醒（本地生成、可配置、可测试）。
 *
 * 边界（不与站点「无推送/无第三方」承诺冲突）：
 * - 不申请浏览器通知权限、不注册 Service Worker——提醒是站内横幅，
 *   只在用户主动打开页面时展示；
 * - R12.15 频率档位：off / daily / weekly（本地持久化，登录用户随设置同步策略留待后续，当前仅本机）；
 * - R12.16 免打扰窗口：本地小时段 [start,end)，跨午夜（如 22→8）同样成立；
 * - R12.17 去重：每个触发周期（当日 or 当周）最多展示一次，关闭/点击即视为已读；
 *   时钟全部可注入（now 参数），测试不依赖真实时间。
 */

export type ReminderCadence = "off" | "daily" | "weekly";

export interface ReminderSettings {
  cadence: ReminderCadence;
  /** 免打扰开始小时 0–23 */
  dndStartHour: number;
  /** 免打扰结束小时 0–23 */
  dndEndHour: number;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  cadence: "daily",
  dndStartHour: 22,
  dndEndHour: 8,
};

const SETTINGS_KEY = "tb-review-reminder-settings";
const SHOWN_KEY = "tb-review-reminder-shown";

const clampHour = (n: unknown, fallback: number): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return ((v % 24) + 24) % 24;
};

export function getReminderSettings(storage: Storage = globalThis.localStorage): ReminderSettings {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_REMINDER_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    const cadence: ReminderCadence =
      parsed.cadence === "off" || parsed.cadence === "weekly" || parsed.cadence === "daily" ? parsed.cadence : "daily";
    return {
      cadence,
      dndStartHour: clampHour(parsed.dndStartHour, DEFAULT_REMINDER_SETTINGS.dndStartHour),
      dndEndHour: clampHour(parsed.dndEndHour, DEFAULT_REMINDER_SETTINGS.dndEndHour),
    };
  } catch {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }
}

export function saveReminderSettings(next: ReminderSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("tb-reminder"));
  } catch {
    // ignore
  }
}

/** 本地日期 YYYY-MM-DD */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 本地 ISO 周键（周四定周，ISO-8601），格式 YYYY-Www */
export function localWeekStr(d: Date): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const day = (copy.getDay() + 6) % 7; // Mon=0
  copy.setDate(copy.getDate() - day + 3); // 周四
  const firstThursday = new Date(copy.getFullYear(), 0, 4, 12);
  const week = 1 + Math.round((copy.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${copy.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** 当前周期键：daily → 当日；weekly → 当周 */
export function reminderPeriodKey(settings: ReminderSettings, now: Date = new Date()): string | null {
  if (settings.cadence === "off") return null;
  return settings.cadence === "daily" ? localDateStr(now) : localWeekStr(now);
}

/** 是否处于免打扰窗口（支持跨午夜，如 22→8） */
export function inDndWindow(settings: ReminderSettings, now: Date = new Date()): boolean {
  const h = now.getHours();
  const { dndStartHour: s, dndEndHour: e } = settings;
  if (s === e) return false; // 窗口长度为 0 视为关闭
  return s < e ? h >= s && h < e : h >= s || h < e;
}

export function getLastShownKey(storage: Storage = globalThis.localStorage): string | null {
  try {
    return storage.getItem(SHOWN_KEY);
  } catch {
    return null;
  }
}

export function markReminderShown(key: string): void {
  try {
    localStorage.setItem(SHOWN_KEY, String(key));
    window.dispatchEvent(new Event("tb-reminder"));
  } catch {
    // ignore
  }
}

/**
 * 纯判定（R12.17：时钟注入）：
 * 开关打开 + 有到期错题 + 非免打扰时段 + 本周期尚未提醒 → 提醒。
 */
export function shouldShowReminder(input: {
  settings: ReminderSettings;
  dueCount: number;
  lastShownKey: string | null;
  now?: Date;
}): boolean {
  const { settings, dueCount, lastShownKey } = input;
  if (settings.cadence === "off") return false;
  if (!Number.isFinite(dueCount) || dueCount <= 0) return false;
  const now = input.now ?? new Date();
  if (inDndWindow(settings, now)) return false;
  const period = reminderPeriodKey(settings, now);
  if (period === null) return false;
  return lastShownKey !== period;
}
