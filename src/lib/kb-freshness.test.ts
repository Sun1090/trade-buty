import { describe, expect, it } from "vitest";
import { parseKbCommitDate } from "./kb-freshness";

describe("parseKbCommitDate", () => {
  it("解析 git 的 ISO 严格格式", () => {
    const d = parseKbCommitDate("2026-09-12T00:02:43+08:00");
    expect(d?.toISOString()).toBe("2026-09-11T16:02:43.000Z");
  });

  it("允许前后空白", () => {
    expect(parseKbCommitDate("  2026-09-12T00:02:43+08:00\n")?.toISOString()).toBe(
      "2026-09-11T16:02:43.000Z",
    );
  });

  it("空值 / 非法值返回 null 而不是 Invalid Date", () => {
    expect(parseKbCommitDate("")).toBeNull();
    expect(parseKbCommitDate(undefined)).toBeNull();
    expect(parseKbCommitDate(null)).toBeNull();
    expect(parseKbCommitDate("not-a-date")).toBeNull();
  });
});
