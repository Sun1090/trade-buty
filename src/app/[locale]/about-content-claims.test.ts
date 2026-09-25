/**
 * R16.196：关于页说「每章包含……真实 K 线图练习」，而图表只挂在其中一个篇章里。
 *
 * 课文页的图表内嵌是有条件的：`chapterSlug === "technical-analysis"` 才渲染
 * `<LazyChartEmbed>`（`[doc]/page.tsx:348`），其余篇章拿到的是一条 aside
 * （「📖 学完这篇，去看真盘」+ 一颗指向 `/chart` 的按钮）。测验那头倒是真的每章都有
 * （`src/lib/quizzes.ts` 里 27 个 `chapterNum`，知识库 zh 侧也是 27 个篇章目录）。
 * 所以那句「每章包含理论、真实 K 线图练习和测验」把一件全站共用的事说成了每章各自配了一份
 * ——读它的人会以为某个篇章的课文里就有图可看，点进去只有一颗按钮。
 *
 * 判据不能只是「不许出现某些字」，否则把整句删掉就满足了它。这里两头都夹：
 * - 不许把图表练习分给「每一章」（`PER_CHAPTER_CHART`，跨句不算，句号截断）；
 * - 必须点名图表练习真的所在的那两个入口，而那两个名字**取自导航字典**（漂移就红）；
 * - 事实半边自己也要在：课文页那个条件渲染必须还在，且只有一处。
 * 外加一条正向对照：旧那两句喂给同一个判据，必须报出来。
 *
 * 这个文件管的是**关于页上那些替整站作保的句子**：第二段（R16.232）是那块邮件订阅占位的说明。
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDict } from "@/lib/i18n";

const ABOUT_SRC = "src/app/[locale]/about/page.tsx";
const LESSON_SRC = "src/app/[locale]/knowledge/[chapter]/[doc]/page.tsx";

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

/** 「每一章都配了图表练习」这一种说法 */
const PER_CHAPTER_CHART = {
  zh: /每[个]?章[^。]{0,40}?(K ?线|行情图|真盘)/,
  en: /each chapter[^.]{0,60}?(k-line|real [a-z ]*chart|market chart)/i,
} as const;

/** 抠出关于页那句带 `{chapters}` 占位符的话（en 与 zh 各一份） */
function chapterCountSentence(): { en: string; zh: string } {
  const m = read(ABOUT_SRC).match(/withChapterCount\(\s*en\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"\s*\)/);
  expect(m, "关于页里找不到那句带 {chapters} 的话——句式变了要同步改这里的判据").toBeTruthy();
  const [, en, zh] = m as unknown as [string, string, string];
  expect(en).toContain("{chapters}");
  expect(zh).toContain("{chapters}");
  return { en, zh };
}

describe("关于页不许把图表练习算成每一章各自有的东西", () => {
  const sentence = chapterCountSentence();

  for (const locale of ["zh", "en"] as const) {
    it(`${locale}: 现句子没有把图表练习分给每一章`, () => {
      expect(sentence[locale], `句子：${sentence[locale]}`).not.toMatch(PER_CHAPTER_CHART[locale]);
    });

    it(`${locale}: 正向对照——旧写法必须被同一个判据报出来`, () => {
      const legacy = locale === "zh"
        ? "内容分为 {chapters} 个篇章。每章包含理论、真实 K 线图练习和测验。"
        : "Content is organized into {chapters} chapters. Each chapter includes theory, real-world K-line chart practice, and quizzes.";
      expect(legacy).toMatch(PER_CHAPTER_CHART[locale]);
    });
  }

  it("现句子点名的那两个入口，名字就是导航里的那两个", () => {
    const nav = getDict("zh").nav;
    const enNav = getDict("en").nav;
    // 站点自己的叫法：zh「行情」「回放」，en "Markets" "Replay"（R16.170：一物一名）
    expect(sentence.zh).toContain(nav.chart);
    expect(sentence.zh).toContain(nav.replay);
    expect(sentence.en).toContain(enNav.chart);
    expect(sentence.en).toContain(enNav.replay);
  });

  it("事实半边：课文页只在技术分析那一章内嵌图表，其余篇章得到的是一颗星链接", () => {
    const lesson = read(LESSON_SRC);
    const embeds = lesson.match(/chapterSlug === "technical-analysis" \? \(\s*<LazyChartEmbed/g);
    expect(embeds, "课文页的图表内嵌条件渲染不止一处，或已被改掉——这里的判据要跟着改").toHaveLength(1);
    // 另一支必须真的只是把用户送去图表页：一颗指向 /chart 的链接
    const ctaLinks = lesson.match(/href=\{p\("\/chart"\)\}/g);
    expect(ctaLinks, "课文页那条「去看真盘」的链接形状变了，这里的判据要跟着改").toHaveLength(1);
    expect(lesson).toContain("t.doc.practiceCta");
  });
});

/**
 * R16.232：邮件订阅那块写「功能开发中」，而它不是「开发中」——是占位。
 *
 * 原文（zh `i18n.ts:340` / en `:751`）「邮件订阅功能开发中。当前邮箱仅保存在本机浏览器，不会上传。」
 * 后半句是准确的，前半句断言了一件没人排期做的事：全仓库没有邮件服务（`src/app/api/` 下没有
 * 任何 newsletter/subscribe 路由，`src/lib/newsletter.ts` 一次网络请求都不发），`docs/roadmap.md`
 * 里也没有「接邮件订阅」这一项。一个等三年的访客读到「开发中」得到的是错的预期；诚实的说法只说现在：
 * 这是一块占位，数据只在本机，出口就是那两颗按钮。
 *
 * 判据两头夹（只禁字的话把整句删掉就满足了）：
 * - 禁「开发中/即将/coming soon/under construction」这类对将来的断言，旧写法作正向对照；
 * - 必须点名两颗出口按钮，而按钮名字**取自字典本身**（改按钮文案而忘了改说明即红）；
 * - 事实半边自己也要在：这一层没有后端，也没有邮件端点。
 */
const NEWSLETTER_LIB_SRC = "src/lib/newsletter.ts";
const NEWSLETTER_CARD_SRC = "src/components/newsletter-signup.tsx";
const PLACEHOLDER_BUT_PROMISED =
  /开发中|即将|不日|敬请期待|即将上线|under construction|coming soon|in the works|work in progress/i;
/**
 * 「此刻就在下面」这一类位置词。那两颗出口按钮只在**已保存**视图里渲染
 * （`newsletter-signup.tsx:96` 的 `{saved ? … : <form>}`），没存过邮箱的访客读到
 * 「下面那两颗按钮」会低头找一颗屏幕上不存在的按钮 —— 这一版文案我自己就先写错了，
 * 真浏览器复核（`.gate-logs/verify-r24.mjs`）在 `zh/empty` 与 `en/empty` 两个状态下都报
 * 「此刻不在屏幕上的：["复制 JSON","清除"]」。说明要么点明前提，要么别指位置。
 */
const POINTS_AT_WHAT_IS_THERE = /下面|下方|这一行下|\bbelow\b|right under/i;
const ONLY_AFTER_SAVING = /保存之后|保存后|存好之后|一旦保存|\bonce\b|after saving|once (it is )?saved/i;

describe("邮件订阅占位不许替一个没排期的功能作保", () => {
  for (const locale of ["zh", "en"] as const) {
    const labels = getDict(locale).newsletter;

    it(`${locale}: 说明只说现在，不断言将来`, () => {
      expect(labels.desc, `说明：${labels.desc}`).not.toMatch(PLACEHOLDER_BUT_PROMISED);
      // 这一句同时把「这块叫占位」钉住：标题里就有「占位 / placeholder」，说明也不许把它说成在建工程
      expect(labels.title.toLowerCase()).toMatch(/占位|placeholder/);
    });

    it(`${locale}: 正向对照——旧写法必须被同一个判据报出来`, () => {
      const legacy = locale === "zh"
        ? "邮件订阅功能开发中。当前邮箱仅保存在本机浏览器，不会上传。"
        : "Email subscription is under construction. For now, your email stays in this browser only.";
      expect(legacy).toMatch(PLACEHOLDER_BUT_PROMISED);
    });

    it(`${locale}: 点名的那两颗按钮就是字典里的那两个名字`, () => {
      expect(labels.desc, "说明里没提「清除」，可用户看到的那颗按钮叫这个").toContain(labels.clear);
      expect(labels.desc, "说明里没提那颗导出按钮的真名").toContain(labels.copy);
    });

    it(`${locale}: 说明不许指着此刻不在屏幕上的按钮`, () => {
      expect(labels.desc, `说明：${labels.desc}`).not.toMatch(POINTS_AT_WHAT_IS_THERE);
      expect(labels.desc, "那两颗按钮只在「已保存」视图里渲染，说明要先交代这个前提").toMatch(ONLY_AFTER_SAVING);
    });

    it(`${locale}: 正向对照——「下面那两颗按钮」这种写法必须被同一个判据报出来`, () => {
      const legacy = locale === "zh"
        ? "想拿回去或清掉，用的是下面「复制 JSON」和「清除」这两颗按钮。"
        : "The two buttons below, “Copy JSON” and “Clear”, are its only ways out.";
      expect(legacy).toMatch(POINTS_AT_WHAT_IS_THERE);
      expect(legacy).not.toMatch(ONLY_AFTER_SAVING);
    });
  }

  it("事实半边：那两颗出口按钮确实只在「已保存」分支里渲染", () => {
    const src = read(NEWSLETTER_CARD_SRC);
    const branch = src.match(/\{saved \? \(([\s\S]*?)\n\s*\) : \(/);
    expect(branch, "卡片不再是 `saved ? 已保存视图 : 表单` 的形状——这条判据要按新结构重写").toBeTruthy();
    expect(branch![1]).toContain("labels.copy}");
    expect(branch![1]).toContain("labels.clear}");
    // 未保存那一支里一颗都不许有：那正是说明不能直接指着它们的原因
    expect(src.slice(branch.index! + branch[0].length)).not.toContain("labels.copy}");
    expect(src.slice(branch.index! + branch[0].length)).toContain("labels.submit}");
  });

  it("事实半边：这一层确实只有本机存储，没有邮件服务", () => {
    const lib = read(NEWSLETTER_LIB_SRC);
    // 一次网络请求都不发：有了任何一支，「不会上传」这句就先该改
    expect(lib).not.toMatch(/\bfetch\(|XMLHttpRequest|\/api\//);
    expect(lib.match(/localStorage/g), "本机存储的引用形状变了，这里的判据要跟着改").not.toBeNull();
    const routes = readdirSync(path.join(process.cwd(), "src/app/api"), { recursive: true })
      .map(String)
      .filter((f) => /newsletter|subscribe|subscription/i.test(f));
    expect(routes, `站内出现了邮件订阅端点（${routes.join("、")}），那句「站内没有邮件服务」就该重写`).toEqual([]);
  });
});
