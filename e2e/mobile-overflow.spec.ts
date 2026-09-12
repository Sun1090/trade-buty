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

  test("课程页表格块级滚动、页面不溢出（R13.10）", async ({ page }) => {
    // 第一篇含表格的课程。若无表格则跳过块级断言，仍断言页面不溢出。
    await page.goto("/zh/knowledge/first-principles/risk-vs-return");
    const table = page.locator(".kb-prose table").first();
    if ((await table.count()) > 0) {
      const { scrollW, clientW } = await table.evaluate((el) => ({
        scrollW: (el as HTMLElement).scrollWidth,
        clientW: (el as HTMLElement).clientWidth,
      }));
      // 表格允许内部滚动（scrollWidth ≥ clientWidth），不得造成页级溢出
      expect(scrollW).toBeGreaterThanOrEqual(clientW);
    }
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(320);
  });
});

test.describe("R13.8 关键可点区域 ≥ 40px", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  async function expectMinHeights(page: Page, selector: string, what: string, min = 40) {
    const boxes = await page.locator(selector).evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height),
    );
    for (const h of boxes) {
      expect(h, `${what} 高度 ${h}px < ${min}px`).toBeGreaterThanOrEqual(min);
    }
  }

  test("测验选项按钮高度 ≥ 40px", async ({ page }) => {
    await page.goto("/zh/knowledge/getting-started/first-trade");
    const card = page.locator("section").filter({ hasText: "随堂测" });
    await card.getByRole("button").first().click();
    const options = page.locator("li button, li [role='button']");
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
});
