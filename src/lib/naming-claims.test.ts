/**
 * 一个数字在这一屏上只允许有一个名字。
 *
 * 第十五轮查实在在的四件事：
 * - 回放的正确率一度在同一屏叫「准确率」（折线空态、三步引导卡、首页第二步的弹层、
 *   分享文案、统计页那一格），而产生这个数的地方叫「正确率」；
 * - 「最佳连胜」（本轮）与「最佳连击」（全部历史）是同一个量的两种尺子，却换了一个词，
 *   读的人只能猜它们是不是两回事；
 * - 首页那句「你已完成 r/t 篇」数的是 `markRead` 记下的**已读**（滚过一半即记），
 *   统计页同一个数叫「已读课程」；
 * - 引导和 intro 让用户去开「猜涨跌」，可那时屏幕上那颗按钮写着「自由观看」。
 *
 * 门禁的写法：先扫「不该出现的词」，再扫「确实出现了替代词」，最后报扫描分母——
 * 只禁不立的话，字典被删空也能假绿（同 `check:*` 那批计数门禁的规矩）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDict } from "./i18n";
import { STATS_DICTS } from "./i18n-stats";
import { BADGES } from "./learn-stats";

/** 把字典摊平成 [{ at, text }]，用于「整屏扫一遍」而不是逐条手写清单 */
function flatten(value: unknown, at: string, out: { at: string; text: string }[]) {
  if (typeof value === "string") {
    out.push({ at, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => flatten(item, `${at}[${i}]`, out));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) flatten(child, at ? `${at}.${key}` : key, out);
  }
  return out;
}

/** 这些屏共享「正确率 / 连胜 / 已读」这套词：回放页、统计页、首页、引导、分享文案 */
function screenStrings(locale: "zh" | "en") {
  const dict = getDict(locale);
  return [
    ...flatten(dict.replay, "replay", []),
    ...flatten(dict.home, "home", []),
    ...flatten(dict.onboarding, "onboarding", []),
    ...flatten(dict.share, "share", []),
    ...flatten(STATS_DICTS[locale], "stats", []),
  ];
}

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("回放那两把尺子各有一个名字", () => {
  it("zh：这些屏上不再有「准确率」「连击」这两个别名", () => {
    const strings = screenStrings("zh");
    const offenders = strings.filter((s) => /准确率|平均准确|连击/.test(s.text)).map((s) => `${s.at}="${s.text}"`);
    expect(offenders, `同一个数换了名字：\n${offenders.join("\n")}`).toEqual([]);
  });

  it("zh：替代词确实在用，扫描不是空的", () => {
    const strings = screenStrings("zh");
    const named = strings.filter((s) => /正确率|连胜|已读/.test(s.text)).map((s) => s.at);
    // 分母：少到这个数就说明上面那批键被删了，而不只是改了名
    expect(strings.length, "字典字符串总数骤减，扫描失去意义").toBeGreaterThan(150);
    expect(named.length, "替代词一处都没出现，等于门禁什么都没钉住").toBeGreaterThanOrEqual(6);
  });

  it("zh：本轮最佳与全部历史最佳只差「历史」两个字，不换词", () => {
    const replay = getDict("zh").replay;
    expect(replay.best).toBe("最佳连胜");
    expect(replay.histBest).toContain("历史");
    expect(replay.histBest.endsWith(replay.best)).toBe(true);
    const stats = STATS_DICTS.zh;
    expect(stats.replayTrendBestStreak).toBe(replay.histBest);
  });

  it("en：同一量在英文侧也只有一个词", () => {
    const offenders = screenStrings("en")
      // 英文侧允许 "Best streak"（本轮）与 "Average accuracy"（窗口），但绝不允许 precision/rate 之类别名
      .filter((s) => /\b(precision|hit rate|correctness)\b/i.test(s.text))
      .map((s) => `${s.at}="${s.text}"`);
    expect(offenders, `英文侧长出了别名：\n${offenders.join("\n")}`).toEqual([]);
  });

  it("回放页写死在页面里的那三张卡跟着字典走", () => {
    const source = read("src/app/[locale]/replay/page.tsx");
    expect(source).not.toMatch(/准确率|连击/);
    expect(source).toMatch(/正确率/);
  });
});

describe("指引点名的开关就是屏幕上那颗按钮", () => {
  for (const locale of ["zh", "en"] as const) {
    const dict = getDict(locale);
    const toggle = dict.replay.modeGuess;

    it(`${locale}：intro、三步引导与回放页都叫得出按钮的真名`, () => {
      expect(dict.replay.intro, `intro 让用户去开的东西不叫「${toggle}」`).toContain(toggle);
      expect(dict.onboarding.steps.replay.body).toContain(toggle);
      // 引导那句还承诺了那个数：用的必须是屏上那个词
      expect(dict.onboarding.steps.replay.body).toMatch(locale === "zh" ? /正确率/ : /accuracy/i);
    });
  }

  it("zh：首页那句数的是已读，不是「完成」", () => {
    const zh = getDict("zh");
    expect(zh.home.readTpl).toContain("已读");
    expect(zh.home.readTpl).not.toMatch(/完成/);
    // 同一个数在统计页的名字：两屏必须用同一个词
    expect(STATS_DICTS.zh.readDocs).toContain("已读");
    const en = getDict("en").home.readTpl;
    expect(en).toMatch(/^📖 Read /);
    expect(en).not.toMatch(/completed/i);
    expect(STATS_DICTS.en.readDocs).toMatch(/read/i);
    // 「全部课程都读完了」那句是写死在页面里的，只扫字典的门禁看不见它
    const page = read("src/app/[locale]/page.tsx");
    expect(page).not.toMatch(/读完|已完成/);
    expect(page).toMatch(/已读过/);
  });

  it("页面 <title> 不留一个挂空的逗号", () => {
    // 这一句只出现在浏览器标签与 OG 里，后面直接接「 · Trade Buty」
    expect(getDict("zh").home.title1).not.toMatch(/[，、,]$/);
    expect(getDict("zh").home.title1.length).toBeGreaterThan(0);
  });

  it("成就卡里凡是数「读过」的，名字不许写成「完成」", () => {
    // 判据取 check 的源码：它读的是哪一把尺子，比文案自己说的是什么更可靠
    const readRuler = BADGES.filter((b) => /readDocs|overallPct/.test(b.check.toString()));
    expect(readRuler.length, "一把「读过」的尺子都没扫到，说明判据失效").toBeGreaterThanOrEqual(2);
    const offenders = readRuler
      .filter((b) => /完成/.test(b.desc.zh) || /complet/i.test(b.desc.en))
      .map((b) => `${b.id}: ${b.desc.zh} / ${b.desc.en}`);
    expect(offenders, `这些成就在替「滚过一半」承诺「完成」：\n${offenders.join("\n")}`).toEqual([]);
  });
});
