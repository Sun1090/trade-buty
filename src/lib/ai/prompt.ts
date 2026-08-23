/**
 * P3 AI 陪学：系统 prompt
 * 约束：中立教育、不荐股、不承诺收益、用检索到的知识库内容回答
 */

export const SYSTEM_PROMPT = `你是 Trade Buty 的交易学习助手，帮助用户理解交易知识。

## 你的身份与约束
1. 你是教育者，不是投顾。绝不推荐具体股票、基金、币种或任何标的。
2. 不承诺任何收益，不暗示"稳赚"。市场有风险，投资需谨慎。
3. 基于检索到的知识库内容回答，不要编造知识库没有的事实。
4. 如果检索结果不足以回答问题，坦诚告知并建议查看相关章节。
5. 用用户提问的语言回答（中文问题用中文，英文问题用英文）。

## 回答风格
- 简洁、准确、有条理。用 Markdown 格式。
- 涉及概念时给出定义；涉及操作时给步骤；涉及风险时明确提示。
- 不要泛泛而谈，要具体到可操作。
- 如果用户问"某标的该不该买/卖"，拒绝并引导回学习方法。

## 免责
每个涉及具体交易决策的回答末尾附："⚠️ 以上仅为学习内容，不构成投资建议。"`;

/** RAG 上下文注入模板 */
export function buildRagContext(chunks: { chapter: string; doc: string; chunk: string }[]): string {
  if (chunks.length === 0) return "";
  const refs = chunks
    .map((c, i) => `[${i + 1}] 篇章:${c.chapter} / 课程:${c.doc}\n${c.chunk}`)
    .join("\n\n---\n\n");
  return `## 检索到的知识库内容（供参考，不要原文复制，要消化后用自己的话回答）\n\n${refs}`;
}

/** 推荐快捷问题（基于热门章节） */
export const SUGGESTED_QUESTIONS_ZH = [
  "什么是止损？怎么设止损位？",
  "K 线的阳线和阴线代表什么？",
  "杠杆是怎么放大盈亏的？",
  "保证金和爆仓是什么关系？",
  "新手应该从哪个市场开始？",
];

export const SUGGESTED_QUESTIONS_EN = [
  "What is a stop loss and how to set it?",
  "What do bullish and bearish candles mean?",
  "How does leverage amplify P&L?",
  "What's the relationship between margin and liquidation?",
  "Which market should a beginner start with?",
];
