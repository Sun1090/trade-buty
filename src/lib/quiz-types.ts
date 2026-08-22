export interface QuizQuestion {
  question: string;
  options: string[];
  /** 正确选项下标 */
  answer: number;
  /** 答案解释 */
  explain: string;
}

export interface ChapterQuiz {
  chapterNum: string;
  title: string;
  questions: QuizQuestion[];
}
