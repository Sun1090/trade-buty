/**
 * R16.196：关于页说「每章包含……真实 K 线图练习」，而图表只挂在其中一个篇章里。
 *
 * 课文页的图表内嵌是有条件的：`chapterSlug === "technical-analysis"` 才渲染
 * `<LazyChartEmbed>`（`[doc]/page.tsx:348`），其余篇章拿到的是一条 aside
 * （「📖 学完这篇，去看真盘」+ 一颗指向 `/chart` 的按钮）。测验那头倒是真的每章都有
 * （`src/lib/quizzes.ts` 里 27 个 `chapterNum`，知识库 zh 侧也是 27 个篇章目录）。
 * 所以那句「每章包含理论、真实 K 线图练习和测验」把一件全站共用的事说成了每章各自配了一份
 * ——读它的人会以为某个篇章的课文里就有图可看，点进去只有一颗按钮。
 *
 * 判据不能只是「不许出现某些字」，否则把整句删掉就满足了它。这里两头都夹：
 * - 不许把图表练习分给「每一章」（`PER_CHAPTER_CHART`，跨句不算，句号截断）；
 * - 必须点名图表练习真的所在的那两个入口，而那两个名字**取自导航字典**（漂移就红）；
 * - 事实半边自己也要在：课文页那个条件渲染必须还在，且只有一处。
 * 外加一条正向对照：旧那两句喂给同一个判据，必须报出来。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDict } from "@/lib/i18n";

const ABOUT_SRC = "src/app/[locale]/about/page.tsx";
const LESSON_SRC = "src/app/[locale]/knowledge/[chapter]/[doc]/page.tsx";

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

/** 「每一章都配了图表练习」这一种说法 */
const PER_CHAPTER_CHART = {
  zh: /每[个]?章[^。]{0,40}?(K ?线|行情图|真盘)/,
  en: /each chapter[^.]{0,60}?(k-line|real [a-z ]*chart|market chart)/i,
} as const;

/** 抠出关于页那句带 `{chapters}` 占位符的话（en 与 zh 各一份） */
function chapterCountSentence(): { en: string; zh: string } {
  const m = read(ABOUT_SRC).match(/withChapterCount\(\s*en\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"\s*\)/);
  expect(m, "关于页里找不到那句带 {chapters} 的话——句式变了要同步改这里的判据").toBeTruthy();
  const [, en, zh] = m as unknown as [string, string, string];
  expect(en).toContain("{chapters}");
  expect(zh).toContain("{chapters}");
  return { en, zh };
}

describe("关于页不许把图表练习算成每一章各自有的东西", () => {
  const sentence = chapterCountSentence();

  for (const locale of ["zh", "en"] as const) {
    it(`${locale}: 现句子没有把图表练习分给每一章`, () => {
      expect(sentence[locale], `句子：${sentence[locale]}`).not.toMatch(PER_CHAPTER_CHART[locale]);
    });

    it(`${locale}: 正向对照——旧写法必须被同一个判据报出来`, () => {
      const legacy = locale === "zh"
        ? "内容分为 {chapters} 个篇章。每章包含理论、真实 K 线图练习和测验。"
        : "Content is organized into {chapters} chapters. Each chapter includes theory, real-world K-line chart practice, and quizzes.";
      expect(legacy).toMatch(PER_CHAPTER_CHART[locale]);
    });
  }

  it("现句子点名的那两个入口，名字就是导航里的那两个", () => {
    const nav = getDict("zh").nav;
    const enNav = getDict("en").nav;
    // 站点自己的叫法：zh「行情」「回放」，en "Markets" "Replay"（R16.170：一物一名）
    expect(sentence.zh).toContain(nav.chart);
    expect(sentence.zh).toContain(nav.replay);
    expect(sentence.en).toContain(enNav.chart);
    expect(sentence.en).toContain(enNav.replay);
  });

  it("事实半边：课文页只在技术分析那一章内嵌图表，其余篇章得到的是一颗星链接", () => {
    const lesson = read(LESSON_SRC);
    const embeds = lesson.match(/chapterSlug === "technical-analysis" \? \(\s*<LazyChartEmbed/g);
    expect(embeds, "课文页的图表内嵌条件渲染不止一处，或已被改掉——这里的判据要跟着改").toHaveLength(1);
    // 另一支必须真的只是把用户送去图表页：一颗指向 /chart 的链接
    const ctaLinks = lesson.match(/href=\{p\("\/chart"\)\}/g);
    expect(ctaLinks, "课文页那条「去看真盘」的链接形状变了，这里的判据要跟着改").toHaveLength(1);
    expect(lesson).toContain("t.doc.practiceCta");
  });
});
