/**
 * R16.55：从课文里「截出来」的那批界面文案，不得带着 markdown 语法或错的量词。
 *
 * 正文走 `rewriteLinks` 把相对链接换成站内路由，导语/摘要却直接从原文截——
 * `forex-trading/README.md:3` 那条 `[09-市场与品种专题篇/01-外汇市场.md](…)` 因此原样出现在
 * 22 个预渲染页面的可见文字里，另有两处进了 `<meta name="description">`。
 * 这里不逐条盯内容仓（那是 kline-buty 的地盘，本仓不得就地改它），而是把「派生出来的文案
 * 必须是纯文本」钉成断言：内容仓哪天再写一篇带链接的开头段，这条就红。
 *
 * 尖括号一条同属这里：`plainText` 早先用一条标签正则清尖括号，CodeQL 判「值里可能还剩
 * `<script`」——那个判断在当时是对的，没闭合的标签确实留着半个括号。如今那一步改成逐字符扫描，
 * 成对区间整段去掉、落单括号只删自己。当前内容里首段与摘要一个尖括号都没有（下面逐条核过），
 * 所以这条断言今天不为难任何一句真实文案，它挡的是「以后有人写了半截标签却被当成已消毒」那一天。
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
        // 半截标签比没消毒更危险：这里要求一个尖括号都不剩（plainText 扫描那一步的存在理由）
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

/**
 * R16.293：篇章导语**不许宣称自己是全站的第一篇或最后一篇**。
 *
 * `content/kline-buty/docs/knowledge/{zh,en}/pitfalls/README.md` 的首段写
 * 「这是知识库的最后一站」（en: "This is the last stop of the knowledge base"），
 * 而 `getChapters()` 按站内学习路径排下来它是**第 9 个**，后面还有 18 篇
 * （`kb-order.ts` 的 `CHAPTER_ORDER` 共 27 项，真正最后那篇是 `options-strategies`）。
 * `/path` 把这一行当导语原样渲染，同一屏上方还印着「27 篇章 × 3 阶段」——
 * 读者刚读完「最后一站」，下一格又是一篇新篇章。
 *
 * 为什么在这里挡而不是去内容仓改：本仓不得就地改 submodule（AGENTS.md 明写），而
 * 「主线最后一站」还是「知识库最后一站」属**内容作者的措辞**，改哪一种都该由 kline-buty 那边决定。
 * 本侧能做的、也该做的是把**可判定的部分**钉住：一句话若声称「首/末」，它必须真的在首或末。
 * 措辞往「主线」「本篇」收窄后这条自然放行，不需要本仓替作者选。
 *
 * 为什么这条不能是纯禁词：踩到的是「**全站**的最后一站」这句话，与「本篇是这一章的最后一课」
 * 这类合法的局部说法形状相同。所以判据按**位置**判——先算出该篇在站内顺序里的名次与总数，
 * 再要求「声明末」必须名次 == 总数、「声明首」必须名次 == 1，中间的篇章一律不许说这两种话。
 * 下面那条正向对照要证明探测器认得这两种形状，否则「0 处违规」可能只是没扫到。
 *
 * **当前有一处已知违规，它在内容仓，本仓改不了**：`pitfalls` 的导语（zh/en 同）
 * 宣称「知识库的最后一站」，而它排在第 9/27。按 AGENTS.md，本仓**不得就地改 submodule**；
 * 改口属内容仓（kline-buty）那边的事，措辞该收窄成「主线最后一站」还是真把它排到最后，
 * 都由内容作者定。所以这里用与 `scripts/audit-all.mjs` 同一个例外机制（R16.288）：
 * 一条带 slug / 理由 / **重审日**的豁免，过期自动转红——不让例外静默烂在那里。
 * 豁免清单一旦为空，下面的用例自动回到「零容忍」，不需要再改代码。
 */
/**
 * 已知违规的豁免清单。每条必须写明 **重审日**（`revisit`），过期即失效——
 * 与 `scripts/audit-all.mjs` 的 GHSA 白名单同一条规矩：例外可以存在，但不许无声地长期存在。
 *
 * `slug`：违规的那一篇。`reason`：为什么本仓不能自己修。`revisit`：最迟什么时候必须再看一眼。
 */
const FIRST_LAST_EXEMPTIONS: { slug: string; reason: string; revisit: string }[] = [
  {
    slug: "pitfalls",
    reason:
      "导语宣称「知识库的最后一站」，实际排第 9/27。内容在 submodule content/kline-buty，" +
      "本仓不得就地改（AGENTS.md）；改口属内容仓那边的事。",
    // 内容仓那边改口（或内容补全到 27 篇之后重排）之后，删掉这条豁免即可。
    revisit: "2026-11-04",
  },
];

function activeExemptions(locale: string, today: Date): string[] {
  return FIRST_LAST_EXEMPTIONS.filter((e) => Date.parse(e.revisit) >= today.getTime()).map((e) => e.slug);
}

/** 过期豁免必须在用例里报出来，不许悄悄放过 */
function expiredExemptions(today: Date): string[] {
  return FIRST_LAST_EXEMPTIONS.filter((e) => Date.parse(e.revisit) < today.getTime()).map(
    (e) => `${e.slug}（重审日 ${e.revisit} 已过）`,
  );
}

describe("导语不许宣称自己是全站的首/末篇", () => {
  /** 声称「全站最后一篇」的各种说法（中英）。刻意包含 `last stop` 这种要看清是不是全站的措辞。 */
  const CLAIMS_LAST = [
    /最后一站/,
    /最后的(一篇|一站|一课|一个篇章)/,
    /全站最后/,
    /知识库.{0,4}最后/,
    /last stop/i,
    /the last (chapter|lesson|one|stop)/i,
    /final (chapter|stop)/i,
  ];
  const CLAIMS_FIRST = [/第一站/, /全站第一/, /知识库.{0,4}开头/, /开篇第一/, /the very first chapter/i];

  for (const locale of ["zh", "en"] as const) {
    it(`${locale}：逐篇按站内顺序核对「末」的说法`, () => {
      const chapters = getChapters(locale);
      expect(chapters.length, "篇章数为 0，下面按位置判的判据是空转").toBeGreaterThan(20);
      const total = chapters.length;
      const exempt = new Set(activeExemptions(locale, new Date()));
      const offenders: string[] = [];
      chapters.forEach((chapter, index) => {
        const text = `${chapter.tagline}\n${chapter.title}`;
        if (!CLAIMS_LAST.some((re) => re.test(text))) return;
        if (exempt.has(chapter.slug)) return; // 已知违规，待内容仓修（豁免带重审日，过期自动转红）
        // 只有「真的是最后一篇」才允许这么说
        if (index !== total - 1) {
          offenders.push(`${chapter.slug}（第 ${index + 1}/${total}）说自己是最后：${chapter.tagline.slice(0, 40)}`);
        }
      });
      expect(
        offenders,
        `这些导语宣称「最后一站」而它并不是站内最后一篇：\n${offenders.join("\n")}\n` +
          "要么去 kline-buty 把措辞改成「主线最后一站」一类（本仓不得就地改内容仓），" +
          "要么真把它排到最后（要改 kb-order.ts 的 CHAPTER_ORDER，那是站内学习路径的编排）。",
      ).toEqual([]);
    });

    it(`${locale}：逐篇按站内顺序核对「首」的说法`, () => {
      const chapters = getChapters(locale);
      const exempt = new Set(activeExemptions(locale, new Date()));
      const offenders: string[] = [];
      chapters.forEach((chapter, index) => {
        const text = `${chapter.tagline}\n${chapter.title}`;
        if (!CLAIMS_FIRST.some((re) => re.test(text))) return;
        if (exempt.has(chapter.slug)) return; // 同一份豁免清单：改一处就够
        if (index !== 0) offenders.push(`${chapter.slug}（第 ${index + 1}）说自己是第一：${chapter.tagline.slice(0, 40)}`);
      });
      expect(offenders, `这些导语宣称「第一」而它并不是站内第一篇：\n${offenders.join("\n")}`).toEqual([]);
    });
  }

  it("正向对照：探测器认得「末」与「首」这两种形状（否则上面 0 违规只是没扫到）", () => {
    const lastCase = "这是知识库的最后一站，也是最不浪漫的一站。";
    const firstCase = "This is the last stop of the knowledge base — and the least romantic one.";
    expect(CLAIMS_LAST.some((re) => re.test(lastCase)), "探测器认不出中文的「最后一站」").toBe(true);
    expect(CLAIMS_LAST.some((re) => re.test(firstCase)), "探测器认不出英文的 last stop").toBe(true);
    expect(CLAIMS_FIRST.some((re) => re.test("开篇第一站")), "探测器认不出「第一站」").toBe(true);
    // 反向：局部说法不算——「这一章的最后一课」说的是本篇内部，不是全站
    expect(CLAIMS_LAST.some((re) => re.test("这一章的最后一课")), "把局部说法误判成全站声明").toBe(false);
    expect(CLAIMS_FIRST.some((re) => re.test("本篇第一节")), "把局部说法误判成全站声明").toBe(false);
  });

  it("豁免清单不许过期、不许空转（例外可以存在，但不许无声地长期存在）", () => {
    const today = new Date();
    expect(
      expiredExemptions(today),
      "这些豁免的重审日已过：要么去内容仓把它修掉，要么重新评估并写下新的重审日与理由，不许默默留着",
    ).toEqual([]);
    // 反向对照：过期判定本身要认得日期，否则上面那条是空转
    expect(
      FIRST_LAST_EXEMPTIONS.filter((e) => Date.parse(e.revisit) < Date.parse("2030-01-01")).length,
      "探测器匹配不到过期豁免",
    ).toBe(FIRST_LAST_EXEMPTIONS.length);
  });

  it("台账点名的那一篇今天确实处在中间位置（判据量的是位置不是某一行文案）", () => {
    // 这条把「为什么是第 9 个」钉成事实：位置一变，上面那两条的判据范围跟着变。
    for (const locale of ["zh", "en"] as const) {
      const chapters = getChapters(locale);
      const pitfalls = chapters.find((c) => c.slug === "pitfalls");
      expect(pitfalls, "内容仓里找不到 pitfalls 这一篇").toBeTruthy();
      const index = chapters.indexOf(pitfalls!);
      expect(index, "pitfalls 排到了最后一位（那样它说「最后一站」就是真的，上面两条会自己变绿）").toBeLessThan(
        chapters.length - 1,
      );
      expect(chapters.length - 1 - index, "后面还有多篇，后面那篇才是真的末篇").toBeGreaterThan(0);
    }
  });
});
