import { describe, expect, it } from "vitest";
import {
  getMarketRefreshDelay,
  getNetworkQuality,
  shouldUseLowBandwidth,
} from "./network-quality";

describe("network quality", () => {
  it("prioritizes offline over stale connection metadata", () => {
    expect(getNetworkQuality({ online: false, effectiveType: "4g" })).toBe(
      "offline",
    );
  });

  it("detects slow links and data-saver mode", () => {
    expect(getNetworkQuality({ effectiveType: "slow-2g" })).toBe("slow");
    expect(getNetworkQuality({ effectiveType: "3G" })).toBe("slow");
    expect(getNetworkQuality({ effectiveType: "4g", saveData: true })).toBe(
      "slow",
    );
  });

  it("fails open when connection metadata is unavailable or unknown", () => {
    expect(getNetworkQuality({})).toBe("online");
    expect(getNetworkQuality({ effectiveType: "unknown" })).toBe("online");
  });

  it("backs polling off on slow links and pauses it offline", () => {
    expect(getMarketRefreshDelay("online")).toBe(5_000);
    expect(getMarketRefreshDelay("slow")).toBe(60_000);
    expect(getMarketRefreshDelay("offline")).toBeNull();
  });

  it("uses low-bandwidth behavior for every non-online state", () => {
    expect(shouldUseLowBandwidth("online")).toBe(false);
    expect(shouldUseLowBandwidth("slow")).toBe(true);
    expect(shouldUseLowBandwidth("offline")).toBe(true);
  });
});
