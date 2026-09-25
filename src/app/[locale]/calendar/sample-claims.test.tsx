// @vitest-environment jsdom
/**
 * `/[locale]/calendar` 是一份写死的示例数据（站内没有经济日历数据源），页面构建之后
 * 只会一天天旧。它可以诚实地说「这几条覆盖 X → Y」，但不能说「本周重要财经事件」——
 * 那句话在 2026-09-23 已经过期两周半，而且是 SSG 出来的，永远不会自己变对。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { CALENDAR_EVENTS, CALENDAR_HIGHLIGHTS, calendarSampleWindow } from "@/lib/calendar-sample";
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
/** 被禁掉的旧大标题与旧形容词：影响分级那一列自己就印着「低」，形容词不能凌驾于它 */
const LEGACY_IMPORTANCE = ["重要经济事件", "a static window of key releases", "几条关键财经发布"];
const IMPORTANCE_CLAIM = /重要|关键|important|key releases/i;

/** 抠出元描述括号里点名的那一串：zh 是全角括号 + 顿号，en 是半角括号 + 逗号 */
function enumeration(text: string): string[] {
  const m = text.match(/[（(]([^（）()]+)[）)]/);
  return m ? m[1].split(/[、,]\s*/).map((s) => s.trim()).filter(Boolean) : [];
}

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

  it("元描述里点名的每一类发布，列表里都得真有一条", () => {
    const events = new Set(CALENDAR_EVENTS.map((e) => e.event));
    expect(CALENDAR_HIGHLIGHTS.length, "点名表空了，下面两条对账就都是空转").toBeGreaterThan(0);
    for (const h of CALENDAR_HIGHLIGHTS) {
      expect(events.has(h.ref), `点名表引用了列表里不存在的事件：${h.ref}`).toBe(true);
    }
    // 探针：被删掉的「CPI」在数据里至今没有对应条目。它如今要是有对应，这条就该改，
    // 上面那个判据也就没在替任何人作证了。
    expect([...events].some((name) => /CPI|Consumer Price/i.test(name)), "CPI 已进列表，探针要换名字").toBe(false);
    for (const locale of ["zh", "en"] as const) {
      const desc = getDict(locale).pageMeta.calendarDesc;
      const named = enumeration(desc);
      expect(named.length, `元描述里一个名字都没点名：${desc}`).toBeGreaterThan(0);
      expect(named, `${locale} 元描述点名的东西与点名表不一致`).toEqual(
        CALENDAR_HIGHLIGHTS.map((h) => (locale === "zh" ? h.zh : h.en)),
      );
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

  it("大标题不再替列表里那颗「低」说「重要」，而且与 <title> 是同一个字符串", async () => {
    for (const sample of LEGACY_IMPORTANCE) {
      expect(IMPORTANCE_CLAIM.test(sample), `禁令抓不住旧标题：${sample}`).toBe(true);
    }
    for (const locale of ["zh", "en"] as const) {
      const title = getDict(locale).pageMeta.calendarTitle;
      const text = await renderPage(locale);
      expect(screen.getByRole("heading", { level: 1 }).textContent, `${locale} 的 h1 与 <title> 各说一样`).toBe(title);
      expect(text).not.toMatch(IMPORTANCE_CLAIM);
      expect(getDict(locale).pageMeta.calendarDesc).not.toMatch(IMPORTANCE_CLAIM);
    }
  });

  /**
   * R16.227：页脚原来写「静态示例数据，API 接入待定 / Static sample data. API integration
   * planned.」——「待定 / planned」是在替一件没有排期的事作保：接不接数据源、还是把这一页
   * 下线，至今仍是 roadmap 上没拍板的 R16.16（`docs/roadmap.md` 里那条前面还是 `- [ ]`）。
   * 诚实的写法只说眼前：这一页不读任何源，站内也没有这样一个源。
   */
  it("页脚不再替「以后会接 API」作保，只说这一页现在不读任何源", async () => {
    const legacy = [
      "静态示例数据，API 接入待定。",
      "Static sample data. API integration planned.",
    ];
    const ROADMAP_PROMISE = /接入待定|计划接入|\bplanned\b|coming soon|will (be|come)/i;
    for (const sample of legacy) {
      expect(ROADMAP_PROMISE.test(sample), `禁令抓不住旧页脚：${sample}`).toBe(true);
    }
    for (const locale of ["zh", "en"] as const) {
      const text = await renderPage(locale);
      expect(text, `${locale} 页脚还在替路线图作保`).not.toMatch(ROADMAP_PROMISE);
      expect(text).toMatch(/不读取任何经济日历数据源|reads no economic-calendar feed/);
    }
    // R16.16 还没拍板，这条禁令才有意义；它一旦被关掉，说明产品已经答了这个问题
    const roadmap = readFileSync(path.join(process.cwd(), "docs/roadmap.md"), "utf8");
    expect(
      roadmap,
      "R16.16 已经不再是待决项：这一页的措辞按产品结论重定，别留这条过期判据",
    ).toMatch(/^- \[ \] R16\.16 /m);
  });

  it("示例数组本身非空，否则上面两条都是空转", () => {
    expect(CALENDAR_EVENTS.length, "示例日历不能是空数组").toBeGreaterThan(0);
    // 影响分级真的分出高低，上一条的「不许说重要」才不是对着全高影响的空集立的规矩
    expect(new Set(CALENDAR_EVENTS.map((e) => e.impact)).size, "示例数据只有一种影响分级").toBeGreaterThan(1);
    expect(CALENDAR_EVENTS.some((e) => e.impact === "low"), "示例数据里没有低影响那条").toBe(true);
    expect(calendarSampleWindow()).toMatch(/^\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}$/);
  });
});
