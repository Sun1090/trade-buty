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
    chapterNums: ["01", "02", "04", "03", "05", "09", "06", "07", "08"],
  },
  {
    id: "practice",
    chapterNums: ["11", "10", "12", "13", "14", "15", "26", "25"],
  },
  {
    id: "deep",
    chapterNums: ["16", "17", "18", "19", "20", "21", "22", "23", "24", "27"],
  },
];

export function getStageGroups(): {
  stage: Stage;
  chapters: Chapter[];
}[] {
  const chapters = getChapters();
  const byNum = new Map(chapters.map((c) => [c.num, c]));
  return STAGES.map((stage) => ({
    stage,
    chapters: stage.chapterNums
      .map((n) => byNum.get(n))
      .filter((c): c is Chapter => !!c),
  }));
}
