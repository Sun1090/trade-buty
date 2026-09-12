import { describe, it, expect, beforeEach, vi } from "vitest";
import { formatDuration, getTotalReadingTime, readReadingTime } from "./reading-time";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
});

describe("formatDuration", () => {
  it("秒级 < 60s", () => {
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(59.4)).toBe("59s");
  });

  it("分级 1-59 分", () => {
    expect(formatDuration(60)).toBe("1m 0s");
    expect(formatDuration(90)).toBe("1m 30s");
    expect(formatDuration(3599)).toBe("59m 59s");
  });

  it("小时级 ≥ 60 分", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
    expect(formatDuration(3660)).toBe("1h 1m");
    expect(formatDuration(7384)).toBe("2h 3m");
  });

  it("0 秒", () => {
    expect(formatDuration(0)).toBe("0s");
  });
});

describe("readReadingTime", () => {
  beforeEach(() => store.clear());

  it("拒绝合法 JSON 中的非对象结构", () => {
    store.set("tb-reading-time", "null");
    expect(readReadingTime()).toEqual({});
    expect(getTotalReadingTime()).toBe(0);
    store.set("tb-reading-time", "[]");
    expect(readReadingTime()).toEqual({});
  });

  it("过滤污染字段并保留有效时长", () => {
    store.set(
      "tb-reading-time",
      JSON.stringify({
        "spot/a": 120,
        "spot/b": -1,
        "spot/c": "90",
        "spot/d": Number.NaN,
      }),
    );
    expect(readReadingTime()).toEqual({ "spot/a": 120 });
    expect(getTotalReadingTime()).toBe(120);
  });
});
