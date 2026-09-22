// @vitest-environment jsdom
/**
 * `/[locale]/calendar` 是一份写死的示例数据（站内没有经济日历数据源），页面构建之后
 * 只会一天天旧。它可以诚实地说「这几条覆盖 X → Y」，但不能说「本周重要财经事件」——
 * 那句话在 2026-09-23 已经过期两周半，而且是 SSG 出来的，永远不会自己变对。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { CALENDAR_EVENTS, calendarSampleWindow } from "@/lib/calendar-sample";
import { getDict } from "@/lib/i18n";

import CalendarPage, { generateMetadata } from "./page";

function props(locale: "zh" | "en"): PageProps<"/[locale]/calendar"> {
  return {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({}),
  };
}

/** 这一页曾经的两句话：禁令必须证明它们抓得住 */
const LEGACY = ["本周重要财经事件——非农、CPI、加息决议。", "This week's key events — NFP, CPI, rate decisions."];
const FRESHNESS_CLAIM = /本周|即将公布|this week|upcoming/i;

let shown: { unmount: () => void } | null = null;

async function renderPage(locale: "zh" | "en"): Promise<string> {
  shown?.unmount();
  shown = render((await CalendarPage(props(locale))) as ReactElement);
  return document.body.textContent ?? "";
}

describe("日历页只声称示例数据做得到的一件事", () => {
  it("禁止「本周 / 即将」这类时效承诺（且元描述同样受限）", async () => {
    for (const sample of LEGACY) {
      expect(FRESHNESS_CLAIM.test(sample), `禁令抓不住旧文案：${sample}`).toBe(true);
    }
    for (const locale of ["zh", "en"] as const) {
      const text = await renderPage(locale);
      expect(text).toMatch(/示例|sample/i);
      expect(text).not.toMatch(FRESHNESS_CLAIM);
      const meta = await generateMetadata(props(locale));
      expect(String(meta.description)).not.toMatch(FRESHNESS_CLAIM);
      expect(String(meta.description)).toMatch(/示例|sample/i);
      // 宪法要求：行情/事件类表面必须带风险提示
      expect(text).toMatch(/不构成任何投资建议|not investment advice/);
      expect(getDict(locale).pageMeta.calendarDesc).not.toMatch(FRESHNESS_CLAIM);
    }
  });

  it("页面上写出的日期窗口就是列表里真实的最早与最晚", async () => {
    const text = await renderPage("zh");
    const window = calendarSampleWindow();
    expect(text).toContain(window);

    const [first, last] = window.split(" → ");
    const rowDays = CALENDAR_EVENTS.map((e) => e.date).sort();
    expect(first).toBe(rowDays[0]);
    expect(last).toBe(rowDays[rowDays.length - 1]);
    // 列表渲染出的每一个日期都必须落在声明的窗口内
    for (const day of rowDays) {
      expect(text).toContain(day.slice(5));
      expect(day >= first && day <= last, `${day} 落在窗口 ${window} 之外`).toBe(true);
    }
  });

  it("示例数组本身非空，否则上面两条都是空转", () => {
    expect(CALENDAR_EVENTS.length, "示例日历不能是空数组").toBeGreaterThan(0);
    expect(calendarSampleWindow()).toMatch(/^\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}$/);
  });
});
