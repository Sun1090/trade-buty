/**
 * R16.195：AI 配额那几句话指向的是墙上那一小时，而代码数的是滚动窗口。
 *
 * 限流器记的是 `{ count, reset }`，`reset` 在第一次命中时写成 `now + windowMs`
 * （`src/lib/ai/rate-limit.ts` 的 `check()`）——窗口的终点是**这个人这一次请求**之后
 * 的 60 分钟，不是下一个整点。10:50 问第一次的人，配额到 11:50 才刷新，而屏幕上写的是
 * 「本小时游客提问次数已用完」「{n} left this hour」：读的人会以为等到 11:00 就能再问，
 * 而同一屏旁边那句「约 {n} 分钟后重试」（取自 `Retry-After`，倒数到的正是那个私有终点）
 * 说的是另一个时间。这与 R16.129 那条同形：滚动窗口不许叫日历名（那边是「本周」，这里是
 * 「本小时」）。
 *
 * 口径：
 * - 四句话（`guestLimit` / `accountLimit` / `quotaRemaining` / `quotaLoginHint`）不许出现
 *   任何指向墙上钟点的说法（`本小时` `每小时` `this hour` `hourly` `per hour` `/hour`）。
 * - 中文那四句必须写出窗口的长度，而且那个数来自限流器的 `DEFAULT_WINDOW_MS`，不是抄来的
 *   「一小时」——常量一改，这张表就得跟着改，改不动就红。
 * - 英文那四句同样必须点出是「小时」这一档，且**不许**出现任何字面数字：次数上限走
 *   `{l}`/`{n}` 占位符，把 10 或 50 抄进文案就会红（那两个数是路由配置，不是字典的）。
 * - 「约 {n} 分钟后重试」是另一件事：它倒数到窗口终点，单位必须是分钟，中文侧不许漏成
 *   英文缩写（R16.112 那一族）。
 *
 * 修完之后「扫到了几条违规」无意义（一条都不剩），所以正向对照必须有：把旧句子喂给同一个
 * 判据，它得当违规报出来。
 *
 * 运行：`npx vitest run src/lib/quota-window-claims.test.ts`（跟随 `npm test`）
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getDict } from "./i18n";
import { DEFAULT_WINDOW_MS } from "./ai/rate-limit";

/** 真正会印到屏幕上的那四句配额文案 */
const QUOTA_KEYS = ["guestLimit", "accountLimit", "quotaRemaining", "quotaLoginHint"] as const;

/** 指向墙上钟点的说法——滚动窗口不配叫这些名字 */
const WALL_CLOCK = {
  zh: /本小时|这一小时|每小时|整点/,
  en: /\bthis hour\b|hourly|per hour|\/hour|\bevery hour\b/i,
} as const;

/** 窗口长度（小时）→ 中文里那句该出现的字面量。常量一改，这张表要跟着补。 */
const ZH_WINDOW_PHRASE: Record<number, string> = {
  1: "一小时", 2: "两小时", 3: "三小时", 6: "六小时", 12: "十二小时", 24: "二十四小时",
};

function dictFor(locale: "zh" | "en") {
  const ai = getDict(locale).ai;
  return QUOTA_KEYS.map((key) => [key, ai[key]] as const);
}

describe("AI 配额那几句说的是滚动窗口，不是墙上那一小时", () => {
  for (const locale of ["zh", "en"] as const) {
    it(`${locale}: 扫描认得全部 ${QUOTA_KEYS.length} 个键（少一个就是门禁瞎了）`, () => {
      const entries = dictFor(locale);
      expect(entries.length).toBe(QUOTA_KEYS.length);
      for (const [key, value] of entries) {
        expect(typeof value, `「${key}」没有值`).toBe("string");
        expect(value.length, `「${key}」是空串`).toBeGreaterThan(0);
      }
    });

    it(`${locale}: 没有一个字把滚动窗口说成墙上钟点`, () => {
      for (const [key, value] of dictFor(locale)) {
        expect(value, `「${key}」= ${value} 在暗示按整点刷新`).not.toMatch(WALL_CLOCK[locale]);
      }
    });

    it(`${locale}: 正向对照——旧句子必须被同一个判据报出来`, () => {
      const offenders = locale === "zh"
        ? ["本小时游客提问次数已用完", "游客每小时限 {l} 次，本小时剩余 {n} 次"]
        : ["Guest hourly allowance reached", "Guests: {l} questions/hour — {n} left this hour"];
      const missed = offenders.filter((s) => !WALL_CLOCK[locale].test(s));
      expect(missed, `这些旧写法没被判据抓住：${missed.join(" / ")}`).toEqual([]);
      // 反手：现在的合法写法不许被误报，否则「不许出现」可以靠删光文案过关
      for (const [, value] of dictFor(locale)) {
        expect(value).not.toMatch(WALL_CLOCK[locale]);
      }
    });
  }

  it("zh 那四句写出的窗口长度就是限流器常量的那个数", () => {
    const hours = DEFAULT_WINDOW_MS / 3_600_000;
    const phrase = ZH_WINDOW_PHRASE[hours];
    expect(phrase, `窗口现在是 ${hours} 小时：文案要改，这张表也要补一项`).toBeTruthy();
    for (const [key, value] of dictFor("zh")) {
      expect(value, `「${key}」= ${value} 没写出 ${phrase}`).toContain(phrase);
    }
  });

  it("en 那四句说的是 hour 这一档，且一个字的数字都没抄", () => {
    const hours = DEFAULT_WINDOW_MS / 3_600_000;
    const unit = hours < 1 ? "minute" : hours >= 24 ? "day" : "hour";
    const otherUnits = ["minute", "hour", "day"].filter((u) => u !== unit);
    for (const [key, value] of dictFor("en")) {
      expect(value, `「${key}」= ${value} 没点出窗口单位 ${unit}`).toContain(unit);
      for (const wrong of otherUnits) {
        expect(value, `「${key}」= ${value} 出现了别的单位 ${wrong}`).not.toContain(wrong);
      }
      expect(value, `「${key}」= ${value} 把次数上限抄死进文案了`).not.toMatch(/\d/);
    }
  });

  it("/api/ai/chat 的限流器用的就是这个默认窗口（否则上面那条对不上）", () => {
    const src = readFileSync(path.join(process.cwd(), "src/app/api/ai/chat/route.ts"), "utf8");
    const call = src.match(/createRateLimiter\(\{[^}]*\}\)/);
    expect(call, "没在 chat 路由里找到 createRateLimiter 调用").toBeTruthy();
    expect(call![0], `路由自己传了 windowMs，界面那几句的窗口长度就不由 ${"DEFAULT_WINDOW_MS"} 说了算`)
      .not.toMatch(/windowMs/);
  });

  it("「约 {n} 分钟后重试」单位是分钟，且中文侧没漏成英文缩写", () => {
    expect(getDict("zh").ai.retryInTpl).toContain("分钟");
    expect(getDict("zh").ai.retryInTpl).not.toMatch(/min\b/);
    expect(getDict("en").ai.retryInTpl).toMatch(/\bmin\b/);
    for (const locale of ["zh", "en"] as const) {
      expect(getDict(locale).ai.retryInTpl, "这句是倒数到窗口终点，不是宣布哪一小时")
        .not.toMatch(WALL_CLOCK[locale]);
    }
  });
});
