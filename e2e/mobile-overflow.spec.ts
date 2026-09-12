import { test, expect, type Page } from "@playwright/test";

/**
 * R13.7：320px 宽（最窄主流手机）核心路径不横向溢出。
 * R13.8：关键可点区域（测验选项、分享动作、移动端导航触发）≥ 40px。
 * 表格/代码块属于文档正文，允许块级内部横向滚动，不允许页级溢出。
 */

const CORE_PATHS = [
  "/zh",
  "/zh/path",
  "/zh/knowledge/getting-started",
  "/zh/knowledge/getting-started/first-trade",
  "/zh/review",
  "/zh/replay",
  "/zh/stats",
  "/zh/glossary",
  "/zh/feedback",
  "/zh/ai",
];

async function dismissOnboarding(page: Page) {
  // useEffect 才会把引导挂到 DOM；出现即证明客户端已 hydrate。
  const tour = page.getByTestId("onboarding-tour");
  await tour.waitFor({ state: "visible" });
  await page.getByTestId("onboarding-skip").click();
  await expect(tour).toBeHidden();
}

async function expectNoPageOverflow(page: Page, path: string) {
  await page.goto(path);
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
  }));
  expect(
    widths.scroll,
    `${path}: page scrollWidth ${widths.scroll} > clientWidth ${widths.client}（320px 视口横向溢出）`,
  ).toBeLessThanOrEqual(320);
  expect(widths.body).toBeLessThanOrEqual(320);
}

test.describe("R13.7 320px 核心路径不横向溢出", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  for (const path of CORE_PATHS) {
    test(`${path} 无页级横向滚动`, async ({ page }) => {
      await expectNoPageOverflow(page, path);
    });
  }

  test("课程页表格与代码块可块级滚动、页面不溢出（R13.10）", async ({ page }) => {
    await page.goto("/zh/knowledge/getting-started/first-trade");

    const table = page.locator(".kb-prose table").first();
    const code = page.locator(".kb-prose pre").first();
    await expect(table).toBeVisible();
    await expect(code).toBeVisible();

    const metrics = await page.locator(".kb-prose table, .kb-prose pre").evaluateAll((els) =>
      els.map((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: getComputedStyle(el).overflowX,
      })),
    );
    expect(metrics.length).toBeGreaterThan(0);
    for (const metric of metrics) {
      expect(metric.overflowX).toBe("auto");
      expect(metric.scrollWidth).toBeGreaterThanOrEqual(metric.clientWidth);
    }
    expect(
      metrics.some((metric) => metric.scrollWidth > metric.clientWidth),
      "课程页至少应有一个真实溢出的宽表格或代码块，证明块级滚动而非缩放/截断",
    ).toBe(true);

    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(320);
  });
});

test.describe("R13.8 关键可点区域 ≥ 40px", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("测验选项按钮高度 ≥ 40px", async ({ page }) => {
    await page.goto("/zh/knowledge/getting-started/first-trade");
    await dismissOnboarding(page);
    const start = page.getByRole("button", { name: /开始测验|再测一次/ });
    await start.click(); // 展开课末测验卡
    await start.click(); // 进入题库首题
    const options = page.getByRole("button", { name: /^[A-D]\./ });
    await expect(options.first()).toBeVisible();
    const heights = await options.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height).filter((h) => h > 0),
    );
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(40);
  });

  test("移动端导航触发按钮 ≥ 40px", async ({ page }) => {
    await page.goto("/zh");
    const trigger = page.locator("button").filter({ has: page.locator("svg") }).first();
    await expect(trigger).toBeVisible();
    const box = await trigger.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(40);
    expect(box!.width).toBeGreaterThanOrEqual(40);
  });

  test("移动端导航支持焦点圈定、Escape 关闭与焦点归还（R13.9）", async ({ page }) => {
    await page.goto("/zh");
    const trigger = page.getByRole("button", { name: "Menu" });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link").first()).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("行情图移动端默认精简加载并可切回完整视图（R13.11）", async ({ page }) => {
    const requestedLimits: string[] = [];
    await page.route(/\/api\/v3\/klines(?:\?|$)/, async (route) => {
      const limit = new URL(route.request().url()).searchParams.get("limit");
      if (limit) requestedLimits.push(limit);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });

    await page.goto("/zh/chart");
    const chart = page.getByTestId("kline-chart");
    await expect(chart).toHaveAttribute("data-density", "compact");
    await expect.poll(() => requestedLimits).toContain("180");
    await expect(page.getByText(/最近 180 根 K 线/)).toBeVisible();

    await page.getByTestId("chart-density-toggle").click();
    await expect(chart).toHaveAttribute("data-density", "full");
    await expect.poll(() => requestedLimits).toContain("500");
    await expect(page.getByText(/最近 500 根 K 线/)).toBeVisible();
  });
});

test.describe("R13.12 慢速/离线网络降级", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("慢速网络使用精简图表、暂停实时推送与完整视图", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => true,
      });
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: {
          effectiveType: "2g",
          saveData: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        },
      });
    });

    const requestedLimits: string[] = [];
    await page.route(/\/api\/v3\/klines(?:\?|$)/, async (route) => {
      const limit = new URL(route.request().url()).searchParams.get("limit");
      if (limit) requestedLimits.push(limit);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });

    await page.goto("/zh/chart");
    const chart = page.getByTestId("kline-chart");
    await expect(chart).toHaveAttribute("data-network-quality", "slow");
    await expect(chart).toHaveAttribute("data-density", "compact");
    await expect(page.getByTestId("network-quality-note")).toContainText(
      /慢速模式|暂停实时推送/,
    );
    await expect(page.getByTestId("chart-density-toggle")).toHaveCount(0);
    await expect.poll(() => requestedLimits).toEqual(["180"]);
    await page.waitForTimeout(250);
    expect(requestedLimits).toEqual(["180"]);

    await page.route(
      /https:\/\/api\.binance\.com\/api\/v3\/ticker\/24hr.*/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { symbol: "BTCUSDT", lastPrice: "60000", priceChangePercent: "1.2" },
            { symbol: "ETHUSDT", lastPrice: "3000", priceChangePercent: "-0.4" },
            { symbol: "SOLUSDT", lastPrice: "150", priceChangePercent: "2.1" },
          ]),
        });
      },
    );
    await page.goto("/zh");
    await expect(page.getByTestId("market-ticker")).toHaveAttribute(
      "data-network-quality",
      "slow",
    );
    await expect(page.getByTestId("market-network-note")).toContainText(
      "60 秒",
    );
  });

  test("离线时不发起图表请求并显示自动重试说明", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => false,
      });
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: {
          effectiveType: "4g",
          saveData: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        },
      });
    });

    let requests = 0;
    await page.route(/\/api\/v3\/klines(?:\?|$)/, async (route) => {
      requests += 1;
      await route.abort();
    });

    await page.goto("/zh/chart");
    const chart = page.getByTestId("kline-chart");
    await expect(chart).toHaveAttribute("data-network-quality", "offline");
    await expect(page.getByTestId("network-quality-note")).toContainText(
      /恢复联网后会自动重试/,
    );
    await page.waitForTimeout(300);
    expect(requests).toBe(0);
  });
});
