import { test, expect } from "@playwright/test";
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
 * **行情条必须被强制渲染出来**（本轮补）：首页 `MarketTicker` 里那条
 * `.text-down` 跌箭头只在 `fetchPrices()` 成功、`setTickers()` 落地之后才挂进 DOM，
 * 而 CI 出口 IP 被 Binance 451 拒答（`runtime-health.spec.ts` 里已经按域名豁免过）。
 * 于是 2026-10-08 本地实测 sepia 下首页行情行 3.20:1（`--down: #dc2626` 落在
 * `--surface-hover: #ddd1bd` 上），CI 里 `a11y-themes` 却因为行情压根没渲染出来而
 * 「安静通过」。行情是外部依赖、门禁不能随出口网络抖动，所以这里显式桩掉那个
 * 24hr 端点（形状对齐真响应），让跌色行必现；桩只覆盖 `text-down` 所在的那一屏，
 * 不改组件、不碰其它路由。
 */

const BINANCE_24HR_STUB = [
  { symbol: "BTCUSDT", lastPrice: "65000.1", priceChangePercent: "-2.34" },
  { symbol: "ETHUSDT", lastPrice: "3000.5", priceChangePercent: "-1.10" },
  { symbol: "SOLUSDT", lastPrice: "150.25", priceChangePercent: "-0.80" },
];

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

for (const theme of ["dark", "sepia"] as const) {
  for (const path of PAGES) {
    test(`a11y（${theme}）：${path}`, async ({ page }) => {
      await page.addInitScript((t) => {
        try {
          localStorage.setItem("tb-theme", t);
        } catch {}
      }, theme);
      if (HOME_PAGES.has(path)) {
        await page.route(
          (url) => url.hostname === "api.binance.com" && url.pathname === "/api/v3/ticker/24hr",
          (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(BINANCE_24HR_STUB) }),
        );
      }
      await page.goto(path, { waitUntil: "load" });
      if (HOME_PAGES.has(path)) {
        await expect(page.locator(".text-down").first()).toBeVisible({ timeout: 5_000 });
      }
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
