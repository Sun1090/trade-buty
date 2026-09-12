import { describe, expect, it } from "vitest";
import {
  COMPACT_CHART_CANDLES,
  FULL_CHART_CANDLES,
  MOBILE_CHART_MAX_WIDTH,
  getChartDataLimit,
  getChartDensity,
  getChartDensityFromViewport,
} from "./chart-density";

describe("chart density", () => {
  it("uses compact rendering at the mobile breakpoint and below", () => {
    expect(getChartDensity(MOBILE_CHART_MAX_WIDTH)).toBe("compact");
    expect(getChartDensity(MOBILE_CHART_MAX_WIDTH + 1)).toBe("full");
  });

  it("allows a narrow viewport to opt into the full chart", () => {
    expect(getChartDensity(375, true)).toBe("full");
    expect(getChartDensityFromViewport(true, true)).toBe("full");
  });

  it("reduces the candle request without removing chart history", () => {
    expect(getChartDataLimit("compact")).toBe(COMPACT_CHART_CANDLES);
    expect(getChartDataLimit("full")).toBe(FULL_CHART_CANDLES);
    expect(COMPACT_CHART_CANDLES).toBeGreaterThanOrEqual(150);
    expect(FULL_CHART_CANDLES).toBeGreaterThan(COMPACT_CHART_CANDLES);
  });
});
