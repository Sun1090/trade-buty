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

/**
 * 检索阈值是 pgvector 相似度阈值，合法范围为 [0, 1]。
 * 越界值通常会导致检索永远无结果或意外命中，因此回退默认阈值并告警。
 */
function sanitizeThreshold(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
    if (typeof v === "number") {
      console.warn(`[retrieval-config] 检索阈值超出 0..1，已回退为 ${fallback}`);
    }
    return fallback;
  }
  return v;
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
    threshold: sanitizeThreshold(override.threshold, base.threshold),
    relaxedTopK: Math.floor(sanitizeNumber(override.relaxedTopK, base.relaxedTopK)),
  };
}
