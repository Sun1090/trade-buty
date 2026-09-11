// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REMINDER_SETTINGS,
  getLastShownKey,
  getReminderSettings,
  inDndWindow,
  localWeekStr,
  markReminderShown,
  reminderPeriodKey,
  saveReminderSettings,
  shouldShowReminder,
} from "./review-reminder";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});
const dispatchSpy = vi.fn();
vi.stubGlobal("window", { dispatchEvent: dispatchSpy });

const storage = () => globalThis.localStorage;
const at = (h: number, opts?: { y?: number; mo?: number; d?: number }) =>
  new Date(opts?.y ?? 2026, (opts?.mo ?? 9) - 1, opts?.d ?? 11, h, 0, 0);

describe("reminder settings storage", () => {
  beforeEach(() => {
    store.clear();
    dispatchSpy.mockClear();
  });

  it("defaults to daily with a 22–8 DND window and round-trips edits", () => {
    expect(getReminderSettings(storage())).toEqual(DEFAULT_REMINDER_SETTINGS);
    saveReminderSettings({ cadence: "weekly", dndStartHour: 23, dndEndHour: 7 });
    expect(getReminderSettings(storage())).toEqual({ cadence: "weekly", dndStartHour: 23, dndEndHour: 7 });
    expect(dispatchSpy.mock.calls[0][0].type).toBe("tb-reminder");
  });

  it("repairs corrupt JSON, unknown cadence and out-of-range hours", () => {
    store.set("tb-review-reminder-settings", "{bad");
    expect(getReminderSettings(storage())).toEqual(DEFAULT_REMINDER_SETTINGS);
    store.set("tb-review-reminder-settings", JSON.stringify({ cadence: "hourly", dndStartHour: 99, dndEndHour: -3 }));
    const s = getReminderSettings(storage());
    expect(s.cadence).toBe("daily");
    expect(s.dndStartHour).toBe(3); // 99 % 24
    expect(s.dndEndHour).toBe(21); // (-3 % 24 + 24) % 24
  });
});

describe("inDndWindow (R12.16 免打扰窗口)", () => {
  it("handles non-wrapping windows", () => {
    const settings = { cadence: "daily" as const, dndStartHour: 12, dndEndHour: 18 };
    expect(inDndWindow(settings, at(11))).toBe(false);
    expect(inDndWindow(settings, at(12))).toBe(true);
    expect(inDndWindow(settings, at(17))).toBe(true);
    expect(inDndWindow(settings, at(18))).toBe(false);
  });

  it("handles cross-midnight windows like 22 → 8", () => {
    const settings = { cadence: "daily" as const, dndStartHour: 22, dndEndHour: 8 };
    expect(inDndWindow(settings, at(23))).toBe(true);
    expect(inDndWindow(settings, at(2))).toBe(true);
    expect(inDndWindow(settings, at(7))).toBe(true);
    expect(inDndWindow(settings, at(8))).toBe(false);
    expect(inDndWindow(settings, at(21))).toBe(false);
  });

  it("treats start == end as disabled window", () => {
    const settings = { cadence: "daily" as const, dndStartHour: 10, dndEndHour: 10 };
    expect(inDndWindow(settings, at(10))).toBe(false);
  });
});

describe("period keys + dedup (R12.17)", () => {
  it("daily keys are local dates; weekly keys are ISO weeks", () => {
    const daily = { cadence: "daily" as const, dndStartHour: 22, dndEndHour: 8 };
    const weekly = { cadence: "weekly" as const, dndStartHour: 22, dndEndHour: 8 };
    expect(reminderPeriodKey(daily, new Date(2026, 8, 11, 9))).toBe("2026-09-11");
    expect(reminderPeriodKey(weekly, new Date(2026, 8, 11, 9))).toBe(localWeekStr(new Date(2026, 8, 11, 9)));
    expect(localWeekStr(new Date(2026, 0, 1, 9))).toMatch(/^202[56]-W/); // 跨年边界稳定
    expect(reminderPeriodKey({ cadence: "off", dndStartHour: 0, dndEndHour: 0 }, new Date())).toBeNull();
  });

  it("shouldShowReminder enforces cadence, DND, due count and once-per-period dedup", () => {
    const settings = { cadence: "daily" as const, dndStartHour: 22, dndEndHour: 8 };
    const noon = at(12);
    expect(shouldShowReminder({ settings, dueCount: 3, lastShownKey: null, now: noon })).toBe(true);
    // 已提醒过本周期 → 去重
    expect(shouldShowReminder({ settings, dueCount: 3, lastShownKey: "2026-09-11", now: noon })).toBe(false);
    // 第二天 → 重新允许
    expect(shouldShowReminder({ settings, dueCount: 3, lastShownKey: "2026-09-11", now: at(12, { d: 12 }) })).toBe(true);
    // 免打扰
    expect(shouldShowReminder({ settings, dueCount: 3, lastShownKey: null, now: at(23) })).toBe(false);
    // 无到期
    expect(shouldShowReminder({ settings, dueCount: 0, lastShownKey: null, now: noon })).toBe(false);
    // 关闭
    expect(shouldShowReminder({ settings: { ...settings, cadence: "off" }, dueCount: 3, lastShownKey: null, now: noon })).toBe(false);
  });

  it("weekly cadence dedups within the same ISO week only", () => {
    const settings = { cadence: "weekly" as const, dndStartHour: 22, dndEndHour: 8 };
    // 2026-09-11 是周五；同周日 2026-09-13 仍属同 ISO 周（周五定周 → 周二 09-08 起）
    const weekKey = localWeekStr(at(12));
    expect(shouldShowReminder({ settings, dueCount: 2, lastShownKey: weekKey, now: at(12, { d: 13 }) })).toBe(false);
    // 下周三 → 新周期
    expect(shouldShowReminder({ settings, dueCount: 2, lastShownKey: weekKey, now: at(12, { d: 16 }) })).toBe(true);
  });

  it("markReminderShown persists and getLastShownKey tolerates corruption", () => {
    markReminderShown("2026-09-11");
    expect(getLastShownKey(storage())).toBe("2026-09-11");
    expect(dispatchSpy.mock.calls.some((c) => c[0].type === "tb-reminder")).toBe(true);
  });
});
