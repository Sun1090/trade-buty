/**
 * R16.216：复习提醒的档位名字，必须就是去重键真正的粒度。
 *
 * 设置里那两档写「每天一次 / Once a day」「每周一次 / Once a week」，可代码此前只在用户
 * 点掉那颗按钮时才写周期键（`stats-client.tsx` 的「稍后」onClick），什么都不点的人
 * 每打开一次统计页就再弹一次——档位名承诺的是上限，实际给的是「每次访问」。
 * 现在横幅一出现就调用 `markReminderShown(reminderPeriodKey(...))` 占用本周期，
 * 「每天一次」这才成立（展示与收起的行为由 `stats-client.test.tsx` 钉）。
 *
 * 这条门禁管的是**文案与机制对不对得上**，组件测试看不见的那一半：
 * ① 档位名点出的周期，必须与 `reminderPeriodKey` 产出的键同粒度（改档位粒度不改名字，红）；
 * ② 那颗收起按钮不能承诺「待会儿再来」——展示已经把本周期用掉了，不会再回来。
 *
 * 运行：`npx vitest run src/lib/reminder-cadence-claims.test.ts`（跟随 `npm test`）
 */
import { describe, expect, it } from "vitest";
import { STATS_DICTS } from "./i18n-stats";
import { localWeekStr, reminderPeriodKey } from "./review-reminder";
import { localDateStr } from "./date-utils";

const SETTINGS = { dndStartHour: 22, dndEndHour: 8 };
const daily = { ...SETTINGS, cadence: "daily" as const };
const weekly = { ...SETTINGS, cadence: "weekly" as const };

describe("档位名字说的周期就是去重键的周期", () => {
  for (const locale of ["zh", "en"] as const) {
    const dict = STATS_DICTS[locale];

    it(`${locale}：「日」档只说日、「周」档只说周，两个名字不互相借用`, () => {
      const day = dict.reminderCadenceDaily;
      const week = dict.reminderCadenceWeekly;
      const dayWord = locale === "zh" ? /天|日/ : /day/i;
      const weekWord = locale === "zh" ? /周/ : /week/i;
      expect(day, `「${day}」没在说一天`).toMatch(dayWord);
      expect(week, `「${week}」没在说一周`).toMatch(weekWord);
      expect(day, `「${day}」把周期说成了周`).not.toMatch(weekWord);
      expect(week, `「${week}」把周期说成了天`).not.toMatch(dayWord);
    });

    it(`${locale}：「关闭」那一档不点名任何周期`, () => {
      expect(STATS_DICTS[locale].reminderCadenceOff).not.toMatch(/天|日|周|day|week/i);
    });
  }

  it("daily 的键是自然日：同一天两次相同，跨一天必须不同", () => {
    const a = new Date(2026, 8, 24, 9);
    expect(reminderPeriodKey(daily, new Date(2026, 8, 24, 21))).toBe(reminderPeriodKey(daily, a));
    expect(reminderPeriodKey(daily, a)).toBe(localDateStr(a));
    expect(reminderPeriodKey(daily, new Date(2026, 8, 25, 1))).not.toBe(reminderPeriodKey(daily, a));
  });

  it("weekly 的键是 ISO 周：同一周内相同，跨周不同", () => {
    const mon = new Date(2026, 8, 7, 9); // 2026-09-07 周一
    expect(reminderPeriodKey(weekly, new Date(2026, 8, 13, 23))).toBe(reminderPeriodKey(weekly, mon));
    expect(reminderPeriodKey(weekly, mon)).toBe(localWeekStr(mon));
    expect(reminderPeriodKey(weekly, new Date(2026, 8, 14, 0))).not.toBe(reminderPeriodKey(weekly, mon));
  });

  it("off 档没有周期可占用", () => {
    expect(reminderPeriodKey({ ...SETTINGS, cadence: "off" }, new Date(2026, 8, 24, 12))).toBeNull();
  });
});

describe("收起那颗按钮不许承诺「待会儿再来」", () => {
  // 展示这一步已经占用了本周期，所以点了它之后同一周期内不会二次提醒；
  // 「稍后 / Later」说的是「稍后再问」，那是另一套机制（延迟重放），代码里没有。
  const REPROMISE = /稍后|之后|再提醒|再来|later|again/i;

  for (const locale of ["zh", "en"] as const) {
    it(`${locale}：按钮名字是一次性的确认`, () => {
      const text = STATS_DICTS[locale].reminderDismiss;
      expect(text.length, `${locale} 少了一颗收起按钮的文案`).toBeGreaterThan(0);
      expect(text, `「${text}」还许诺会再来一次`).not.toMatch(REPROMISE);
    });
  }

  it("旧写法「稍后 / Later」过不了这条门禁（对照）", () => {
    for (const legacy of ["稍后", "Later"]) {
      expect(legacy, `对照串「${legacy}」抓不住，上面那条是空转`).toMatch(REPROMISE);
    }
  });
});
