/**
 * R16.55：从课文里「截出来」的那批界面文案，不得带着 markdown 语法或错的量词。
 *
 * 正文走 `rewriteLinks` 把相对链接换成站内路由，导语/摘要却直接从原文截——
 * `forex-trading/README.md:3` 那条 `[09-市场与品种专题篇/01-外汇市场.md](…)` 因此原样出现在
 * 22 个预渲染页面的可见文字里，另有两处进了 `<meta name="description">`。
 * 这里不逐条盯内容仓（那是 kline-buty 的地盘，本仓不得就地改它），而是把「派生出来的文案
 * 必须是纯文本」钉成断言：内容仓哪天再写一篇带链接的开头段，这条就红。
 *
 * 尖括号一条同属这里：CodeQL 在 `plainText` 上判「值里可能还剩 `<script`」——一条标签正则
 * 确实挡不住没闭合的尖括号。当前内容里首段与摘要一个尖括号都没有（下面逐条核过），所以这条
 * 断言今天不为难任何一句真实文案，它挡的是「以后有人写了半截标签却被当成已消毒」那一天。
 *
 * 运行：`npx vitest run src/lib/derived-copy-claims.test.ts`（跟随 `npm test`）
 */
import { describe, expect, it } from "vitest";
import { getChapters, getChapterSlugs, getDocMetas } from "./content";

/** 一条都没扫到 = 断言空转，所以先证明确实扫了东西 */
let scannedTaglines = 0;
let scannedDescriptions = 0;

describe("派生文案是纯文本", () => {
  for (const locale of ["zh", "en"] as const) {
    it(`${locale}：篇章导语不含未渲染的链接/加粗/反引号语法`, () => {
      for (const chapter of getChapters(locale)) {
        scannedTaglines += 1;
        expect(chapter.tagline, `${locale}/${chapter.slug} 的导语`).not.toMatch(/\]\(/);
        expect(chapter.tagline, `${locale}/${chapter.slug} 的导语`).not.toContain("**");
        expect(chapter.tagline, `${locale}/${chapter.slug} 的导语`).not.toContain("`");
        // 半截标签比没消毒更危险：这里要求一个尖括号都不剩（plainText 末尾那一步的存在理由）
        expect(chapter.tagline, `${locale}/${chapter.slug} 的导语`).not.toMatch(/[<>]/);
      }
    });

    it(`${locale}：课文摘要（含 frontmatter description）同上`, () => {
      for (const slug of getChapterSlugs(locale)) {
        for (const doc of getDocMetas(locale, slug)) {
          scannedDescriptions += 1;
          const where = `${locale}/${slug}/${doc.slug}`;
          expect(doc.description, `${where} 的摘要`).not.toMatch(/\]\(/);
          expect(doc.description, `${where} 的摘要`).not.toContain("**");
          expect(doc.description, `${where} 的摘要`).not.toContain("`");
          expect(doc.description, `${where} 的摘要`).not.toMatch(/[<>]/);
        }
      }
    });
  }

  it("确实扫过内容仓，而不是循环体一次都没进", () => {
    expect(scannedTaglines).toBeGreaterThan(50);
    expect(scannedDescriptions).toBeGreaterThan(300);
  });
});
