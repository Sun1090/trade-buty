import { analyzeRiskWarning } from "../../scripts/risk-warning-lib.mjs";

/**
 * 章节 README 是站内可渲染内容，也受「⚠️ 风险提示」内容红线约束。
 *
 * 上游知识库目前仍有部分 README 只提及风险或完全缺少风险块。站点不能在
 * kline-buty 子模块中就地修补内容，因此在渲染层判断是否需要展示兜底提示。
 * 判定规则与 `check:risk-warning` 共用同一实现，避免报告与页面行为漂移。
 */
export function hasRiskWarningBlock(markdown: string): boolean {
  return analyzeRiskWarning({ markdown, kind: "readme" }).hasRiskBlock;
}

export function shouldShowRiskWarningFallback(markdown: string): boolean {
  return !hasRiskWarningBlock(markdown);
}
