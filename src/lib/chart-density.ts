export const MOBILE_CHART_MAX_WIDTH = 640;
export const COMPACT_CHART_CANDLES = 180;
export const FULL_CHART_CANDLES = 500;

export type ChartDensity = "compact" | "full";

export function getChartDensityFromViewport(
  isNarrowViewport: boolean,
  forceFull = false,
): ChartDensity {
  return isNarrowViewport && !forceFull ? "compact" : "full";
}

export function getChartDensity(
  viewportWidth: number,
  forceFull = false,
): ChartDensity {
  return getChartDensityFromViewport(
    viewportWidth <= MOBILE_CHART_MAX_WIDTH,
    forceFull,
  );
}

export function getChartDataLimit(density: ChartDensity): number {
  return density === "compact" ? COMPACT_CHART_CANDLES : FULL_CHART_CANDLES;
}
