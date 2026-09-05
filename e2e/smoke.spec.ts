import { test, expect } from "@playwright/test";

/**
 * R7.7：关键用户路径 E2E 冒烟（未登录可达路径）。
 * 首页 → 学习路线 → 章节页 → 课程页 → 测验作答 → 复习页 → 回放页 → AI 页。
 */

test.describe("核心路径冒烟", () => {
  test("首页加载且有导航", async ({ page }) => {
    await page.goto("/zh");
    await expect(page).toHaveTitle(/Trade Buty/);
    await expect(page.locator("a[href='/zh/path']").first()).toBeVisible();
  });

  test("学习路线页渲染章节列表", async ({ page }) => {
    await page.goto("/zh/path");
    await expect(page.locator("a[href*='/knowledge/']").first()).toBeVisible();
  });

  test("章节页 → 课程页 → 测验作答闭环", async ({ page }) => {
    await page.goto("/zh/knowledge/getting-started");
    await expect(page.getByText("入门基础", { exact: false }).first()).toBeVisible();

    // 进入第一章第一课（有固定题库挂载）
    await page.goto("/zh/knowledge/getting-started/first-trade");
    await expect(page.locator("article")).toBeVisible();

    // 展开随堂测（锚定测验卡片，避免误点页头 CTA）并作答
    const card = page.locator("section").filter({ hasText: "随堂测" });
    await card.getByRole("button").click();
    // 展开后取第一个「可见」选项（页面 TOC 里也有隐藏 ul li）
    await page.locator("li").locator("visible=true").first().click();
    // 出现解析区（✅/❌ 任一）
    await expect(page.getByText(/✅|❌/).first()).toBeVisible();
  });

  test("复习页渲染（无错题时显示空态）", async ({ page }) => {
    await page.goto("/zh/review");
    await expect(page.locator("body")).toContainText(/错题|Review|空/i);
  });

  test("回放页加载图表容器", async ({ page }) => {
    await page.goto("/zh/replay");
    await expect(page.locator("body")).toContainText(/回放|Replay/i);
  });

  test("AI 问答页空状态与示例问题", async ({ page }) => {
    await page.goto("/zh/ai");
    await expect(page.getByText("试试这样问")).toBeVisible();
    const suggestions = page.locator("button").filter({ hasText: /什么是|如何|怎么/ });
    await expect(suggestions.first()).toBeVisible();
  });

  test("未知章节展示软 404 内容", async ({ page }) => {
    const res = await page.goto("/zh/knowledge/nonexistent-chapter");
    // 章节页对未知 slug 渲染自定义 not-found 内容（HTTP 状态为 200）
    await expect(page.locator("body")).toContainText(/不存在|找不到|not found/i);
    expect(res!.status()).toBeLessThan(500);
  });
});
