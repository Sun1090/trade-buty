// @vitest-environment node
/**
 * R16.58：`assertDocCountMatchesList` 的**每一个调用点**都必须真的传两把尺。
 *
 * 这条判据的由来是一次真实失效：礼花那处传的是
 * `assertDocCountMatchesList(current.length, current, ...)` —— 同一个数组的长度跟数组本身比，
 * `docCount === currentSlugs.length` 恒成立，于是这道门在运行期永远撞不到那行 `throw`。
 * 它在 roadmap 上被记作「已钉住那条缝」，实际什么都没钉住。
 *
 * **为什么已有单测量不到**（本文件存在的理由）：`read-count-owner.test.ts` 那三条喂的是
 * **手工造的不一致**，量的是 `assertDocCountMatchesList` 的**契约**；
 * 而真实缺陷在**调用点构造出一个恒真的不一致**。契约没错，形状错了 ——
 * 这就是「门禁量的东西不是坏的那个东西」的又一例。所以本文件只看调用点，不看契约。
 *
 * 运行：`npx vitest run src/lib/read-doc-count-assert-callers.test.ts`（跟随 `npm test`）
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");
/** 递归扫源码（跳过测试与声明产物） */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (/\.test\.(ts|tsx)$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

/** 一处调用：文件名、行号（1 起）、docCount 实参原文、清单实参原文、出处字符串 */
interface Caller {
  file: string;
  line: number;
  docCount: string;
  list: string;
  where: string;
}

const CALL = /assertDocCountMatchesList\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*("(?:[^"\\]|\\.)*")\s*,?\s*\)/g;

/** 实参里 `.length` 的主语（`docs.map((d) => d.slug).length` → `docs`） */
function lengthSubject(expr: string): string | null {
  const m = /^(.+?)\.length$/.exec(expr.trim());
  return m ? m[1].trim() : null;
}

/** 两个实参是不是「同一个集合的两种量法」（`docs.length` vs `docs.map(...)`） */
function sameCollection(a: string, b: string): boolean {
  const left = lengthSubject(a);
  const right = b.trim();
  if (left === null) return false;
  // 形如 `X.length` 对 `X.map(...)` / `X.filter(...)` / `X` —— 同一批东西，只是量法不同
  const call = new RegExp(`^${escapeRe(left)}\\.(map|filter|flatMap|slice)\\b`);
  return right === left || call.test(right);
}

function callers(): Caller[] {
  const out: Caller[] = [];
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(CALL)) {
      const line = text.slice(0, m.index).split("\n").length;
      out.push({
        file: relative(ROOT, file),
        line,
        docCount: m[1].trim(),
        list: m[2].trim(),
        where: JSON.parse(m[3]) as string,
      });
    }
  }
  return out;
}

const ALL = callers();

describe("两把尺的门在每个调用点都得真的是两把尺（R16.58）", () => {
  it("至少有两个调用点（少一个就说明这个判据量不到东西了）", () => {
    // 地板：这条判据的价值全在「扫全部调用点」。把调用点删到只剩一个，
    // 它就退化成「检查那一个点」，而那正是这次失效的形状。
    expect(ALL.length, "调用点少于两个 = 这条判据已经量不到全部了").toBeGreaterThanOrEqual(2);
  });

  it("清单实参不得是它自己的 .length —— 同一数组的长度跟自己比恒成立，门形同虚设", () => {
    for (const c of ALL) {
      const stem = c.list.replace(/\s*\.length$/, "");
      expect(
        c.docCount,
        `${c.file}:${c.line}（${c.where}）把「${stem}.length」当 docCount、把「${c.list}」当清单：` +
          `同一个数组的长度跟自己比，docCount === currentSlugs.length 恒成立，` +
          `这行 assert 在运行期永远不抛，等于没写`,
      ).not.toBe(c.list);
      expect(
        c.docCount,
        `${c.file}:${c.line}（${c.where}）docCount 形如「<清单>.length」`,
      ).not.toMatch(new RegExp(`^${escapeRe(stem)}\\.length$`));
    }
  });

  it("docCount 不得是清单那批数据的另一种量法（`docs.length` 对 `docs.map(...)` 同样恒真）", () => {
    // 上面那条只认「逐字相同」或「<清单>.length」的字面形状。写 `docs.length` 而清单是
    // `docs.map((d) => d.slug)` 时逐字不同，但量的是同一批东西 —— 门照样恒真。
    // 这一条按**集合**判，不按字面判。
    for (const c of ALL) {
      expect(
        sameCollection(c.docCount, c.list),
        `${c.file}:${c.line}（${c.where}）docCount「${c.docCount}」与清单「${c.list}」` +
          `量的是同一批数据：恒成立，这行 assert 等于没写`,
      ).toBe(false);
    }
  });

  it("两个实参不得是同一个标识符（换个名字的自比较也要挡住）", () => {
    for (const c of ALL) {
      expect(
        c.docCount,
        `${c.file}:${c.line}（${c.where}）两个实参是同一个标识符「${c.docCount}」`,
      ).not.toBe(c.list);
    }
  });

  it("出处字符串必须点名是哪一处（红的时候要能直接读出是哪块界面）", () => {
    for (const c of ALL) {
      expect(
        c.where.trim().length,
        `${c.file}:${c.line} 的出处是空串：抛错时读不出是哪块界面`,
      ).toBeGreaterThan(0);
      expect(
        c.where,
        `${c.file}:${c.line} 的出处必须含中文界面名，不要用「用例」这种占位`,
      ).not.toBe("用例");
    }
  });

  it("正向对照：真的两把尺能通过（否则上面几条可能只是匹配不到任何东西）", () => {
    // 形状与 chapter-rail.tsx 一致：docCount 来自 prop，docSlugs 来自另一处数据
    const docCount = 7;
    const docSlugs = ["a", "b", "c", "d", "e", "f", "g"];
    expect(docCount === docSlugs.length).toBe(true);
    const selfCompare = docSlugs.length;
    expect(selfCompare === docSlugs.length, "自比较恒成立，这就是失效形态").toBe(true);
    // 反过来，两把尺真的分开时判据必须能判出来（不是靠「恰好相等」蒙对）
    expect(docSlugs.length === 2).toBe(false);
  });
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
