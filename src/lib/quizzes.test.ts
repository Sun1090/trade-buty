import { describe, it, expect } from "vitest";
import { QUIZZES } from "./quizzes";
import { CHAPTER_ORDER } from "./kb-order";

describe("quizzes data integrity", () => {
  it("每章都有测验", () => {
    for (const slug of CHAPTER_ORDER) {
      expect(QUIZZES[slug], `篇章 ${slug} 缺测验`).toBeDefined();
    }
  });

  it("每个测验有 title 和 chapterNum", () => {
    for (const [slug, quiz] of Object.entries(QUIZZES)) {
      expect(quiz.title, `${slug} 缺 title`).toBeTruthy();
      expect(quiz.chapterNum, `${slug} 缺 chapterNum`).toBe(slug);
    }
  });

  it("每个测验至少 3 道题", () => {
    for (const [slug, quiz] of Object.entries(QUIZZES)) {
      expect(quiz.questions.length, `${slug} 题数 < 3`).toBeGreaterThanOrEqual(3);
    }
  });

  it("每道题有 question/options/answer/explain", () => {
    for (const [slug, quiz] of Object.entries(QUIZZES)) {
      for (let i = 0; i < quiz.questions.length; i++) {
        const q = quiz.questions[i];
        expect(q.question, `${slug} Q${i} 缺 question`).toBeTruthy();
        expect(q.options.length, `${slug} Q${i} 选项 < 2`).toBeGreaterThanOrEqual(2);
        expect(q.answer, `${slug} Q${i} answer 越界`).toBeLessThan(q.options.length);
        expect(q.answer, `${slug} Q${i} answer < 0`).toBeGreaterThanOrEqual(0);
        expect(q.explain, `${slug} Q${i} 缺 explain`).toBeTruthy();
      }
    }
  });

  it("测验数 = 篇章数 27", () => {
    expect(Object.keys(QUIZZES).length).toBe(CHAPTER_ORDER.length);
  });
});
