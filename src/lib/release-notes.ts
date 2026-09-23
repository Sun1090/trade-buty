/** 发布记录（更新日志）数据访问层：单一来源为 src/data/release-notes.json。 */
import rawReleaseNotes from "@/data/release-notes.json";

export type ReleaseLocale = "zh" | "en";

export interface BilingualText {
  zh: string;
  en: string;
}

export interface BilingualList {
  zh: string[];
  en: string[];
}

export interface ReleaseNote {
  version: string;
  date: string;
  name: BilingualText;
  highlights: BilingualList;
  docs: string[];
}

export interface UnreleasedNote {
  date: string;
  highlights: BilingualList;
}

interface RawReleaseNotes {
  unreleased?: { date: string; highlights: BilingualList };
  releases: ReleaseNote[];
}

const raw = rawReleaseNotes as RawReleaseNotes;

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isReleaseVersion(value: string): boolean {
  return SEMVER_PATTERN.test(value);
}

export function isReleaseDate(value: string): boolean {
  return (
    ISO_DATE_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

/** 版本号按数字段比较；返回负数表示 a 比 b 旧。 */
export function compareReleaseVersions(a: string, b: string): number {
  const left = a.split(".").map((part) => Number(part));
  const right = b.split(".").map((part) => Number(part));
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 新的在前：先比日期，同日再比版本号。 */
export function sortReleaseNotes(notes: readonly ReleaseNote[]): ReleaseNote[] {
  return [...notes].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return compareReleaseVersions(b.version, a.version);
  });
}

export const releaseNotes: ReleaseNote[] = sortReleaseNotes(raw.releases);

export const unreleasedNote: UnreleasedNote | null = raw.unreleased ?? null;

/**
 * 更新日志页只呈现最近这么多版本。页面标题是「最近更新」，而且整页是预渲染的静态
 * HTML：全量列出的话每发一版就长一截，路由体积预算迟早被发布次数本身撑破。
 */
export const CHANGELOG_WINDOW = 8;

/**
 * 页面看到的那批版本，以及被窗口挡在外面、只能去 CHANGELOG.md 读的那批。
 * 一次返回两者：分两个函数取的话，「更早的 N 个版本」这句话迟早和列表对不上。
 */
export function changelogSurface(): {
  shown: ReleaseNote[];
  older: ReleaseNote[];
} {
  return {
    shown: releaseNotes.slice(0, CHANGELOG_WINDOW),
    older: releaseNotes.slice(CHANGELOG_WINDOW),
  };
}

/** 页面里那句「更早的版本见 CHANGELOG.md」的两种语言模板 */
const OLDER_RELEASES_LINE: Record<ReleaseLocale, string> = {
  zh: "本页只列最近 {max} 个版本，更早的 {n} 个版本完整记录在",
  en: "This page lists the most recent {max} releases; the earlier {n} are recorded in",
};

/**
 * 窗口之外确实有版本时才给出这句话。返回 null 而不是「更早的 0 个版本」——
 * 数字由同一份数据算出来之后，页面只需要判断有没有这句话，不需要再自己数一遍，
 * 「渲染守卫」和「句子」就不可能各说一套。
 *
 * `surface` 参数只为测试注入一个「窗口外没有版本」的发布记录；生产调用不传。
 */
export function changelogOlderLine(
  locale: ReleaseLocale,
  surface: { shown: ReleaseNote[]; older: ReleaseNote[] } = changelogSurface()
): string | null {
  if (surface.older.length === 0) return null;
  return OLDER_RELEASES_LINE[locale]
    .replace("{max}", String(CHANGELOG_WINDOW))
    .replace("{n}", String(surface.older.length));
}

export function latestRelease(): ReleaseNote | null {
  return releaseNotes[0] ?? null;
}

const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 按 ISO 日期字符串直接格式化，避免时区把日期挪到前一天。 */
export function formatReleaseDate(date: string, locale: ReleaseLocale): string {
  const match = ISO_DATE_PATTERN.exec(date);
  if (!match) return date;
  const [year, month, day] = date.split("-").map((part) => Number(part));
  if (!isReleaseDate(date)) return date;
  if (locale === "en") {
    return `${EN_MONTHS[month - 1]} ${day}, ${year}`;
  }
  return `${year}年${month}月${day}日`;
}
