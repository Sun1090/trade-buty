export type NetworkQuality = "online" | "slow" | "offline";

export interface NetworkQualityInput {
  online?: boolean;
  effectiveType?: string;
  saveData?: boolean;
}

const SLOW_EFFECTIVE_TYPES = new Set(["slow-2g", "2g", "3g"]);

/**
 * Normalize the browser Network Information API into the small contract used
 * by data-heavy UI. Unknown/unsupported connection metadata is treated as
 * online so feature detection never blocks the product.
 */
export function getNetworkQuality({
  online = true,
  effectiveType,
  saveData = false,
}: NetworkQualityInput): NetworkQuality {
  if (!online) return "offline";
  if (saveData || SLOW_EFFECTIVE_TYPES.has(effectiveType?.toLowerCase() ?? "")) {
    return "slow";
  }
  return "online";
}

/** Market ticker refresh interval; `null` pauses polling while offline. */
export function getMarketRefreshDelay(quality: NetworkQuality): number | null {
  if (quality === "offline") return null;
  return quality === "slow" ? 60_000 : 5_000;
}

/** Data-heavy widgets use compact payloads on slow or offline-capable paths. */
export function shouldUseLowBandwidth(quality: NetworkQuality): boolean {
  return quality !== "online";
}
