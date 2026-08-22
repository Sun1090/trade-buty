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
  /** 挂载到该节的末尾；缺省则挂在篇章页 */
  docSlug?: string;
  questions: QuizQuestion[];
}
