/**
 * CommonMark 的 flanking 规则是给拉丁文字写的：`**` 只有在「后面不是标点，或前面是
 * 空白/标点」时才能开启强调。中文句子里 `的**<mark>杠杆</mark>**交易` 这种写法，
 * 前一个 `**` 后面紧跟 `<`（标点）、前面是汉字（字母），规则判它不能开启，于是屏幕上
 * 印出两个星号。知识库里这种写法有上千处。
 *
 * remark-cjk-friendly 把 CJK 标点/文字按 CJK 排版习惯重新判定，正文里的 `**` 才是作者
 * 想要的粗体。这里既钉住几条真实课文的形状，也扫描整棵内容树，防止这颗插件被摘掉。
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { Markdown } from "./markdown";
import { prepareForRender } from "@/lib/content";

/** 每一条都抄自 content/kline-buty 的真实课文行 */
const SHAPES: [string, string][] = [
  ["中文紧跟粗体，粗体里是 mark", "远期约定价格，**<mark>杠杆</mark>**交易"],
  ["粗体包着中文引号", "这是**「重点」**内容"],
  ["表格单元里的 mark", "| a | **<mark>基差</mark>** | c |"],
  ["破折号收尾", "它诞生于需求，却在百年演化中成了投机与**<mark>对冲</mark>**并存的巨型市场。"],
];

function lessons(root: string) {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) out.push(p);
    }
  };
  walk(root);
  return out;
}

const KB_ROOT = "content/kline-buty/docs/knowledge";
/** 2026-09-24 实测：{zh,en} 两棵树各 209 个 markdown（课文 + 章节首页），共 418 */
const MIN_LESSON_FILES = 400;
/**
 * 摘掉 remark-cjk-friendly 后这个数字回到 1654（179 篇），剩下的这一小截是课文原文里
 * 本身就配对的 `**`（漏了一个后半个星号、或写了 `****`），属于知识库要修的行，
 * 不是渲染管线能猜出来的。修一篇就少一处，所以只设上限不设下限。
 */
const MAX_LITERAL_STAR_PAIRS = 24;

describe("课文里的 ** 渲染成粗体，不是两个星号", () => {
  for (const [name, src] of SHAPES) {
    it(name, () => {
      const html = renderToStaticMarkup(<Markdown content={src} />);
      expect(html).toContain("<strong>");
      expect(html).not.toContain("**");
    });
  }
});

describe("整棵内容树里的字面星号有上限", () => {
  it(
    "逐篇渲染课文，正文（不含代码块）里残留的字面 ** 不超过基线",
    () => {
      const files = lessons(KB_ROOT);
      expect(
        files.length,
        "扫描到的课文数量变少 = 这道门禁瞎了，先修扫描"
      ).toBeGreaterThanOrEqual(MIN_LESSON_FILES);

      const offenders: string[] = [];
      let total = 0;
      for (const f of files) {
        const rel = f.slice(KB_ROOT.length + 1);
        // 只扫站点真正渲染的课文：{zh,en}/<章节>/….md，知识库根目录的 README 不上站
        if (!/^(zh|en)\//.test(rel)) continue;
        const [locale, chapter] = rel.split("/");
        const raw = fs.readFileSync(f, "utf8");
        const prepared = prepareForRender(raw.replace(/^---[\s\S]*?---\n/, ""), locale, chapter);
        const html = renderToStaticMarkup(<Markdown content={prepared} />)
          .replace(/<script[\s\S]*?<\/script>/g, "")
          .replace(/<style[\s\S]*?<\/style>/g, "")
          .replace(/<pre[\s\S]*?<\/pre>/g, "")
          .replace(/<code[\s\S]*?<\/code>/g, "");
        const hits = (html.match(/\*\*/g) ?? []).length;
        if (hits > 0) offenders.push(`${rel}(${hits})`);
        total += hits;
      }
      expect(
        total,
        `正文里印出字面 ** 共 ${total} 处：${offenders.join(" ")}。数量涨了要么是渲染管线丢了 ` +
          "CJK 友好的强调规则，要么是课文本身星号没配对（后者请到 kline-buty 仓库修，本站不原地改内容）"
      ).toBeLessThanOrEqual(MAX_LITERAL_STAR_PAIRS);
    },
    180_000
  );
});
