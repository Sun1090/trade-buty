/**
 * P3 AI 陪学：系统 prompt
 * 约束：中立教育、不荐股、不承诺收益、用检索到的知识库内容回答
 */

/**
 * Prompt 版本历史（改 prompt 先加版本、写 changelog，不直接改线上版本）：
 * - v1.0.0 (2026-08)：初版——中立教育五约束 + 回答风格 + 免责
 * - v1.1.0：v1.0 全文保留；问答逻辑未动，仅接入版本管理
 * - v1.2.0 (当前)：输入侧护栏（R1.8）将荐股/收益承诺在路由层直接拒绝，减少模型浪费
 */
export const PROMPT_VERSION = "v1.2.0" as const;

const SYSTEM_PROMPT_V1 = `你是 Trade Buty 的交易学习助手，帮助用户理解交易知识。

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

export function getRefusalMessage(category: string, locale: string): string {
  const zh =
    category === "profit-promise"
      ? "抱歉，我不能承诺任何收益。市场有风险，没有稳赚的路径。如果你愿意，我们可以一起看风险管理的课程。"
      : "抱歉，我不能推荐具体的股票/基金/币种。基于内容宪法，我只讲知识与方法。我们可以从风险管理或交易系统那章开始。";
  const en =
    category === "profit-promise"
      ? "I can't promise any returns — markets carry risk and there is no sure-win path. Happy to walk through risk management instead."
      : "I can't recommend specific stocks, funds, or coins. Per our content constitution, I only teach knowledge and methods — we can start from risk management or trading systems.";
  return locale === "en" ? en : zh;
}

/** 版本化 prompt 注册表：新版本在此追加，调用方用 getSystemPrompt 取当前版 */
const PROMPT_REGISTRY: Record<string, string> = {
  "v1.0.0": SYSTEM_PROMPT_V1,
  "v1.1.0": SYSTEM_PROMPT_V1,
  "v1.2.0": SYSTEM_PROMPT_V1,
};

export function getSystemPrompt(version: string = PROMPT_VERSION): string {
  return PROMPT_REGISTRY[version] ?? PROMPT_REGISTRY[PROMPT_VERSION];
}

/** 历史兼容别名（新代码请用 getSystemPrompt） */
export const SYSTEM_PROMPT: string = getSystemPrompt();

/** RAG 上下文注入模板 */
export function buildRagContext(chunks: { chapter: string; doc: string; chunk: string }[]): string {
  if (chunks.length === 0) return "";
  const refs = chunks
    .map((c, i) => `[${i + 1}] 篇章:${c.chapter} / 课程:${c.doc}\n${c.chunk}`)
    .join("\n\n---\n\n");
  return `## 检索到的知识库内容（供参考，不要原文复制，要消化后用自己的话回答）\n\n${refs}`;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 自适应出题 prompt：根据错题主题生成变体题 */
export function buildQuizPrompt(
  wrongQuestions: { question: string; explain: string }[],
  ragContext: string,
): ChatMessage[] {
  const examples = wrongQuestions
    .map((q, i) => `错题${i + 1}：${q.question}\n解析：${q.explain}`)
    .join("\n\n");

  return [
    {
      role: "system",
      content: `你是 Trade Buty 的交易教育出题专家。根据用户的错题和知识库内容，生成 3 道同主题的变体选择题。

## 约束
1. 不荐股、不承诺收益、中性教育
2. 题目必须和错题同主题，但换个角度或场景
3. 每题 4 个选项，1 个正确
4. 必须附答案解析

## 输出格式（严格 JSON）
{"questions":[{"question":"题目","options":["A","B","C","D"],"answer":0,"explain":"解析"}]}

## 知识库参考
${ragContext}

## 用户错题（针对这些主题生成变体题）
${examples}`,
    },
    { role: "user", content: "请生成 3 道变体题，严格按 JSON 格式输出。" },
  ];
}

/** 历史摘要 prompt（v1.0.0 随 R1.6 引入）：超长对话时压缩早期轮次 */
export function buildHistorySummaryPrompt(
  messages: { role: string; content: string }[],
  locale: string
): ChatMessage[] {
  const lines = messages
    .map((m) => `${m.role === 'user' ? '用户' : '助手'}：${m.content}`)
    .join('\n');
  const instruction =
    locale === 'en'
      ? 'You are a conversation summarizer. Compress the earlier part of this trading-study dialogue into key points within 200 words. Keep only facts (what was asked, key conclusions). Do not judge, do not invent.'
      : '你是对话摘要器。把以下交易学习对话的早期部分压缩成 200 字以内的中文要点摘要，只保留事实（问过什么、关键结论），不要评价，不要编造没有的内容。';
  return [
    {
      role: 'system',
      content: instruction,
    },
    { role: 'user', content: lines },
  ];
}

/** 推荐快捷问题池（基于热门章节核心概念） */
export const SUGGESTED_QUESTIONS_ZH = [
  "什么是止损？怎么设止损位？",
  "K 线的阳线和阴线代表什么？",
  "杠杆是怎么放大盈亏的？",
  "保证金和爆仓是什么关系？",
  "新手应该从哪个市场开始？",
  "什么是市价单和限价单？有什么区别？",
  "技术分析和基本面分析哪个更重要？",
  "如何判断支撑位和阻力位？",
  "什么是止损止盈比例（盈亏比）？",
  "趋势线怎么画才有效？",
  "什么是仓位管理？为什么重要？",
  "什么是合约的资金费率？",
  "移动平均线（MA）怎么用？",
  "如何识别趋势反转的信号？",
  "新手最容易犯的交易错误有哪些？",
];

export const SUGGESTED_QUESTIONS_EN = [
  "What is a stop loss and how to set it?",
  "What do bullish and bearish candles mean?",
  "How does leverage amplify P&L?",
  "What's the relationship between margin and liquidation?",
  "Which market should a beginner start with?",
  "What's the difference between market and limit orders?",
  "Technical vs fundamental analysis — which matters more?",
  "How to identify support and resistance levels?",
  "What is risk-reward ratio and why does it matter?",
  "How do you draw a valid trendline?",
  "What is position sizing and why is it important?",
  "What is the funding rate in futures contracts?",
  "How to use moving averages (MA)?",
  "How to spot trend reversal signals?",
  "What are the most common beginner trading mistakes?",
];

/** 从问题池随机抽 count 条（Fisher-Yates 全排列后取前 n，避免 sort(random) 的有偏抽样） */
export function pickRandomQuestions(pool: string[], count: number): string[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.max(0, count));
}

/** 无相关 chunk 时的兜底指引：坦诚说明 + 推荐最接近章节，绝不编造 */
export function buildNoContextGuidance(
  suggestions: { chapter: string; title: string }[]
): string {
  const list =
    suggestions.length > 0
      ? suggestions.map((s, i) => `${i + 1}. ${s.title}`).join("\n")
      : "";
  return `## 重要：本次检索没有找到与用户问题直接相关的内容
1. 必须坦诚告知用户"知识库暂时没有这方面的直接内容"，绝不编造答案。
2. 可以基于通用交易常识给出方向性建议，但要明确标注这是通用知识而非本站课程内容。${
    list
      ? `\n3. 主动推荐以下最接近的章节供用户深入学习：\n${list}`
      : ""
  }`;
}
