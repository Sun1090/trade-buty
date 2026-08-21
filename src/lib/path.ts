import { getChapters, type Chapter } from "./content";

/** 学习路径分层（依据知识库根 README 的学习路线图） */
export interface Stage {
  id: string;
  label: string;
  title: string;
  description: string;
  chapterNums: string[];
}

export const STAGES: Stage[] = [
  {
    id: "core",
    label: "第一站",
    title: "入门主线",
    description: "零基础到建立交易系统，按顺序走完这条线",
    chapterNums: [
      "01", "02", "04", "03", "05", "09", "06", "07", "08",
    ],
  },
  {
    id: "practice",
    label: "第二站",
    title: "实战进阶",
    description: "把知识变成操作：实战、生态、量化与数据解读",
    chapterNums: ["11", "10", "12", "13", "14", "15", "26", "25"],
  },
  {
    id: "deep",
    label: "第三站",
    title: "深水区专题",
    description: "监管、财务、行为金融等硬核专题，按需选学",
    chapterNums: [
      "16", "17", "18", "19", "20", "21", "22", "23", "24", "27",
    ],
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
