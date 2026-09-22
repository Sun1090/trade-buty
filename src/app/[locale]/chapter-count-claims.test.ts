/**
 * 界面在好几处告诉用户「N 篇章覆盖完整交易知识体系」（首页描述、AI 页副标题、
 * 学习路径、关于页、FAQ）。N 必须是知识库*此刻*的篇章数：`npm run kb:update` 加一章
 * 之后，写死的数字不会跟着动，而没有人会想起去改五句文案。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { totalChapterCount, withChapterCount } from "@/lib/content";

function pageFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      pageFiles(full, out);
    } else if (/page\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const CLAIM = /(\d+)\s*(?:个?篇章|chapters?\b)/g;

describe("篇章总数不得写死在用户可见的文案里", () => {
  const files = [...pageFiles(path.join(process.cwd(), "src/app")), path.join(process.cwd(), "src/lib/i18n.ts")];

  it("扫描范围本身非空", () => {
    expect(files.some((f) => f.endsWith("i18n.ts")), "i18n 必须在扫描范围内").toBe(true);
    expect(files.length, "页面文件必须扫到").toBeGreaterThan(10);
  });

  it("页面与文案里没有一个写死的篇章数", () => {
    const hits: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(CLAIM)) {
        hits.push(`${path.relative(process.cwd(), file)}: ${m[0]}`);
      }
    }
    expect(
      hits,
      `改用 {chapters} 占位符（配 withChapterCount）或 totalChapterCount()：\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  it("占位符代入的就是知识库的真实篇章数", () => {
    const n = totalChapterCount();
    expect(n, "真实篇章数必须扫得出来，否则这条门禁是空转").toBeGreaterThan(10);
    expect(withChapterCount("{chapters} 篇章分级课程")).toBe(`${n} 篇章分级课程`);
    expect(withChapterCount("en: {done}/{chapters} chapters")).toBe(`en: {done}/${n} chapters`);
    expect(withChapterCount("没有占位符的文案")).toBe("没有占位符的文案");
  });
});
