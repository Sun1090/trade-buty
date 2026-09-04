/**
 * 检索配置中心：各场景 topK / 阈值收敛到一处。
 * 覆盖顺序：代码默认值 ← AI_RETRIEVAL_JSON 环境变量（JSON，可只写部分字段）。
 * 非法环境变量一律忽略并告警，不阻断服务。
 */

export type RetrievalUse = "chat" | "quiz" | "summary";

export interface RetrievalProfile {
  topK: number;
  threshold: number;
  /** 兜底二次检索条数；0 表示该场景不做兜底 */
  relaxedTopK: number;
}

const DEFAULTS: Record<RetrievalUse, RetrievalProfile> = {
  chat: { topK: 4, threshold: 0.3, relaxedTopK: 6 },
  quiz: { topK: 3, threshold: 0.3, relaxedTopK: 0 },
  summary: { topK: 6, threshold: 0.3, relaxedTopK: 0 },
};

function sanitizeNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
}

function readEnvOverride(): Partial<Record<RetrievalUse, Partial<RetrievalProfile>>> {
  const raw = process.env.AI_RETRIEVAL_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("[retrieval-config] AI_RETRIEVAL_JSON 非对象，已忽略");
      return {};
    }
    return parsed as Partial<Record<RetrievalUse, Partial<RetrievalProfile>>>;
  } catch {
    console.warn("[retrieval-config] AI_RETRIEVAL_JSON 解析失败，已忽略");
    return {};
  }
}

export function getRetrievalProfile(use: RetrievalUse): RetrievalProfile {
  const base = DEFAULTS[use] ?? DEFAULTS.chat;
  const override = readEnvOverride()[use] ?? {};
  return {
    topK: Math.floor(sanitizeNumber(override.topK, base.topK)) || base.topK,
    threshold: sanitizeNumber(override.threshold, base.threshold),
    relaxedTopK: Math.floor(sanitizeNumber(override.relaxedTopK, base.relaxedTopK)),
  };
}
