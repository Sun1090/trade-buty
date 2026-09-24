/**
 * 复习页的 intro 既是页面说明也是 meta description，它承诺的按钮必须是默认
 * （SRS 开）模式真正渲染的那两个：「✓ 已掌握，移出错题本」只在 SRS 关闭时出现，
 * 而「掌握了」推进的是 srs.ts 的间隔表，走完最后一档才出库。
 */
import { describe, expect, it } from "vitest";
import { getDict } from "@/lib/i18n";
import { EBBINGHAUS_INTERVALS } from "@/lib/srs";

/** zh 用「」点名按钮，en 用 “…”（与 i18n 里既有的引号口径一致） */
function quotedLabels(intro: string): string[] {
  return [...intro.matchAll(/[“「]([^”」]+)[”」]/g)].map((m) => m[1]);
}

function numbersIn(text: string): number[] {
  return [...text.matchAll(/\b(\d{1,3})\b/g)].map((m) => Number(m[1]));
}

describe("复习页 intro 点名的按钮与间隔，就是页面真正做的那件事", () => {
  for (const locale of ["zh", "en"] as const) {
    const t = getDict(locale).review;

    it(`${locale}: intro 点名的按钮与默认模式的两个按钮一一对应`, () => {
      const quoted = quotedLabels(t.intro);
      expect(quoted.length, "intro 必须点名按钮，否则这条检查是空转").toBeGreaterThan(0);
      expect(quoted.slice().sort(), "intro 点名的按钮必须就是 SRS 模式渲染的那两个").toEqual(
        [t.srsMastered, t.srsNotYet].sort(),
      );
    });

    it(`${locale}: intro 不提只在 SRS 关闭时出现的那颗按钮`, () => {
      expect(t.intro.includes(t.resolved.replace(/^✓\s*/, "")), "intro 里出现了关闭模式才有的按钮名").toBe(false);
    });

    it(`${locale}: intro 抄的间隔表就是 EBBINGHAUS_INTERVALS`, () => {
      expect(numbersIn(t.intro), "间隔表一改，文案必须跟着改").toEqual([...EBBINGHAUS_INTERVALS]);
    });
  }
});
