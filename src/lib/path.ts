import { getChapters, type Chapter } from "./content";

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

export function getStageGroups(): {
  stage: Stage;
  chapters: Chapter[];
}[] {
  const chapters = getChapters("zh");
  const bySlug = new Map(chapters.map((c) => [c.slug, c]));
  return STAGES.map((stage) => ({
    stage,
    chapters: stage.chapterNums
      .map((n) => bySlug.get(n))
      .filter((c): c is Chapter => !!c),
  }));
}
