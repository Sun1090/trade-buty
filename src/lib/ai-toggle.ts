/**
 * R3.9/R3.10：AI 入口统一开关。
 *
 * - R3.10 紧急全关：设置 NEXT_PUBLIC_AI_ENABLED=false，一键隐藏所有 AI 入口。
 * - R3.9 无 key 环境：服务端页用 hasAiServerEnv()（读 AI_API_KEY）判断，
 *   把结果作为 prop 传给客户端组件（isAiEnabled && !aiDisabled）。
 */

/** 客户端安全：总开关（构建期内联） */
export function isAiGloballyDisabled(): boolean {
  return process.env.NEXT_PUBLIC_AI_ENABLED === "false";
}

/** 仅服务端：是否配置了 AI API key（客户端 bundle 中恒为 false，勿依赖） */
export function hasAiServerEnv(): boolean {
  return !!process.env.AI_API_KEY;
}

/** 服务端页面统一入口判断 */
export function aiEnabledForPage(): boolean {
  return hasAiServerEnv() && !isAiGloballyDisabled();
}
