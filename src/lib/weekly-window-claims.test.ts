/**
 * R16.129：滚动窗口不许叫「本周」。
 *
 * `/stats` 那张摘要卡统计的是「今天在内向前 7 个自然日」（`weekly-summary.ts` 的 `weekBounds`），
 * 卡片右上角还把起止日期印出来——`2026-09-18 ~ 2026-09-24` 本身就跨了两个日历周。可标题写着
 * 「本周学习摘要 / Weekly learning summary」，目标那行写着「每周目标 / Weekly goal」，
 * 而**同一屏**上面三行的柱状图（`weeklyTitle`）老老实实叫「近 7 天」。同一段时间在一张页面上
 * 有两种名字，其中一种还是错的：读「本周」的人会以为周日晚刷新、以为周一的数字该从零开始。
 *
 * 现在这几句里的天数由 `WEEK_WINDOW_DAYS` 生成：窗口长度一改，文案跟着改，改不动就红。
 * 注意「复习提醒 / 每周一次」不在这次范围内——那颗的去重键是 `localWeekStr()`（ISO-8601 日历周），
 * 它说的确实是一个日历周，那句是真的。
 *
 * 运行：`npx vitest run src/lib/weekly-window-claims.test.ts`（跟随 `npm test`）
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { STATS_DICTS } from "./i18n-stats";
import { ACTIVE_DAY_MIN_SECONDS, WEEK_WINDOW_DAYS, buildWeeklySummary } from "./weekly-summary";
import { localDateStr } from "./date-utils";

/** 统计页里那些「其实是一段滚动窗口」的文案 */
const WINDOW_KEYS = [
  "weekSummaryTitle",
  "weekSummaryTpl",
  "weekGoalLabel",
  "weekGoalAchieved",
  "weekGoalLeftTpl",
  "weeklyTitle",
  "weeklySummaryTpl",
] as const;

/** 日历周的说法：滚动窗口不配叫这些名字 */
const CALENDAR_WEEK_CLAIM = /本周|这周|每周|this week|weekly/i;

describe("滚动 7 天窗口的文案说出它真的是 7 天", () => {
  for (const locale of ["zh", "en"] as const) {
    const dict = STATS_DICTS[locale];

    it(`${locale}: 扫描认得全部 ${WINDOW_KEYS.length} 个键（少一个就是门禁瞎了）`, () => {
      const missing = WINDOW_KEYS.filter((key) => typeof dict[key] !== "string" || dict[key].length === 0);
      expect(missing, `这些窗口文案键没有值：${missing.join(", ")}`).toEqual([]);
    });

    it(`${locale}: 没有一个字承诺「日历周」`, () => {
      for (const key of WINDOW_KEYS) {
        expect(dict[key], `「${key}」= ${dict[key]} 把滚动窗口说成了日历周`).not.toMatch(CALENDAR_WEEK_CLAIM);
      }
    });

    it(`${locale}: 每一句报出的天数就是窗口真正的长度`, () => {
      for (const key of WINDOW_KEYS) {
        expect(dict[key], `「${key}」= ${dict[key]} 没写出 ${WEEK_WINDOW_DAYS} 天`).toContain(String(WEEK_WINDOW_DAYS));
      }
    });
  }

  it("zh 的窗口说法与同一屏柱状图的「近 N 天」是同一串字", () => {
    // 柱状图叫「近 7 天」、趋势区间选择器叫「近 7 天」，摘要卡也必须用同一串字，不是「近七日」或「本周」
    expect(STATS_DICTS.zh.weekSummaryTitle.startsWith(STATS_DICTS.zh.trendRange)).toBe(true);
    expect(STATS_DICTS.zh.trendRange).toBe(STATS_DICTS.zh.rangeDaysTpl.replace("{n}", String(WEEK_WINDOW_DAYS)));
  });

  it("窗口真的就是 WEEK_WINDOW_DAYS 个自然日（含今天）", () => {
    const summary = buildWeeklySummary({
      dailySeconds: [],
      completions: {},
      quizAttempts: {},
      reviewAttempts: {},
      replayHistory: [],
      weeklyGoalMin: 90,
      now: new Date(2026, 8, 24, 12),
    });
    const days =
      (new Date(`${summary.weekEnd}T12:00:00`).getTime() - new Date(`${summary.weekStart}T12:00:00`).getTime()) /
        86_400_000 +
      1;
    expect(days).toBe(WEEK_WINDOW_DAYS);
    expect(summary.weekStart).toBe("2026-09-18");
    expect(summary.weekEnd).toBe(localDateStr(new Date(2026, 8, 24, 12)));
  });

  // 同一屏上「近 7 天」出现了两次，量的却是两件事：
  // - 摘要卡：`buildWeeklySummary` 数的是当日**去重秒数 ≥ `ACTIVE_DAY_MIN_SECONDS`** 的那些天；
  // - 迷你条：`activity-calendar` 的日期集合，那天只要 `touchStreak` 过一次就亮，一秒都不算。
  // 于是两个数可以互相超出——只在页面停留 30 秒的人，摘要里那一天不活跃、条上却有；
  // 只标了一课已读的人，条上有、摘要里也不算。旧写法一句叫「{d} 天活跃」、一句叫
  // 「近 7 天学习记录」，两个名字都听不出尺子不同，读的人只会当成同一个数的两种说法。
  it("两把尺子各自点名自己量的是什么", () => {
    const zh = STATS_DICTS.zh.weekSummaryTpl;
    const en = STATS_DICTS.en.weekSummaryTpl;
    const bar = readFileSync(path.join(process.cwd(), "src/components/week-mini-bar.tsx"), "utf8");
    const wiring = readFileSync(path.join(process.cwd(), "src/components/stats-client.tsx"), "utf8");

    expect(
      Number.isInteger(ACTIVE_DAY_MIN_SECONDS / 60),
      `${ACTIVE_DAY_MIN_SECONDS} 秒不是整分钟，文案里那个数就没法读`,
    ).toBe(true);
    expect(wiring, "{min} 必须由 ACTIVE_DAY_MIN_SECONDS 代入，不许手抄").toContain(
      '.replace("{min}", String(ACTIVE_DAY_MIN_SECONDS / 60))',
    );
    const rendered = Object.entries({
      "{m}": String(Math.round(ACTIVE_DAY_MIN_SECONDS / 60) * 2),
      "{d}": "3",
      "{min}": String(ACTIVE_DAY_MIN_SECONDS / 60),
      "{docs}": "1",
      "{quiz}": "2",
      "{review}": "4",
      "{replay}": "5",
    }).reduce((acc, [token, value]) => acc.split(token).join(value), zh);
    expect(rendered, "代入常量之后那句要真的读出「1 分钟」").toContain("1 分钟");

    const VAGUE = /活跃|active days/i;
    expect(zh, `摘要卡那句还在用一把没说明的尺：${zh}`).not.toMatch(VAGUE);
    expect(en, `摘要卡那句还在用一把没说明的尺：${en}`).not.toMatch(VAGUE);

    // 那句话里的天数由 `WEEK_WINDOW_DAYS` 代入（R16.319），所以锚点认的是模板形状而不是硬编码的 7：
    // 读屏名字里写死一个数，改窗口时它就会悄悄落后于眼睛看到的那根条。
    const barPhrase = bar.match(/天里哪几天[\s\S]{0,90}/)?.[0] ?? "";
    expect(barPhrase, "迷你条的读屏名字要点名它记的是哪三种事").toMatch(/标过已读|答过题|回放/);
    expect(barPhrase, "那一格按时长算就错了，句子里不许有分钟").not.toMatch(/分钟/);
    expect(
      bar.match(/近 \$\{WEEK_WINDOW_DAYS\} 天里哪几天/),
      "迷你条那句读屏名字的天数必须由 WEEK_WINDOW_DAYS 代入，不许再抄一个 7",
    ).toBeTruthy();

    // 正向对照：退役的三句喂给同一组禁令，必须条条报红
    const legacyVague = [
      "近 7 天共学 {m} 分钟 · {d} 天活跃 · 完成 {docs} 篇",
      "{m} min across {d} active days in the last 7 days",
    ];
    expect(legacyVague.filter((s) => !VAGUE.test(s)), "旧写法逃过了「活跃」禁令").toEqual([]);
    expect(
      /标过已读|答过题|回放/.test("近 7 天学习记录（从 6 天前到今天）："),
      "旧的读屏名字什么都没点名",
    ).toBe(false);
  });

  /**
   * R16.319：窗口长度也不许只活在文案里——同一屏那三张卡**画**的格数必须由它生成。
   *
   * 上面那族用例把「近 N 天」那几句字钉住了，而 `WEEK_WINDOW_DAYS` 头顶那句注释
   * 写着「摘要、周目标、柱状图共用这一个数」：实测把常量改成 14，标题会变成「近 14 天」，
   * 柱状图照旧画 7 根、日均照旧除以 7、迷你条照旧走 6 天，**一条测试都不红**。
   * 也就是说那句话从来没有主人守着——与 R16.40（七份「今天」）/ R16.318（两份秒→分钟）同族。
   * 判据分三层，缺一层就有对应的躲法：① 数据入口不许吃字面量（`getStudySeries(7)` 这种）；
   * ② 渲染这三张卡的文件必须真的导入并使用常量；③ 常量自己不许在那几个文件里被写成裸数字。
   */
  it("柱状图与迷你条画的格数由 WEEK_WINDOW_DAYS 生成，不是各自抄一个 7", () => {
    const WINDOW_SURFACES = [
      "src/components/weekly-report.tsx",
      "src/components/week-mini-bar.tsx",
      "src/components/stats-client.tsx",
    ];
    const readSrc = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

    // ① 逐个**形状**点名：每一处表达「窗口有多长」的表达式，它的值必须来自常量。
    // 为什么不扫裸数字 6/7：同一批文件里 7 还说别的事（星期循环、趋势区间档位、
    // 样式里的 px 值），扫数字要么误伤要么靠一张手抄豁免清单——那张清单本身就是下一个
    // 没人管的登记面。锚定形状则是「这一处确实是窗口长度」的正面证据。
    const SHAPES: Array<{ rel: string; label: string; re: RegExp; want: string }> = [
      { rel: "src/components/weekly-report.tsx", label: "柱状图取数据的天数", re: /getStudySeries\(\s*([^)]+?)\s*\)/, want: "WEEK_WINDOW_DAYS" },
      { rel: "src/components/weekly-report.tsx", label: "服务端空快照的格数", re: /length:\s*([^,}]+)\s*},\s*\(\) => "0"/, want: "WEEK_WINDOW_DAYS" },
      { rel: "src/components/weekly-report.tsx", label: "日均的分母", re: /avg = Math\.round\(total\s*\/\s*([^)]+)\)/, want: "WEEK_WINDOW_DAYS" },
      { rel: "src/components/weekly-report.tsx", label: "哪一根是今天", re: /isToday = i === ([^;]+);/, want: "WEEK_WINDOW_DAYS - 1" },
      { rel: "src/components/week-mini-bar.tsx", label: "迷你条倒着走几天", re: /for \(let offset = ([^;]+);/, want: "WEEK_WINDOW_DAYS - 1" },
      { rel: "src/components/stats-client.tsx", label: "摘要卡喂进去的天数", re: /getStudySeries\(\s*([^)]+?)\s*\)/, want: "WEEK_WINDOW_DAYS" },
    ];
    const offenders: string[] = [];
    for (const shape of SHAPES) {
      const found = readSrc(shape.rel).match(shape.re);
      if (!found) {
        offenders.push(shape.rel + " → 找不到「" + shape.label + "」那一处（形状变了，判据得跟着改，不许静默放过）");
        continue;
      }
      const value = found[1].trim();
      if (!value.includes(shape.want)) offenders.push(shape.rel + " → " + shape.label + "写的是 " + value + "，应当由 " + shape.want + " 生成");
    }
    expect(offenders, "窗口长度只有一个主人：\n" + offenders.join("\n")).toEqual([]);

    // 非空转：每一条形状都要先证明它抓得住对应的旧写法（R16.40 / R16.318 同一族规矩）
    const LEGACY: Array<[string, string, RegExp, string]> = [
      ["柱状图取数据", "  return getStudySeries(7)", /getStudySeries\(\s*([^)]+?)\s*\)/, "7"],
      ["日均分母", "  const avg = Math.round(total / 7);", /avg = Math\.round\(total\s*\/\s*([^)]+)\)/, "7"],
      ["今天那根", "          const isToday = i === 6;", /isToday = i === ([^;]+);/, "6"],
      ["迷你条循环", "  for (let offset = 6; offset >= 0; offset -= 1) {", /for \(let offset = ([^;]+);/, "6"],
    ];
    for (const [name, legacy, re, wantValue] of LEGACY) {
      const found = legacy.match(re);
      expect(found, "判据抓不住旧写法（连形状都对不上）：" + name).toBeTruthy();
      expect(found![1].trim(), name + " 的旧写法必须被判据判为不合规").toBe(wantValue);
    }
    // 空快照那一处走的是另一种红：旧写法连 `length: …` 这个形状都没有，
    // 上面循环里的「找不到就登记 offender」会让它红，而不是被放过。这条核对钉的就是那个前提。
    expect(/length:\s*([^,}]+)\s*},\s*\(\) => "0"/.test('const EMPTY_SNAPSHOT = "0,0,0,0,0,0,0";'), "空快照的旧写法应当扫不出形状").toBe(false);

    // ② 三个表面都真的用上了常量（少一个 = 那一处还长着私有字面量）
    for (const rel of WINDOW_SURFACES) {
      const src = readSrc(rel);
      expect(
        /import\s*\{[^}]*\bWEEK_WINDOW_DAYS\b[^}]*\}\s*from\s*"[^"]*weekly-summary"/.test(src),
        rel + " 没有从 weekly-summary 导入 WEEK_WINDOW_DAYS（多半是又抄了一份字面量）",
      ).toBe(true);
      expect(src.match(/WEEK_WINDOW_DAYS/g), rel + " 里常量一次都没用上").not.toBeNull();
    }

    // ② 三个表面都真的用上了常量（下面这段），非空转见上面的 LEGACY 逐形状自证
  });

  /**
   * 一周七天是**另一件事**，不许被上面那条误伤：柱状图的星期标签按下标循环取，
   * 那个 7 是星期数、不是窗口长度。把两者混成一个常量，窗口一改标签就错位。
   */
  it("星期循环的那个 7 与窗口长度是两回事", () => {
    const bar = readFileSync(path.join(process.cwd(), "src/components/weekly-report.tsx"), "utf8");
    expect(bar.match(/dayLabels = \[[^\]]*\]/)?.[0], "柱状图应当有一份 7 个元素的星期标签").toMatch(/"S", "M", "T", "W", "T", "F", "S"/);
    // 取标签的下标必须对负数安全（today - 窗口 + i 可以是负的），所以那一行有两次 % 7
    expect(bar, "星期下标必须对负数取模安全").toMatch(/% 7\) \+ 7\) % 7/);
  });
});
