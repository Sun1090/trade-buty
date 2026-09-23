/**
 * 「今天」只有一个算法：`src/lib/date-utils.ts` 的 `localDateStr`。
 *
 * 那句话写在文件头（R4.8「全站『今天』的唯一口径」），而 2026-09-23 清点时有七份私有副本
 * （`daily-goal` / `weekly-summary` / `activity-calendar` / `review-reminder` / `streak`
 * / `activity-heatmap` / `review-client`）。副本今天恰好等价，所以没有任何测试会红；
 * 真正的问题是修口径时只修得动一份——R16.38 修的就是其中一份写错的副本（回放截止日期走了 UTC）。
 *
 * 判据盯的是**形状**而不是某一种写法：`streak.ts` 那份把年月日拆成三个变量拼，
 * 按整行模板字面量写的正则根本扫不到它。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** 日历字段补零后拼成 YYYY-MM-DD —— 无论写在一行还是拆成三个变量 */
const DAY_FIELD = /getMonth\(\)\s*\+\s*1\)\s*\.padStart\(2,\s*"0"\)/;
/** 从 UTC 时间戳上切下日期：跨时区就不是用户眼里的「今天」 */
const UTC_DAY = /toISOString\(\)\s*\.\s*(?:slice\(0,\s*10\)|split\("T"\))/;

const OWNER = "src/lib/date-utils.ts";

/** 旧写法长什么样：门禁的每条正则都要先证明它抓得住这些 */
const LEGACY_ONE_LINE =
  'return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;';
const LEGACY_SPLIT_FIELDS = [
  "const yyyy = d.getFullYear();",
  'const mm = String(d.getMonth() + 1).padStart(2, "0");',
  'const dd = String(d.getDate()).padStart(2, "0");',
  "const date = `${yyyy}-${mm}-${dd}`;",
].join("\n");
const LEGACY_UTC_DAY = "const key = new Date().toISOString().slice(0, 10);";
const LEGACY_UTC_DAY_ALT = 'const key = new Date().toISOString().split("T")[0];';

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(rel));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes(".test.")) continue;
    out.push(rel);
  }
  return out;
}

const FILES = sourceFiles("src");
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("本地日历口径只有一个持有者", () => {
  it("扫描面本身不能是空的，否则下面全是空转", () => {
    expect(FILES.length, "没扫到源码文件就是扫描器坏了").toBeGreaterThan(100);
    expect(FILES).toContain(OWNER);
  });

  it("持有者自己确实定义着这个口径", () => {
    const owner = read(OWNER);
    expect(owner).toContain("export function localDateStr");
    const built = [...owner.matchAll(new RegExp(DAY_FIELD, "g"))];
    expect(built, "口径的构造式应当恰好有一份").toHaveLength(1);
    // 非空转：两条判据都得抓得住旧写法
    expect(DAY_FIELD.test(LEGACY_ONE_LINE), "判据抓不住整行写法").toBe(true);
    expect(DAY_FIELD.test(LEGACY_SPLIT_FIELDS), "判据抓不住拆分写法").toBe(true);
    expect(UTC_DAY.test(LEGACY_UTC_DAY), "判据抓不住 slice 写法").toBe(true);
    expect(UTC_DAY.test(LEGACY_UTC_DAY_ALT), "判据抓不住 split 写法").toBe(true);
  });

  it("除持有者以外没有第二处拼日历日，也没有从 UTC 上切日期", () => {
    const dayOffenders: string[] = [];
    const utcOffenders: string[] = [];
    for (const rel of FILES) {
      if (rel === OWNER) continue;
      const src = read(rel);
      if (DAY_FIELD.test(src)) dayOffenders.push(rel);
      if (UTC_DAY.test(src)) utcOffenders.push(rel);
    }
    expect(
      dayOffenders,
      `日历日只能由 date-utils 拼：\n${dayOffenders.join("\n")}`,
    ).toEqual([]);
    expect(utcOffenders, `界面/存储里的「今天」不走 UTC 口径：\n${utcOffenders.join("\n")}`).toEqual(
      [],
    );
  });

  it("用到 localDateStr 的文件都真的从 date-utils 取", () => {
    const users = FILES.filter((rel) => rel !== OWNER && read(rel).includes("localDateStr"));
    expect(users.length, "没有消费方 = 这条核对空转").toBeGreaterThan(3);
    for (const rel of users) {
      expect(
        /import\s*\{[^}]*\blocalDateStr\b[^}]*\}\s*from\s*"[^"]*date-utils"/.test(read(rel)),
        `${rel} 用了 localDateStr 却没从 date-utils 导入（多半是又留了一份本地副本）`,
      ).toBe(true);
    }
  });
});
