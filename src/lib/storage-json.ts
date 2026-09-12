/** localStorage JSON 的安全读取与基础结构判断。 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 读取并解析 localStorage；缺失、SSR 或损坏数据统一返回 null。 */
export function readStorageJson(
  key: string,
  storage?: Storage,
): unknown {
  try {
    const target = storage ?? globalThis.localStorage;
    const raw = target?.getItem(key);
    return raw === null || raw === undefined ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readNonNegativeNumber(
  value: unknown,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

export function readNonNegativeInteger(
  value: unknown,
  fallback = 0,
): number {
  return Math.round(readNonNegativeNumber(value, fallback));
}
