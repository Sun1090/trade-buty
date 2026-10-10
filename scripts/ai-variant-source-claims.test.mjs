/**
 * R16.174：变体题与来源错题的「对应」关系，代码里没有这个东西。
 *
 * 服务端把最多 5 道原题塞进同一份 prompt 让模型产出 3 道同主题变体
 * （`api/ai/quiz/route.ts` + `quiz-strategy.ts` 的 `expectedCount: isChapter ? 5 : 3`），
 * 返回的 `{questions}` 与输入条目没有任何下标关系，`filterRelevantQuestions` 还会再删掉几道。
 * 而客户端 `wrongItems[current % 长度]` 配的注释原本写着「变体题 i 对应来源错题」——
 * 那是排程轮转，不是对应关系。三种走向待产品拍板（见 docs/roadmap.md R16.174），
 * 本判据只守住**不许再把轮转说成对应**，不替产品选走向。
 *
 * 运行：`npx vitest run scripts/ai-variant-source-claims.test.mjs`（跟随 `npm test`）
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const AI_QUIZ = "src/components/ai-quiz.tsx";
const ROUTE = "src/app/api/ai/quiz/route.ts";
const STRATEGY = "src/lib/quiz-strategy.ts";

/** 去掉块注释与行注释——注释正是本判据要审的东西，正文不许被自己的注释洗白 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("R16.174：变体题不许声称自己对应某道来源错题", () => {
  it("注释里凡声称「对应/挂对/来自」的那一句，必须同句否认那是对应关系", () => {
    const src = read(AI_QUIZ);
    const comments = src.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm)?.join("\n") ?? "";
    // 形状而不是字面：登记时那句写的是「挂对关系按**当前这道变体**算」，
    // 只认「变体题 i 对应来源错题」这一串会被换个说法绕过去（M1 实测就是这样绿的）。
    // 判到**句**而不是段：按段判时，同一块里另外一句「没有下标关系」会把
    // 相邻的对应声明洗白（M2 实测：删掉否认那半句仍然全绿）。
    const claims = comments.match(/[^\n]*(?:挂对关系|对应|来自|由\s*来源)[^\n]*/g) ?? [];
    expect(claims.length, "扫不到任何一句谈这个关系的注释——扫描缩水即红").toBeGreaterThan(0);
    for (const line of claims) {
      const disclaimed = /不代表|不是对应|没有.{0,6}下标关系|并非对应|不是对应关系/.test(line);
      // 同一句内：说了「对应/挂对」就得同句否认，或者同句就明说这是轮转排程。
      const inRotatingBlock = /轮转|排程/.test(line);
      expect(
        disclaimed || inRotatingBlock,
        `这一句把轮转说成了对应关系，且没有否认：${line.trim()}`,
      ).toBe(true);
    }
  });

  it("注释必须点明这是轮转排程、且明说它不代表那道变体来自那道题", () => {
    const src = read(AI_QUIZ);
    const comments = src.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm)?.join("\n") ?? "";
    expect(comments, "注释该写明「轮转 / 排程策略」而不是只删掉那句").toMatch(/轮转|排程/);
    expect(comments, "光说轮转还不够，必须写明它不代表对应关系").toMatch(/不代表|不是对应|没有.{0,6}下标关系/);
  });

  it("代码正文里那处认领确实是取模轮转，且没有别的下标依据", () => {
    const src = stripComments(read(AI_QUIZ));
    // 同一份文件里不许出现「按 questions 下标从响应里读来源」的写法：
    // 响应里没有来源字段，谁这么写都是编的。
    expect(src).toMatch(/wrongItems\[\s*current\s*%\s*wrongItems\.length\s*\]/);
    expect(src, "响应里没有来源下标，正文不许读它").not.toMatch(/questions\[\s*current\s*\]\s*\?\.\s*source(Idx|Index)?\b/);
  });

  it("产出的题数与输入的题数不相等是常态——所以下标对应没有依据", () => {
    // 从代码现读，不手抄数字：哪天 expectedCount 改成 5，这条就自动松绑。
    const strategy = stripComments(read(STRATEGY));
    const m = strategy.match(/expectedCount:\s*isChapter\s*\?\s*(\d+)\s*:\s*(\d+)/);
    expect(m, "quiz-strategy 里读不到 expectedCount 的形状").not.toBeNull();
    const variantCount = Number(m[2]);
    const route = stripComments(read(ROUTE));
    const maxItems = Number(route.match(/MAX_VARIANT_ITEMS\s*=\s*(\d+)/)?.[1] ?? NaN);
    expect(Number.isFinite(maxItems)).toBe(true);
    // 变体题 3 道、来源最多 5 道：两边条数都不相等，下标对应无从谈起。
    expect(variantCount).toBeLessThanOrEqual(maxItems);
    expect(variantCount).not.toBe(maxItems);
  });
});
