/**
 * AI 页副标题写着「不荐股、不预测、只讲知识」，英文同位置 `No stock picks, no predictions,
 * just education.`。这三句是说给使用者听的承诺，而 v1.0.0 起的对话 prompt 只有五条约束，
 * 其中管得住的只有「不荐股」和「不承诺收益」；「不预测」从来没有任何一条约束说过，输入侧
 * 护栏也只拦荐股/收益承诺两类（`src/lib/ai/guardrail.ts`）。
 *
 * 所以副标题里那句「不预测」是产品替模型许下的一个 prompt 里并不存在的规矩。这里把
 * 「文案承诺」与「prompt 约束」按条对起来，缺一条即失败。
 */
import { describe, expect, it } from "vitest";
import { getSystemPrompt, PROMPT_VERSION } from "./prompt";
import { getDict } from "../i18n";

/** 每条：文案里出现的说法 → 必须在当前 prompt 里存在的约束 */
const CLAIMS: { label: string; copyRe: RegExp; ruleRe: RegExp }[] = [
  {
    label: "不荐股",
    copyRe: /不荐股|no stock picks/i,
    ruleRe: /绝不推荐具体股票、基金、币种/,
  },
  {
    label: "不预测",
    copyRe: /不预测|no predictions/i,
    ruleRe: /不预测未来走势/,
  },
  {
    label: "只讲知识",
    copyRe: /只讲知识|just education/i,
    ruleRe: /你是教育者，不是投顾/,
  },
];

const currentPrompt = getSystemPrompt();

describe("AI 页副标题的三句承诺都有 prompt 约束撑着", () => {
  it("映射表本身覆盖得住副标题里的三句话", () => {
    for (const locale of ["zh", "en"] as const) {
      const subtitle = getDict(locale).ai.subtitle;
      const matched = CLAIMS.filter((claim) => claim.copyRe.test(subtitle));
      expect(
        matched.length,
        `副标题里数不出三条承诺，说明文案改了而映射表没跟着改：${subtitle}`
      ).toBe(CLAIMS.length);
    }
  });

  it("每一条承诺在当前对话 prompt 里都有对应约束", () => {
    for (const claim of CLAIMS) {
      expect(
        claim.ruleRe.test(currentPrompt),
        `副标题承诺了「${claim.label}」，但 prompt（${PROMPT_VERSION}）里没有这条约束`
      ).toBe(true);
    }
  });

  it("反向对照：旧版 prompt 确实撑不起「不预测」这句", () => {
    // 若这一条也通过，说明规则正则写宽了，上面那条断言等于没测
    const legacy = getSystemPrompt("v1.4.0");
    const prediction = CLAIMS.find((c) => c.label === "不预测");
    expect(prediction).toBeDefined();
    expect(prediction!.ruleRe.test(legacy), "v1.4.0 里不该有这条约束").toBe(false);
    expect(prediction!.ruleRe.test(currentPrompt)).toBe(true);
  });
});
