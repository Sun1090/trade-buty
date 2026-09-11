// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStatsRangeDays, setStatsRangeDays, STATS_RANGE_OPTIONS } from "./stats-range";

const store = new Map<string, string>();
const dispatchSpy = vi.fn();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal("window", { dispatchEvent: dispatchSpy });

describe("stats range filter", () => {
  beforeEach(() => {
    store.clear();
    dispatchSpy.mockClear();
  });

  it("converges to the two supported options", () => {
    expect(STATS_RANGE_OPTIONS).toEqual([7, 30]);
  });

  it("falls back to 7 days for missing or invalid stored values", () => {
    expect(getStatsRangeDays()).toBe(7);
    store.set("tb-stats-range-days", "30");
    expect(getStatsRangeDays()).toBe(30);
    store.set("tb-stats-range-days", "abc");
    expect(getStatsRangeDays()).toBe(7);
    store.set("tb-stats-range-days", "14");
    expect(getStatsRangeDays()).toBe(7);
    store.set("tb-stats-range-days", "-30");
    expect(getStatsRangeDays()).toBe(7);
  });

  it("persists the selection and broadcasts the change", () => {
    expect(setStatsRangeDays(30)).toBe(30);
    expect(store.get("tb-stats-range-days")).toBe("30");
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.mock.calls[0][0].type).toBe("tb-stats-range");
  });

  it("sanitizes writes to the nearest valid tier", () => {
    expect(setStatsRangeDays(31)).toBe(7); // 31 不是合法档位 → 回退 7
    expect(setStatsRangeDays(30)).toBe(30);
    expect(store.get("tb-stats-range-days")).toBe("30");
  });
});
