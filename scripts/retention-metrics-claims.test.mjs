/**
 * R16.246：`docs/retention-metrics.md` 那张「修剪策略」表必须逐行对得上实现。
 *
 * 这一张表是仓库里回答「你的数据到底留多久」的地方——隐私页、导出工具、以后任何「留多久」
 * 的争论都引它。它写「无上限」，意思就是这本台账不会被裁；写 90，就得是代码里那个 90。
 * 本轮动手之前它有五处不实（两条键名根本不存在、两条「无上限」其实有裁剪、一条窗口口径
 * 说成了「最近 90 天」而代码锚的是台账最后一天）。判据全部回 `.ts` 现读：读不到实现文件、
 * 数字对不上、或「无上限」那行其实藏着一次裁剪，都当场红。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const noBold = (s) => s.replace(/\*\*/g, "");
const flat = (s) => noBold(s).replace(/\s+/g, "");

const doc = read("docs/retention-metrics.md");

/** §2 那张表：{ key, owner, cell, capped } */
function rows() {
  const body = doc.slice(doc.indexOf("## 2."), doc.indexOf("\n## 3."));
  return body
    .split("\n")
    .filter((l) => /^\| `tb-/.test(l))
    .map((l) => {
      const cells = l.split(/(?<!\\)\|/);
      const first = cells[1] ?? "";
      const cell = cells[2] ?? "";
      return {
        key: (/`(tb-[a-z0-9-]+)`/.exec(first) ?? [])[1] ?? "",
        owner: (/`((?:src|scripts)\/[^`]+)`/.exec(first) ?? [])[1] ?? "",
        cell,
        uncapped: cell.includes("无上限"),
        numbers: [...cell.matchAll(/\d+/g)].map((m) => m[0]),
      };
    });
}

/** 实现文件里能站住的上限数字：本文件的常量、`slice(-N)`，以及它相对导入里的同款。 */
function capNumbers(rel, seen = new Set()) {
  if (seen.has(rel)) return new Set();
  seen.add(rel);
  const src = readFileSync(path.join(root, rel), "utf8");
  const nums = new Set();
  for (const m of src.matchAll(/(?:const|let)\s+[A-Z_][A-Z0-9_]*\s*=\s*(\d+)/g)) nums.add(m[1]);
  for (const m of src.matchAll(/slice\(-(\d+)\)/g)) nums.add(m[1]);
  for (const m of src.matchAll(/from\s+"\.\/([\w.-]+)"/g)) {
    const dep = path.join(path.dirname(rel), `${m[1]}.ts`).replace(/\\/g, "/");
    if (existsSync(path.join(root, dep))) {
      for (const n of capNumbers(dep, seen)) nums.add(n);
    }
  }
  return nums;
}

const TRIM_SIGNAL = /slice\(|cutoff|MAX_[A-Z0-9_]*|_KEEP\b/;
const table = rows();

describe("修剪策略表逐行对上实现文件", () => {
  it("每一行都点名的了实现文件，行数不许悄悄变少", () => {
    expect(table.length, "§2 那张表没解析出任何一行").toBeGreaterThanOrEqual(6);
    for (const r of table) {
      expect(r.key, "有一行没写出它的存储键").toBeTruthy();
      expect(r.owner, `${r.key} 那一行没有点名实现文件`).toBeTruthy();
      expect(existsSync(path.join(root, r.owner)), `${r.key} 点名的 ${r.owner} 不存在`).toBe(true);
    }
  });

  for (const r of table) {
    it(`${r.key} 的上限策略就是 ${r.owner} 里做的那些`, () => {
      const src = read(r.owner);
      const trimmed = TRIM_SIGNAL.test(src);
      if (r.uncapped) {
        expect(trimmed, `${r.key} 写着「无上限」，可 ${r.owner} 里有一次裁剪（${src.match(TRIM_SIGNAL)?.[0]}）`).toBe(false);
        expect(r.numbers, `「无上限」那一行还写了数字：${r.numbers.join("、")}`).toEqual([]);
        return;
      }
      expect(trimmed, `${r.key} 给了一道窗口，实现文件里却找不到任何裁剪`).toBe(true);
      expect(r.numbers.length, `${r.key} 那一行一个数都没写，窗口是多少无从查起`).toBeGreaterThan(0);
      const nums = capNumbers(r.owner);
      for (const n of r.numbers) {
        expect(nums.has(n), `${r.key} 那一行的 ${n} 在 ${r.owner}（含它相对导入的文件）里找不到对应的上限`).toBe(true);
      }
    });
  }

  it("「因此」那一段点名的窗口数与无上限数就是表里的", () => {
    const capped = table.filter((r) => !r.uncapped).length;
    const openEnded = table.filter((r) => r.uncapped).map((r) => r.key);
    const para = flat(doc.slice(doc.indexOf("**因此**"), doc.indexOf("\n## 3.")));
    expect(capped, "有窗口的台账少到不正常").toBeGreaterThanOrEqual(3);
    expect(openEnded.length).toBeGreaterThanOrEqual(2);
    expect(para, `正文写的「有窗口」本数不是 ${capped}`).toContain(`${capped}本台账是有窗口的`);
    expect(para, `正文写的「没有裁剪」本数不是 ${openEnded.length}`).toContain(`剩下${openEnded.length}本`);
    for (const key of openEnded) {
      expect(para, `正文那串括号里漏了 ${key}（或写进了其实有裁剪的台账）`).toContain(key);
    }
    expect(noBold(doc).match(/`(tb-[a-z0-9-]+)`/g).length, "文档点名的存储键太少，扫描八成没跑起来")
      .toBeGreaterThanOrEqual(8);
  });

  it("文档点名的每一个存储键都真的在代码里", () => {
    const keys = [...new Set([...doc.matchAll(/`(tb-[a-z0-9-]+)/g)].map((m) => m[1]))];
    expect(keys.length).toBeGreaterThanOrEqual(8);
    const code = [];
    (function walk(dir) {
      for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
        if (e.isDirectory()) walk(`${dir}/${e.name}`);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) code.push(`${dir}/${e.name}`);
      }
    })("src");
    const all = code.map((rel) => read(rel)).join("\n");
    for (const k of keys) {
      expect(all.includes(k), `文档指着 ${k}，src 下（排除测试）没有任何一处用到它`).toBe(true);
    }
  });
});
