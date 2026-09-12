import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseQuizMounts } from "./quiz-source-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("parseQuizMounts", () => {
  it("parses both object-literal and indexed assignment forms", () => {
    const entries = parseQuizMounts(`
      const QUIZZES: Record<string, unknown> = {
        "getting-started": {
          chapterNum: "getting-started",
          docSlug: "first-trade",
          questions: [{}, {}, {}],
        },
      };
      QUIZZES["spot"] = {
        chapterNum: "spot",
        docSlug: "spot-strategies",
        questions: [{}, {}, {}],
      };
    `);
    expect(entries).toEqual([
      {
        key: "getting-started",
        chapterNum: "getting-started",
        docSlug: "first-trade",
        questionCount: 3,
      },
      {
        key: "spot",
        chapterNum: "spot",
        docSlug: "spot-strategies",
        questionCount: 3,
      },
    ]);
  });

  it("keeps malformed mounts visible to the caller", () => {
    const entries = parseQuizMounts(`
      QUIZZES["broken"] = {
        chapterNum: "broken",
        questions: [],
      };
    `);
    expect(entries).toEqual([
      {
        key: "broken",
        chapterNum: "broken",
        docSlug: null,
        questionCount: 0,
      },
    ]);
  });

  it("parses every production mount and its real question count", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/lib/quizzes.ts"), "utf8");
    const entries = parseQuizMounts(source);
    expect(entries).toHaveLength(27);
    expect(entries.every((entry) => entry.questionCount !== null && entry.questionCount >= 3)).toBe(true);
    expect(entries.reduce((sum, entry) => sum + (entry.questionCount ?? 0), 0)).toBe(81);
  });
});
