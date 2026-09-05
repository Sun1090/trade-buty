import { test, expect } from "@playwright/test";

/**
 * R7.8：视觉回归基线——核心 5 页截图存档。
 * 运行：npm run build && npm run e2e:visual
 * - 首次运行用 --update-snapshots 生成基线（提交入库）
 * - 后续运行 diff，差异需人工复核后更新基线
 * 注意：字体渲染随平台差异，基线需在与 CI 相同的平台（ubuntu）生成或本地人工复核。
 */

const PAGES = [
  { path: "/zh", name: "home" },
  { path: "/zh/path", name: "path" },
  { path: "/zh/knowledge/getting-started/first-trade", name: "lesson" },
  { path: "/zh/review", name: "review" },
  { path: "/zh/ai", name: "ai" },
];

test.describe("视觉基线", () => {
  for (const { path, name } of PAGES) {
    test(`基线：${name}`, async ({ page }) => {
      await page.goto(path);
      // 等字体与渐入动画稳定
      await page.waitForTimeout(800);
      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      });
    });
  }
});
