import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

/**
 * 三主题 a11y 回归门禁（R16.290）：dark 与 sepia 主题下的关键页巡检。
 *
 * 背景（R16.286）：全规则 a11y 巡检此前只跑过 SSR 默认主题（light）。把全部默认
 * 规则铺到 dark 与 sepia 两套主题后量出两类系统性问题并修掉：
 * - `dark:` 变体跟错开关（跟 OS 偏好而非 html[data-theme]）——OS light 用户在站内
 *   切暗色时主按钮是白字绿底 2.53:1；`@custom-variant dark` 修复。
 * - sepia 的合成底比 light 深一档，warn/danger/tip 标题、callout 链接、表格内
 *   code、选中态芯片均不达 4.5:1——sepia 专属覆盖加深。
 * 本 spec 把三类已修规则（与 e2e/a11y.spec.ts 同一白名单）钉在 dark × 8 页与
 * sepia × 8 页上：任何新代码把主题性对比度或地标问题带回来，都红在这里。
 *
 * 已知测量伪影（不修）：全树巡检中 `page-has-heading-one` 在个别页面偶现——
 * 直接探测显示恰好 1 个 h1，是 200–500ms 急等时机下的水合窗口产物；本门禁
 * 用 400ms 等待 + 白名单规则，该规则不在白名单内，不受影响。
 *
 * **行情条必须被强制渲染出来**（R16.302 补）：首页 `MarketTicker` 里那条
 * `.text-down` 跌箭头只在 `fetchPrices()` 成功、`setTickers()` 落地之后才挂进 DOM，
 * 而 CI 出口 IP 被 Binance 451 拒答（`runtime-health.spec.ts` 里已经按域名豁免过）。
 * 于是 2026-10-08 本地实测 sepia 下首页行情行 3.20:1（`--down: #dc2626` 落在
 * `--surface-hover: #ddd1bd` 上），CI 里 `a11y-themes` 却因为行情压根没渲染出来而
 * 「安静通过」。行情是外部依赖、门禁不能随出口网络抖动，所以这里显式桩掉那个
 * 24hr 端点（形状对齐真响应），让跌色行必现；桩只覆盖 `text-down` 所在的那一屏，
 * 不改组件、不碰其它路由。
 *
 * **本地台账必须一起种下去**（R16.304 补，行情条同一族）：只桩外部数据是不够的，
 * 站内那批「读了本地台账才渲染」的色板同样在门禁视野外。R16.302 合入之后重新扫
 * 一遍才发现两处：
 * - 首页 `StreakBadge` 那颗「历史最长」只在 `longest > streak` 时渲染（chip 用
 *   `text-faint` 落在 `--accent-dim` 合成底上，dark 4.46 / sepia 4.47，两家都差
 *   0.03 卡 AA 线下）；
 * - `/zh/stats` 的「成就徽章」整块 `stats.overallPct === 0 && stats.currentStreak
 *   === 0 && totalStudySeconds === 0` 短路返回 `null`；解锁徽章里的**未解锁**卡片
 *   用 `opacity-40` 洗整张卡（把 `--foreground` 洗到 sepia 2.06 / dark 3.35、把
 *   `text-faint` 洗到 sepia 1.65 / dark 1.71——都是 WCAG AA 的零头）。
 * 这两处和 R16.302 是同族：**「门禁量的东西不是坏的那个东西」，坏的是被数据挡在
 * 渲染之外的分支**。修法照 `runtime-health.spec.ts` 的 seed 形状（同一批键与真实
 * 形状），种完等一次水合再跑 axe；组件本身另修。种子的 `longest=20 / current=12`
 * 是「跨过 streak=0 短路」与「让 longest 触发渲染」两条下限同时成立的最短路径。
 */

const BINANCE_24HR_STUB = [
  { symbol: "BTCUSDT", lastPrice: "65000.1", priceChangePercent: "-2.34" },
  { symbol: "ETHUSDT", lastPrice: "3000.5", priceChangePercent: "-1.10" },
  { symbol: "SOLUSDT", lastPrice: "150.25", priceChangePercent: "-0.80" },
];

function localDate(offsetDays: number): string {
  const now = new Date();
  now.setDate(now.getDate() - offsetDays);
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

async function seedLedger(page: Page, theme: string): Promise<void> {
  const studyTime: Record<string, { read: number; quiz: number; replay: number }> = {};
  for (let i = 0; i < 12; i++) studyTime[localDate(i)] = { read: 900, quiz: 120, replay: 60 };
  const wrong: Record<string, unknown> = {};
  for (let q = 0; q < 3; q++) {
    wrong[`getting-started:${q}`] = {
      chapterNum: "getting-started",
      questionIdx: q,
      picked: 1,
      at: Date.now() - (q + 1) * 86_400_000,
      srsStage: q,
      srsDue: localDate(1 - q),
    };
  }
  const values: Record<string, string> = {
    "tb-theme": theme,
    "tb-migrated-v2": "1",
    "tb-progress": JSON.stringify({
      "getting-started": ["first-trade", "market-overview"],
      spot: ["spot-orders"],
    }),
    "tb-study-time": JSON.stringify(studyTime),
    "tb-activity": JSON.stringify(Array.from({ length: 12 }, (_, i) => localDate(i))),
    "tb-streak": JSON.stringify({
      lastDate: localDate(0),
      current: 12,
      longest: 20,
      lastTs: Date.now(),
    }),
    "tb-wrong": JSON.stringify(wrong),
    "tb-replay-history": JSON.stringify([
      { symbol: "BTCUSDT", interval: "1h", correct: 4, total: 5, at: Date.now(), durationMs: 90_000 },
    ]),
    "tb-replay-best": JSON.stringify({ symbol: "BTCUSDT", interval: "1h", bestStreak: 3 }),
  };
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, values);
}

const PAGES = [
  "/zh",
  "/en",
  "/zh/path",
  "/zh/chart",
  "/zh/stats",
  "/zh/search",
  "/zh/knowledge/getting-started/candlestick-basics",
  "/zh/knowledge/quant-practice/quant-toolchain",
];

/** 与 e2e/a11y.spec.ts 同一白名单：三类已 triage 的规则 */
const RULES = ["aria-valid-attr-value", "nested-interactive", "landmark-unique", "color-contrast"];

/** 首页带 `<MarketTicker>`：桩掉 24hr 端点后必须等那一行跌色真的挂进 DOM 才跑 axe，
 *  否则桩不生效或组件没水合完成，门禁又会退化成「安静通过」。 */
const HOME_PAGES = new Set(["/zh", "/en"]);

/** seed 之后必须让本地台账驱动的分支真的挂进 DOM 才跑 axe。三处下限各管一件事：
 *  - 首页：跌色行情行 + streak「最长」那颗只在 `longest > current` 时才渲染（用
 *    `text-muted` 落在 `--accent-dim` 合成底上）；
 *  - `/zh/stats`：`stats.overallPct===0 && totalStudySeconds===0 && currentStreak===0`
 *    时整块成就徽章 `return null`——种下去之后「成就」标题必须出现，未解锁卡片里
 *    的 `text-muted`/`text-faint` 才进得了 axe 视野。
 *  两条都是水合窗口，`waitFor` 而不是硬 sleep。 */
const SEEDED_PROBES: Partial<Record<string, (page: Page) => Promise<unknown>>> = {
  "/zh": async (page) => {
    await page.locator(".text-down").first().waitFor({ state: "visible", timeout: 5_000 });
    await page.getByText(/最长 \d+/).first().waitFor({ state: "visible", timeout: 5_000 });
  },
  "/en": async (page) => {
    await page.locator(".text-down").first().waitFor({ state: "visible", timeout: 5_000 });
    await page.getByText(/Best \d+/).first().waitFor({ state: "visible", timeout: 5_000 });
  },
  "/zh/stats": async (page) => {
    await page.getByText(/成就|Badge/i).first().waitFor({ state: "visible", timeout: 5_000 });
  },
};

for (const theme of ["dark", "sepia"] as const) {
  for (const path of PAGES) {
    test(`a11y（${theme}）：${path}`, async ({ page }) => {
      await seedLedger(page, theme);
      if (HOME_PAGES.has(path)) {
        await page.route(
          (url) => url.hostname === "api.binance.com" && url.pathname === "/api/v3/ticker/24hr",
          (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(BINANCE_24HR_STUB) }),
        );
      }
      await page.goto(path, { waitUntil: "load" });
      const probe = SEEDED_PROBES[path];
      if (probe) await probe(page);
      await page.waitForTimeout(400);
      const res = await new AxeBuilder({ page })
        .disableRules(["region"])
        .withRules(RULES)
        .analyze();
      const summary = res.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        sample: v.nodes[0]?.target.join(" "),
      }));
      expect(
        summary,
        `${theme} 主题 ${path} 出现 a11y 违规：修复它而不是放宽 RULES`
      ).toEqual([]);
    });
  }
}
