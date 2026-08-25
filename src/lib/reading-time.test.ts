import { describe, it, expect } from "vitest";
import { formatDuration } from "./reading-time";

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
