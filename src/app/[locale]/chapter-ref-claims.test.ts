/**
 * 界面文案抄过知识库的篇章身份：「三站式路径」「第 08 篇会教你为什么」「对照 06 · 技术分析篇」
 * 「第 01 课 →」。编号和名字都归 kline-buty 管，`npm run kb:update` 一旦重排或改名，
 * 这些句子会整体变成假话，而当时没有任何测试会因此变红（R16.13 就是同一类问题的上游版本）。
 * 现在身份只能算出来：文案写 `{stages}` / `{lastCore}` / `{chapter:<slug>}`，
 * 由 `withCopyRefs` 在渲染时代入当期标题；这份门禁负责证明代入的确实是指向真实篇章。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDict, LOCALES } from "@/lib/i18n";
import { STAGES, getStageGroups, withCopyRefs } from "@/lib/path";
import { chapterRef, getChapterSlugs } from "@/lib/content";

/** 每条禁令都要先证明它能抓住当年那句真话 */
const LEGACY: Array<[string, RegExp]> = [
  ["三站式路径：先走完「入门主线」", /第\s*\d+\s*[篇课]|三站式/],
  ["不要跳读——第 08 篇会教你为什么", /第\s*\d+\s*[篇课]/],
  ["对照「06 · 技术分析篇」练习", /\d{2}\s*·\s*[\u4e00-\u9fa5]/],
  ["Study in order — Lesson 08 will show you why.", /(?:Chapter|Lesson)\s+\d+/],
  ["lesson1: \"第 01 课 →\"", /第\s*\d+\s*[篇课]/],
];

const BANNED = [/第\s*\d+\s*[篇课]/, /\d{2}\s*·\s*[\u4e00-\u9fa5]/, /(?:Chapter|Lesson)\s+\d+/];

function copyFiles(): string[] {
  const out: string[] = [path.join(process.cwd(), "src/lib/i18n.ts")];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") out.push(full);
    }
  };
  walk(path.join(process.cwd(), "src/app"));
  return out;
}

describe("行情角标不得写死", () => {
  /** 图表页曾经在 K 线上方印一行 `BTCUSDT · 4H`：标的与周期都是用户自己选的，
   *  默认周期还是 1h——那一行从第一次渲染起就不是真话。 */
  const LEGACY_CAPTION = '<p className="text-xs font-mono text-faint">BTCUSDT · 4H</p>';
  const CAPTION = /[A-Z0-9]+USDT\s*·\s*\d+[a-z]/i;

  it("禁令抓得住那行角标", () => {
    expect(CAPTION.test(LEGACY_CAPTION)).toBe(true);
  });

  it("页面里不再出现写死的「标的 · 周期」", () => {
    const hits = copyFiles()
      .map((f) => [path.relative(process.cwd(), f), fs.readFileSync(f, "utf8")] as const)
      .filter(([, src]) => CAPTION.test(src))
      .map(([f, src]) => `${f}: ${src.match(CAPTION)?.[0]}`);
    expect(hits, `行情标识只能由图表组件按当前状态渲染：\n${hits.join("\n")}`).toEqual([]);
  });
});

describe("篇章身份不得抄进文案", () => {
  it("禁令本身抓得住当年的五句原话", () => {
    for (const [sample, re] of LEGACY) {
      expect(re.test(sample), `正则抓不住样例：${sample}`).toBe(true);
    }
  });

  it("字典与页面里再无手写的篇章编号", () => {
    const files = copyFiles();
    expect(files.length, "扫描面必须包含页面文件").toBeGreaterThan(10);
    expect(files.some((f) => f.endsWith("i18n.ts"))).toBe(true);
    const hits: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const re of BANNED) {
        for (const m of src.matchAll(new RegExp(re, "g"))) {
          hits.push(`${path.relative(process.cwd(), file)}: ${m[0]}`);
        }
      }
    }
    expect(hits, `改用 {stages} / {lastCore} / {chapter:<slug}>\n${hits.join("\n")}`).toEqual([]);
  });
});

describe("占位符代入的就是知识库当下的篇章", () => {
  const referenced = [...fs.readFileSync(path.join(process.cwd(), "src/lib/i18n.ts"), "utf8")
    .matchAll(/\{chapter:([a-z0-9-]+)\}/g)].map((m) => m[1]);

  it("文案引用的 slug 在两种语言里都存在且有导语", () => {
    expect(referenced.length, "至少要有一处 {chapter:slug} 引用，否则这条门禁是空转").toBeGreaterThan(0);
    for (const locale of LOCALES) {
      const slugs = getChapterSlugs(locale);
      for (const slug of new Set(referenced)) {
        expect(slugs, `${locale} 没有篇章 ${slug}`).toContain(slug);
        expect(chapterRef(locale, slug), `${locale}/${slug} 渲染成了裸 slug（导语缺失）`).not.toBe(slug);
      }
    }
  });

  it("路径页的三句都代入成真实标题，不留占位符", () => {
    for (const locale of ["zh", "en"] as const) {
      const t = getDict(locale).path;
      const core = getStageGroups(locale).find((g) => g.stage.id === "core");
      const last = core?.chapters[core.chapters.length - 1];
      expect(last, "主线必须扫得出最后一站").toBeDefined();

      const intro = withCopyRefs(locale, t.intro);
      expect(intro).not.toMatch(/\{(stages|lastCore|chapter:[a-z0-9-]+)\}/);
      expect(intro).toContain(String(STAGES.length));
      expect(intro).toContain(last!.title);

      const cta = withCopyRefs(locale, t.lesson1);
      expect(cta).not.toContain("{");
      expect(cta).toContain(chapterRef(locale, "getting-started"));
    }
  });

  it("页面确实把这几句代入过再渲染（漏掉代入就会露出 {…}）", () => {
    const wires: Array<[string, string[]]> = [
      ["src/app/[locale]/path/page.tsx", ["t.path.intro", "t.path.lesson1"]],
      ["src/app/[locale]/chart/page.tsx", ["t.chart.intro", "t.intro"]],
    ];
    for (const [file, keys] of wires) {
      const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      for (const key of keys) {
        const wrapped = src.includes(`withCopyRefs(locale, ${key})`);
        const bare = new RegExp(`\\{${key}\\}|: ${key},`).test(src);
        expect(wrapped, `${file} 没有把 ${key} 交给 withCopyRefs`).toBe(true);
        expect(bare, `${file} 还在直接渲染未代入的 ${key}`).toBe(false);
      }
    }
  });

  it("图表页引用的技术分析篇就是它此刻的编号与名字", () => {
    for (const locale of ["zh", "en"] as const) {
      const intro = withCopyRefs(locale, getDict(locale).chart.intro);
      expect(intro).not.toContain("{");
      expect(intro).toContain(chapterRef(locale, "technical-analysis"));
      expect(chapterRef(locale, "technical-analysis")).toMatch(/^0?6\s*·/);
    }
  });
});
