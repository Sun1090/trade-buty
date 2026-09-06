/** R10.3：中英文课程标题术语一致性检查的纯计算与 Markdown 渲染。 */

export const TITLE_TERMS = [
  { zh: "合约", en: ["contract", "perpetual", "futures"] },
  { zh: "永续", en: ["perpetual"] },
  { zh: "期货", en: ["futures"] },
  { zh: "杠杆", en: ["leverage"] },
  { zh: "止损", en: ["stop-loss", "stop loss"] },
  { zh: "止盈", en: ["take-profit", "take profit"] },
  { zh: "风控", en: ["risk control", "risk management"] },
  { zh: "风险", en: ["risk"] },
  { zh: "爆仓", en: ["liquidation", "liquidate", "blow-up", "blow up"] },
  { zh: "清算", en: ["liquidation", "liquidate"] },
  { zh: "保证金", en: ["margin"] },
  { zh: "现货", en: ["spot"] },
  { zh: "交易", en: ["trading", "trade"] },
  { zh: "交易所", en: ["exchange"] },
  { zh: "回放", en: ["replay"] },
  { zh: "测验", en: ["quiz"] },
  { zh: "订单", en: ["order"] },
  { zh: "仓位", en: ["position"] },
  { zh: "资金费率", en: ["funding rate", "funding"] },
];

const normalize = (value) => String(value ?? "")
  .toLowerCase()
  .replace(/[‐‑‒–—−]/g, "-")
  .replace(/\s+/g, " ")
  .trim();

export function stripTitleOrder(title) {
  return String(title ?? "").replace(/^\s*\d+\s*[·.、-]?\s*/u, "").trim();
}

export function findTitleTerms(zhTitle, terms = TITLE_TERMS) {
  const title = String(zhTitle ?? "");
  return terms.filter(({ zh }) => title.includes(zh));
}

export function checkTitlePair({ chapter, document, zhTitle, enTitle, terms = TITLE_TERMS }) {
  const base = { chapter, document, zhTitle: zhTitle ?? "", enTitle: enTitle ?? "" };
  if (!enTitle) return { ...base, status: "gap", reason: "missing-en-title", terms: [] };
  if (!zhTitle) return { ...base, status: "gap", reason: "missing-zh-title", terms: [] };

  const recognized = findTitleTerms(zhTitle, terms);
  if (recognized.length === 0) return { ...base, status: "review", reason: "no-known-zh-term", terms: [] };

  const normalizedEn = normalize(stripTitleOrder(enTitle));
  const missing = recognized.filter(({ en }) => !en.some((candidate) => normalizedEn.includes(normalize(candidate))));
  return {
    ...base,
    status: missing.length > 0 ? "gap" : "pass",
    reason: missing.length > 0 ? "missing-en-term" : "matched",
    terms: recognized.map(({ zh, en }) => ({ zh, en, matched: en.filter((candidate) => normalizedEn.includes(normalize(candidate))) })),
    missingTerms: missing.map(({ zh, en }) => ({ zh, en })),
  };
}

export function checkTitlePairs(pairs, terms = TITLE_TERMS) {
  return pairs
    .map((pair) => checkTitlePair({ ...pair, terms }))
    .sort((a, b) => a.chapter.localeCompare(b.chapter) || a.document.localeCompare(b.document));
}

export function renderTitleTerminologyMarkdown({ generatedAt, results }) {
  const counts = { pass: 0, review: 0, gap: 0 };
  results.forEach(({ status }) => { counts[status] += 1; });
  const lines = [
    "# 中英文标题术语一致性报告",
    "",
    `> 自动生成于 ${generatedAt}（npm run check:title-terminology），勿手改。`,
    "",
    `- 总课程：${results.length} | ✅ pass：${counts.pass} | 🔎 review：${counts.review} | ⚠️ gap：${counts.gap}`,
    "",
  ];
  if (results.length === 0) return `${lines.join("\n")}\n`;
  lines.push("| 状态 | 章节 | 课程 | 中文标题 | 英文标题 | 说明 |", "|---|---|---|---|---|---|");
  for (const result of results) {
    const details = result.status === "gap"
      ? `${result.reason}${result.missingTerms?.length ? `：${result.missingTerms.map((term) => term.zh).join("、")}` : ""}`
      : result.reason;
    lines.push(`| ${result.status} | ${result.chapter} | ${result.document} | ${result.zhTitle || "（缺失）"} | ${result.enTitle || "（缺失）"} | ${details} |`);
  }
  return `${lines.join("\n")}\n`;
}
