import { describe, expect, it } from "vitest";
import {
  compareReleaseVersions,
  formatReleaseDate,
  isReleaseDate,
  isReleaseVersion,
  latestRelease,
  releaseNotes,
  sortReleaseNotes,
  unreleasedNote,
  type ReleaseNote,
} from "./release-notes";

function note(
  partial: Partial<ReleaseNote> & { version: string },
): ReleaseNote {
  return {
    date: "2026-01-01",
    name: { zh: "名称", en: "Name" },
    highlights: { zh: ["说明"], en: ["Detail"] },
    docs: [],
    ...partial,
  };
}

describe("发布记录数据", () => {
  it("至少有一条发布记录且字段完整", () => {
    expect(releaseNotes.length).toBeGreaterThan(0);
    for (const release of releaseNotes) {
      expect(isReleaseVersion(release.version)).toBe(true);
      expect(isReleaseDate(release.date)).toBe(true);
      expect(release.name.zh.length).toBeGreaterThan(0);
      expect(release.name.en.length).toBeGreaterThan(0);
      expect(release.highlights.zh.length).toBeGreaterThan(0);
      // 中英条目数必须一致，避免英文侧悄悄少列
      expect(release.highlights.en).toHaveLength(release.highlights.zh.length);
      expect(
        release.highlights.zh.every((item) => item.trim().length > 0),
      ).toBe(true);
      expect(
        release.highlights.en.every((item) => item.trim().length > 0),
      ).toBe(true);
    }
  });

  it("版本号唯一且按新到旧排序", () => {
    const versions = releaseNotes.map((release) => release.version);
    expect(new Set(versions).size).toBe(versions.length);
    const sorted = sortReleaseNotes(releaseNotes);
    expect(sorted.map((release) => release.version)).toEqual(versions);
    for (let index = 1; index < releaseNotes.length; index += 1) {
      expect(releaseNotes[index - 1].date >= releaseNotes[index].date).toBe(
        true,
      );
    }
  });

  it("latestRelease 指向最新一条", () => {
    expect(latestRelease()).toEqual(releaseNotes[0]);
  });

  it("未发布条目与已发布条目结构一致", () => {
    if (!unreleasedNote) return;
    expect(isReleaseDate(unreleasedNote.date)).toBe(true);
    expect(unreleasedNote.highlights.zh.length).toBeGreaterThan(0);
    expect(unreleasedNote.highlights.en).toHaveLength(
      unreleasedNote.highlights.zh.length,
    );
  });
});

describe("版本比较", () => {
  it("按数字段比较而不是字符串比较", () => {
    expect(compareReleaseVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareReleaseVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareReleaseVersions("0.6.0", "0.6.1")).toBeLessThan(0);
  });

  it("同日按版本号从新到旧排序", () => {
    const sorted = sortReleaseNotes([
      note({ version: "1.0.0", date: "2026-02-02" }),
      note({ version: "0.9.0", date: "2026-02-02" }),
      note({ version: "2.0.0", date: "2026-01-01" }),
    ]);
    expect(sorted.map((release) => release.version)).toEqual([
      "1.0.0",
      "0.9.0",
      "2.0.0",
    ]);
  });

  it("不改写入参数组", () => {
    const input = [
      note({ version: "0.1.0", date: "2026-01-01" }),
      note({ version: "0.2.0", date: "2026-03-01" }),
    ];
    sortReleaseNotes(input);
    expect(input.map((release) => release.version)).toEqual(["0.1.0", "0.2.0"]);
  });

  it("识别非法版本号与日期", () => {
    expect(isReleaseVersion("0.6")).toBe(false);
    expect(isReleaseVersion("v0.6.0")).toBe(false);
    expect(isReleaseDate("2026-13-40")).toBe(false);
    expect(isReleaseDate("2026-09-12")).toBe(true);
  });
});

describe("日期格式化", () => {
  it("中文按年月日、英文按月份名，不因时区偏移", () => {
    expect(formatReleaseDate("2026-09-12", "zh")).toBe("2026年9月12日");
    expect(formatReleaseDate("2026-09-12", "en")).toBe("September 12, 2026");
    expect(formatReleaseDate("2026-01-01", "en")).toBe("January 1, 2026");
  });

  it("非法日期原样返回", () => {
    expect(formatReleaseDate("not-a-date", "zh")).toBe("not-a-date");
  });
});
