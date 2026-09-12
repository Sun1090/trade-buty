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
