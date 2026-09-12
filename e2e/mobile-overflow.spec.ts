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
});
