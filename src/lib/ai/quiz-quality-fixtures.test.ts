import { describe, expect, it } from "vitest";
import fixtureData from "./fixtures/quiz-quality-cases.json";
import {
  auditAiQuestions,
  filterDuplicateQuestions,
  filterRelevantQuestions,
  validateAiQuestions,
} from "./quiz-gen";
import type { AiQuizQuestion, QuizIssueCode } from "./quiz-gen";
import { resolveQuizStrategy } from "../quiz-strategy";

type TestCase = {
  name: string;
  locale: "zh" | "en";
  raw: unknown;
  expectedIssues: Array<{ questionIndex: number; code: QuizIssueCode }>;
  expectedAcceptedCount: number;
};

type RelevanceCase = {
  name: string;
  context: string;
  minScore: number;
  questions: AiQuizQuestion[];
  expectedKeptQuestions: string[];
};

type DedupeCase = {
  name: string;
  threshold: number;
  existing: string[];
  questions: AiQuizQuestion[];
  expectedKeptQuestions: string[];
};

type StrategyCase = {
  name: string;
  options: {
    locale: "zh" | "en";
    difficulty: "basic" | "advanced";
    chapter?: string;
    variant?: boolean;
  };
  expected: Record<string, number>;
};

const fixtures = fixtureData as unknown as {
  version: string;
  validationCases: TestCase[];
  relevanceCases: RelevanceCase[];
  dedupeCases: DedupeCase[];
  strategyCases: StrategyCase[];
};

describe("AI quiz quality fixtures", () => {
  it("keeps the fixture registry version discoverable", () => {
    expect(fixtures.version).toBe("r11.9-1");
  });

  it.each(fixtures.validationCases)("$name", ({ locale, raw, expectedIssues, expectedAcceptedCount }) => {
    expect(auditAiQuestions(raw, locale)).toEqual(expectedIssues);
    expect(validateAiQuestions(raw, locale)).toHaveLength(expectedAcceptedCount);
  });

  it.each(fixtures.relevanceCases)("$name", ({ context, minScore, questions, expectedKeptQuestions }) => {
    expect(
      filterRelevantQuestions(questions, context, minScore).map((q) => q.question),
    ).toEqual(expectedKeptQuestions);
  });

  it.each(fixtures.dedupeCases)("$name", ({ threshold, existing, questions, expectedKeptQuestions }) => {
    expect(
      filterDuplicateQuestions(questions, existing, threshold).map((q) => q.question),
    ).toEqual(expectedKeptQuestions);
  });

  it.each(fixtures.strategyCases)("$name", ({ options, expected }) => {
    const strategy = resolveQuizStrategy(options);
    expect(strategy).toMatchObject(expected);
  });
});
