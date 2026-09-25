/**
 * R16.233：活的状态锚点必须查得到 —— `docs/accessibility-audit.md` 的「基线：」那一行。
 *
 * 那一行原本写 `基线：`codex/zero-eslint-warnings`，…，最近验证 `a7c62d1``。两个指针今天在仓库里
 * 都查不到：远端临时分支按 `AGENTS.md` 的规矩在 PR 合并后删除，而 `gh pr merge --rebase` 会改写
 * SHA，`a7c62d1` 只活在那条已消失的分支上（本地对象库里它还在，`git log --all` 却找不到任何 ref
 * 包含它——新克隆的人 `git show` 直接失败）。读一份审计报告的人靠这一行判断「下面的结论是以什么时候
 * 为准」，锚点解析不出来就等于没写。
 *
 * 判据只在「基线：」这一种行上生效，且是 CI 里真跑得通的形状：`.github/workflows/ci.yml` 的
 * `actions/checkout` 没有 `fetch-depth`，浅检出里 `git cat-file` 认不出任何非 HEAD 的 SHA，
 * 所以这里查的是**指针形状**（分支名会消失；SHA 必须同行带着人能查到的说明），不是可达性。
 * 解释性文字里点名一个已经死掉的指针是允许的（那一节下面第二段就在写这件事），锚点不行。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** 抠出 docs/*.md（含仓库根那份）里所有「基线：」行 */
function baselineLines() {
  const files = [
    ...fs
      .readdirSync("docs", { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "progress.md")
      .map((e) => path.join("docs", e.name)),
    ...(fs.existsSync("README.md") ? ["README.md"] : []),
  ];
  const found = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      // 追加式日志（`docs/progress.md`）不进这里：那一条一条都是当时的快照，不是活锚点
      if (line.startsWith("基线：")) found.push({ file, at: i + 1, line });
    });
  }
  return found;
}

/** 行内出现的代码段：反引号包住的一截 */
const CODE_SPAN = /`([^`]+)`/g;
/** 一个提交号（7~40 位十六进制），可能写成 `main@<sha>` 这种带前缀的样子 */
const LOOKS_LIKE_SHA = /(?:^|@|\b)[0-9a-f]{7,40}$/i;

describe("docs 里的「基线：」锚点必须解析得出来", () => {
  const lines = baselineLines();

  it("至少扫到一条，判据没被改口绕空", () => {
    expect(lines.length, "docs/ 里再也找不到以「基线：」开头的行——措辞变了要同步这里").toBeGreaterThanOrEqual(1);
  });

  for (const { file, at, line } of lines) {
    it(`${file}:${at} 不拿会消失的东西当锚点`, () => {
      for (const [, span] of line.matchAll(CODE_SPAN)) {
        // 分支名是 PR 的运输工具，合并即删（AGENTS.md「Remote topic branches are temporary」）
        expect(
          span,
          `${file}:${at} 的锚点写了分支名「${span}」：远端临时分支合并后会被删除，把它当基线等于留一个查不到的指针。要指名就写 PR 编号或 main 上的提交`,
        ).not.toMatch(/^(codex|feat|fix|release|chore)\//);
        if (!LOOKS_LIKE_SHA.test(span)) continue;
        // 提交号必须同行带一句查得到的说明：rebase 合并会改写 SHA，只有标题与 PR 编号是长期的
        const after = line.slice(line.indexOf(`\`${span}\``) + span.length + 2);
        const explained = /^（[^）]{6,}）|^ *\([^)]{6,}\)/.test(after);
        // 说明里还得真有点东西——「（`abc1234`）」这种把 SHA 换成另一个 SHA 不算解释
        const body = after.match(/^（([^）]*)）/)?.[1] ?? after.match(/^\(([^)]*)\)/)?.[1] ?? "";
        expect(
          explained && !/^[0-9a-f@`，,、\s]+$/i.test(body),
          `${file}:${at} 的提交号「${span}」后面没有可解析的说明：rebase 合并后没人查得到它是什么。写上它的提交标题（或 PR 编号）`,
        ).toBe(true);
      }
    });
  }

  it("正向对照：旧那一行必须被同一个判据报出来", () => {
    const legacy =
      "基线：`codex/zero-eslint-warnings`，`origin/main@53f7e01`，最近验证 `a7c62d1` + 亮色对比度修复";
    const spans = [...legacy.matchAll(CODE_SPAN)].map(([, s]) => s);
    expect(spans.some((s) => /^(codex|feat|fix|release|chore)\//.test(s))).toBe(true);
    // `a7c62d1` 后面跟的是「 + …」——没有括号说明，正是这次要拦的形状
    const naked = legacy.indexOf("`a7c62d1`");
    expect(/^\s*（|^\s*\(/.test(legacy.slice(naked + "`a7c62d1`".length))).toBe(false);
  });
});

/**
 * R16.248：文档不许拿一个手抄日期当新鲜度凭据。
 *
 * `docs/growth-events.md` 写着「最后更新：2026-09-12」，而它自己最后一次被改是 2026-09-22 的
 * `74a3fd4`——正是那次给事件目录添了 `share_card_shared` 这一行。也就是说这句话把自己描述的
 * 那次改动排除在外了。`docs/retention-metrics.md`（写 09-11，实改 09-24，而表里那一行现在还引着
 * R16.129）、`docs/architecture.md`（「当前基线：2026-09-13」，实改 09-24）同罪。
 * 这类句子没有任何东西对着：CI 是浅检出，判据拿不到文件历史，所以它既不会被验证、也不会变红，
 * 只会安静地撒谎。改法是删掉日期、点名真正会红的那一层（判据 + 实现文件），并禁止这种写法回来。
 */
const FRESHNESS_CLAIM = /(?:最后|最近)?更新\s*[：:]\s*\d{4}-\d{2}-\d{2}|(?:当前)?基线\s*[：:]\s*\d{4}-\d{2}-\d{2}/;

/** 取「第一个二级标题之前」的文档头（追加式日志里那些条目级时间戳在标题之后，天然不算）。 */
function headerOf(file) {
  const text = fs.readFileSync(file, "utf8");
  const at = text.indexOf("\n## ");
  return at === -1 ? text : text.slice(0, at);
}

function markdownFiles() {
  return [
    ...fs.readdirSync("docs").filter((n) => n.endsWith(".md")).map((n) => path.join("docs", n)),
    ...["README.md", "CONTRIBUTING.md", "AGENTS.md"].filter((n) => fs.existsSync(n)),
  ];
}

describe("文档不拿手抄日期当新鲜度凭据", () => {
  const files = markdownFiles();

  it("扫描本身覆盖全仓库的 md", () => {
    expect(files.length, "能扫到的文档少到不正常").toBeGreaterThanOrEqual(30);
  });

  for (const file of files) {
    it(`${file} 的文档头里没有「最后更新 / 当前基线：某个日期」`, () => {
      const hit = FRESHNESS_CLAIM.exec(headerOf(file));
      expect(hit, `${file} 又用回了一个手抄日期当新鲜度凭据：「${hit?.[0]}」——没有任何东西对它，它只会安静地变旧。要留新鲜度就点名判据与实现文件`).toBeFalsy();
    });
  }

  it("正向对照：本轮收回的那几种写法必须都被同一个正则抓住", () => {
    for (const legacy of [
      "最后更新：2026-09-12",
      "最后更新： 2026-09-11",
      "> 当前基线：2026-09-13。",
      "基线：2026-09-13",
    ]) {
      expect(FRESHNESS_CLAIM.test(legacy), `这种写法漏网了：${legacy}`).toBe(true);
    }
    // 发布评审里的「基线 `0.7.0`（2026-09-20，发布提交 …）」是历史事实，不是新鲜度凭据：不许误伤
    expect(FRESHNESS_CLAIM.test("基线 `0.7.0`（2026-09-20，发布提交 `364515b`）")).toBe(false);
  });

  it("收回日期的那四份文档，点名的路径都还在仓库里", () => {
    let checked = 0;
    for (const file of [
      "docs/architecture.md",
      "docs/growth-events.md",
      "docs/growth-event-privacy-audit.md",
      "docs/retention-metrics.md",
    ]) {
      const paths = [...new Set([...fs.readFileSync(file, "utf8").matchAll(/`((?:src|scripts|docs|\.github)\/[^`\s]*)`/g)].map((m) => m[1]))]
        .filter((p) => !p.includes("*") && !p.includes("...") && !p.includes("**"));
      expect(paths.length, `${file} 一个路径都没点到，这条判据对它空转`).toBeGreaterThanOrEqual(4);
      for (const p of paths) {
        expect(fs.existsSync(p), `${file} 指着 ${p}，仓库里没有这个文件`).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(30);
  });
});

/**
 * R16.250：点名某份文档的那句引文，必须真在那份文档里。
 *
 * `docs/retention-metrics.md` §0 的第一句写「平台的隐私宪法（AGENTS.md）要求『无广告、无追踪、
 * 无第三方统计脚本』」——`AGENTS.md` 里广告、追踪、统计这三个词一个都没有（中英文都查过），
 * `docs/plan.md` 的内容宪法管的是收益承诺/荐股/开户导流/风险提示/免费，压根不谈遥测。这句引文
 * 是凭空造的，还被署给了一份具体文档；它顺着「隐私宪法」这个词在文档里当过前提用，谁也没有
 * 对着查过。同一形状的另一处是 `docs/roadmap.md` 里那句引 `AGENTS.md` 的中文译文——那种是给人看
 * 的历史记录，所以追加式台账（`docs/progress.md`、`docs/roadmap.md`）不进这条判据：它们记的是
 * 当时发生了什么，包括「某份文档当时写着 X」（X 后来被改掉了，正是记录本身要留的东西）。
 *
 * 形状收得很紧：文档名（或「宪法」）与「…」引文之间最多隔 24 个字符，且中间不许再出现引号，
 * 引述动词可有可无（引号紧跟文档名本身就等于宣称是原文）。测得 9 处命中，2 处在活文档、7 处在
 * 台账；活文档那 2 处如今都对得上。判据不查转述（「plan.md 要求不做 X」这种没引号的说法）——
 * 那是语义蕴含，不是字符串比对，没有 CI 级判据可言；这条只堵「加了引号却说不出出处」。
 */
const LEDGERS = new Set(["docs/progress.md", "docs/roadmap.md"]);
const ATTRIBUTION =
  /((?:docs\/)?[A-Za-z0-9._-]+\.md|(?:平台|项目)?(?:的)?(?:隐私)?宪法)(?:[^「」]{0,24}?(?:要求|规定|写明|写着|原文|声明|指出|说|states?|requires?))?\s*[：:，,]?\s*「([^」]{6,})」/g;

/** 把 markdown 装饰和空白抹平：引文抄的是句子，不是星号。 */
const flattenMd = (s) => s.replace(/[*_`>]/g, "").replace(/\s+/g, "");

function resolveDoc(ref) {
  if (ref.endsWith("宪法")) return "docs/plan.md";
  const name = ref.replace(/^docs\//, "");
  return [ref, `docs/${name}`, path.basename(ref)].find((p) => fs.existsSync(p) && p.endsWith(".md"));
}

function attributedQuotes() {
  const found = [];
  for (const file of markdownFiles()) {
    if (LEDGERS.has(file)) continue;
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        for (const [, ref, quote] of line.matchAll(ATTRIBUTION)) {
          found.push({ file, at: i + 1, ref, quote });
        }
      });
  }
  return found;
}

function ledgerAttributions() {
  const out = [];
  for (const file of ["docs/progress.md", "docs/roadmap.md"]) {
    if (!fs.existsSync(file)) continue;
    for (const m of fs.readFileSync(file, "utf8").matchAll(ATTRIBUTION)) out.push(m[0]);
  }
  return out;
}

describe("活文档里点名出处的引文必须查得到", () => {
  const hits = attributedQuotes();

  it("扫描覆盖到活文档的引文，且台账那一侧确实被排除了", () => {
    expect(hits.length, "活文档里一处『文档名 + 「引文」』都没有——判据被绕空了").toBeGreaterThanOrEqual(1);
    expect(ledgerAttributions().length, "追加式台账里的引文少到不正常，八成是形状改口了").toBeGreaterThanOrEqual(5);
  });

  for (const { file, at, ref, quote } of hits) {
    it(`${file}:${at} 引的 ${ref} 查得到这句话`, () => {
      const doc = resolveDoc(ref);
      expect(doc, `${file}:${at} 署名引自 ${ref}，仓库里找不到这份文档`).toBeTruthy();
      expect(
        flattenMd(fs.readFileSync(doc, "utf8")).includes(flattenMd(quote)),
        `${file}:${at} 把「${quote}」当成 ${doc} 的原文，那份文档里没有这句话。要么改回真正的原文，要么别再署它`,
      ).toBe(true);
    });
  }

  it("正向对照：本轮删掉的那句伪造引文必须被同一个形状抓住", () => {
    const legacy = "平台的隐私宪法（AGENTS.md）要求「无广告、无追踪、无第三方统计脚本」。";
    const hits = [...legacy.matchAll(ATTRIBUTION)];
    expect(hits.length, "这句伪造引文不再命中判据，形状改坏了").toBe(1);
    const [, ref, quote] = hits[0];
    // 句子署的是「隐私宪法」，括号里补一句 AGENTS.md——两个出处都得查
    expect(ref).toBe("平台的隐私宪法");
    expect(resolveDoc(ref)).toBe("docs/plan.md");
    expect(quote).toBe("无广告、无追踪、无第三方统计脚本");
    for (const doc of ["docs/plan.md", "AGENTS.md"]) {
      expect(flattenMd(fs.readFileSync(doc, "utf8")).includes(flattenMd(quote)), `${doc} 里根本没有这句话，判据却查不到`).toBe(false);
    }
  });

  it("反向对照：转述与短引号不该被当成原文引用", () => {
    // 没有引号、或引号太短（术语而非引文）、或出处与引文之间隔着一句别的话——都不算署名引用
    for (const paraphrase of [
      "`AGENTS.md` 要求锚点滚动",
      "内容宪法管的是收益承诺、荐股、开户导流、风险提示与免费",
      "见 `docs/ops.md`，下面这张「门禁清单」只列跑的东西",
      "`docs/plan.md` 的第 4 条说的是每篇都要有一块「⚠️ 风险提示」",
    ]) {
      expect([...paraphrase.matchAll(ATTRIBUTION)].length, `转述被误判成引文了：${paraphrase}`).toBe(0);
    }
  });
});
