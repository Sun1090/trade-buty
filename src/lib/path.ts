import { chapterRef, getChapters, type Chapter } from "./content";

/** 学习路径分层（依据知识库根 README 的学习路线图）；文案见 i18n */
export type StageKey = "core" | "practice" | "deep";

export interface Stage {
  id: StageKey;
  chapterNums: string[];
}

export const STAGES: Stage[] = [
  {
    id: "core",
    chapterNums: ["getting-started", "spot", "stocks", "futures", "crypto-perpetuals", "markets-instruments", "technical-analysis", "trading-system", "pitfalls"],
  },
  {
    id: "practice",
    chapterNums: ["trading-practice", "system-integration", "market-ecosystem", "financial-history", "wealth-allocation", "quant-practice", "data-interpretation", "global-markets"],
  },
  {
    id: "deep",
    chapterNums: ["regulation-compliance", "tools-platforms", "financial-statements", "industry-research", "reading-list", "behavioral-finance", "bonds-rates", "forex-trading", "career", "options-strategies"],
  },
];

/**
 * 某一篇章属于哪一阶段；没登记进分层表就是 `null`。
 * `/path` 按表分组展示，篇章页的眉标也问同一处——不另立一套归属。
 */
export function stageOfChapter(slug: string): StageKey | null {
  return STAGES.find((s) => s.chapterNums.includes(slug))?.id ?? null;
}

export function getStageGroups(
  locale: string
): {
  stage: Stage;
  chapters: Chapter[];
}[] {
  const chapters = getChapters(locale);
  const bySlug = new Map(chapters.map((c) => [c.slug, c]));
  return STAGES.map((stage) => ({
    stage,
    chapters: stage.chapterNums
      .map((n) => bySlug.get(n))
      .filter((c): c is Chapter => !!c),
  }));
}

/**
 * 界面文案里凡是提到「路径长什么样」的量，都由分层表和知识库算出来：
 * `{stages}`（第几站有几站）、`{lastCore}`（主线最后一站的当期标题）、
 * `{chapter:<slug>}`（某一篇章的当期标题）。
 * 抄死「三站式 / 第 08 篇 / 06 · 技术分析篇」的句子，在 `kb:update` 之后会一个字都不剩地对。
 */
export function withCopyRefs(locale: string, text: string): string {
  const coreGroup = getStageGroups(locale).find((g) => g.stage.id === "core");
  const lastCore = coreGroup?.chapters[coreGroup.chapters.length - 1];
  return text
    .replace(/\{stages\}/g, String(STAGES.length))
    .replace(/\{lastCore\}/g, lastCore ? chapterRef(locale, lastCore.slug) : "")
    .replace(/\{chapter:([a-z0-9-]+)\}/g, (_match, slug: string) => chapterRef(locale, slug));
}
