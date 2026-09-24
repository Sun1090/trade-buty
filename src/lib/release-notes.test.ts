import { describe, expect, it } from "vitest";
import {
  CHANGELOG_WINDOW,
  changelogOlderLine,
  changelogSurface,
  compareReleaseVersions,
  formatReleaseDate,
  isReleaseDate,
  isReleaseVersion,
  latestRelease,
  releaseNotes,
  sortReleaseNotes,
  unreleasedNote,
  type ReleaseNote,
  type UnreleasedNote,
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

  /**
   * R16.161：这一条以前第一行就是 `if (!unreleasedNote) return;`，而 `release-notes.json`
   * 只有一个顶层键 `releases`——于是它从来没有断言过任何东西。今天的真实数据仍然没有
   * `unreleased`（`changelog/page.tsx` 那一节因此整块不渲染，实测两语页面的 HTML 里
   * 「未发布 / Unreleased」0 次），所以形状的证明改由一份**一定会跑**的夹具承担；
   * 哪天有人往 JSON 里加了这一节，同一套规则也会立刻套到真数据上。
   */
  it("未发布条目与已发布条目结构一致（夹具那一跑永远会跑）", () => {
    const check = (note: UnreleasedNote, from: string) => {
      expect(isReleaseDate(note.date), `${from}：日期不是 YYYY-MM-DD`).toBe(true);
      expect(note.highlights.zh.length, `${from}：一条亮点都没有`).toBeGreaterThan(0);
      expect(note.highlights.en, `${from}：英文半边数量对不上`).toHaveLength(
        note.highlights.zh.length,
      );
    };

    check(
      {
        date: "2099-01-01",
        highlights: { zh: ["甲", "乙"], en: ["A", "B"] },
      },
      "夹具",
    );
    // 正向对照：一份少了英文条目的夹具必须过不了，否则上面三行是摆设
    expect(() =>
      check(
        { date: "2099-01-01", highlights: { zh: ["甲", "乙"], en: ["A"] } },
        "坏夹具",
      ),
    ).toThrow();
    if (unreleasedNote) check(unreleasedNote, "真实数据");
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

describe("changelogOlderLine（句子只能由发布记录算出来）", () => {
  it("当前记录多到需要折叠：窗口与更早条数都是算的", () => {
    const { older } = changelogSurface();
    expect(older.length, "数据不再需要折叠时，请重看这几条断言").toBeGreaterThan(0);
    const zh = changelogOlderLine("zh");
    const en = changelogOlderLine("en");
    expect(zh).toContain(`最近 ${CHANGELOG_WINDOW} 个版本`);
    expect(zh).toContain(`更早的 ${older.length} 个版本`);
    expect(en).toContain(`the earlier ${older.length} are recorded in`);
    // 占位符必须都被代入
    for (const line of [zh, en]) {
      expect(line).not.toMatch(/\{[a-z]+\}/);
    }
  });

  it("窗口外没有版本时整句不出现，而不是「更早的 0 个版本」", () => {
    const surface = { shown: releaseNotes, older: [] };
    for (const locale of ["zh", "en"] as const) {
      expect(changelogOlderLine(locale, surface)).toBeNull();
    }
  });

  it("折叠掉一条就多说一条：数字跟着 older 走", () => {
    const one = changelogOlderLine("zh", {
      shown: releaseNotes.slice(0, CHANGELOG_WINDOW),
      older: [note({ version: "0.0.1" })],
    });
    expect(one).toContain("更早的 1 个版本");
    expect(one).not.toContain("更早的 0 个版本");
  });
});
