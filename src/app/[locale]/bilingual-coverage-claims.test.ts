/**
 * 站内有三处文案在替「双语覆盖」说话：学习路径页的 note、FAQ 的语言答案、
 * 404 的 `docHint`（R16.43）。它们都写成了完成时，而这个状态是会变的——
 * 英文翻译是知识库逐步补上来的，覆盖一旦回退（少篇章、少课时，或某篇仍是中文），
 * 文案就得改回「正在翻译」，不能继续替用户撒这个谎。
 *
 * 所以这里两边都对账：先从知识库算出**此刻**的覆盖，再看文案**说的是不是**那个覆盖。
 * 只钉一边不够——把文案删空也过不了第 2 条。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getChapterSlugs, getDocMetas } from "@/lib/content";

const KB_ROOT = path.join(process.cwd(), "content/kline-buty/docs/knowledge");

/** 历史上出现过的「英文还没翻完」句式；换一种说法也要在这里登记，否则门禁扫不到 */
const PARTIAL_CLAIM =
  /(正在翻译|尚未翻译|仍是中文|部分章节|translation in progress|being translated|may still be in Chinese|not translated yet)/i;

function copyFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      copyFiles(full, out);
    } else if (/\.(tsx?)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** 非空白字符里中日韩表意文字占的比例——用来抓「文件名是英文、正文其实还是中文」 */
function cjkRatio(text: string): number {
  const chars = [...text].filter((c) => !/\s/.test(c));
  if (chars.length === 0) return 0;
  const cjk = chars.filter((c) => /[㐀-鿿぀-ヿ]/.test(c)).length;
  return cjk / chars.length;
}

function lessonFiles(locale: string): string[] {
  return getChapterSlugs(locale).flatMap((slug) =>
    getDocMetas(locale, slug).map((meta) => path.join(KB_ROOT, locale, slug, meta.fileName)),
  );
}

const zhChapters = getChapterSlugs("zh").slice().sort();
const enChapters = getChapterSlugs("en").slice().sort();
const zhLessons = zhChapters.reduce((n, slug) => n + getDocMetas("zh", slug).length, 0);
const enLessons = enChapters.reduce((n, slug) => n + getDocMetas("en", slug).length, 0);
const coverageComplete =
  zhChapters.length === enChapters.length &&
  zhLessons === enLessons &&
  zhChapters.every((slug) => enChapters.includes(slug));

describe("双语覆盖文案与知识库此刻的覆盖对账（R16.43）", () => {
  const files = [...copyFiles(path.join(process.cwd(), "src/app")), path.join(process.cwd(), "src/lib/i18n.ts")];

  it("扫描面本身非空，且真的包含文案文件", () => {
    expect(files.some((f) => f.endsWith("i18n.ts")), "i18n 必须在扫描范围内").toBe(true);
    expect(files.length, "页面文件必须扫到").toBeGreaterThan(10);
  });

  it("知识库读得出两边的篇章与课时", () => {
    expect(zhChapters.length, "中文篇章数扫不出来就是空转").toBeGreaterThan(10);
    expect(enChapters.length).toBeGreaterThan(10);
  });

  /**
   * 这条钉的是**事实**：两边的篇章集合、课时数必须一致，且英文篇没有哪一篇其实还是中文。
   * 覆盖回退时这里红，而不是等用户来报「你说都翻好了，这点怎么是中文」。
   */
  it("英文覆盖与中文逐章对齐，且没有哪一课其实仍是中文", () => {
    expect(enChapters, "英文篇章集合与中文不同").toEqual(zhChapters);
    expect(enLessons, "英文课时数与中文不同").toBe(zhLessons);

    const stillChinese = lessonFiles("en")
      .map((file) => ({ file: path.relative(KB_ROOT, file), ratio: cjkRatio(fs.readFileSync(file, "utf8")) }))
      .filter((item) => item.ratio > 0.1);
    expect(
      stillChinese.map((item) => `${item.file} (${(item.ratio * 100).toFixed(1)}% 中日韩文字)`),
      "这些英文课程正文其实还是中文",
    ).toEqual([]);
  });

  /**
   * 这条钉的是**说法**：覆盖完整时，任何用户可见文案都不许再讲「还在翻译中」；
   * 反过来，覆盖一旦不完整，文案就必须讲出来——两边都堵，才不会往任一侧漂。
   */
  it("文案说的是此刻的覆盖，不是曾经的了", () => {
    const hits: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const line of src.split("\n")) {
        if (PARTIAL_CLAIM.test(line)) {
          hits.push(`${path.relative(process.cwd(), file)}: ${line.trim().slice(0, 90)}`);
        }
      }
    }

    if (coverageComplete) {
      expect(hits, `英文已全覆盖，这些文案还在说翻译中：\n${hits.join("\n")}`).toEqual([]);
    } else {
      expect(
        hits.length,
        `覆盖已回退（zh ${zhLessons} 课 / en ${enLessons} 课），文案却不再告诉用户翻译进度`,
      ).toBeGreaterThan(0);
    }
  });
});
