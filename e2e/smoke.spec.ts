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

  test("AI 问答页可达（有 key 显示示例，无 key 显示禁用态）", async ({ page }) => {
    await page.goto("/zh/ai");
    // R3.9：AI_API_KEY 缺失的环境（如 CI）展示禁用态；有 key 展示空状态示例
    await expect(page.locator("body")).toContainText(/试试这样问|暂未开启|unavailable/i);
  });

  test("未知章节展示软 404 内容", async ({ page }) => {
    const res = await page.goto("/zh/knowledge/nonexistent-chapter");
    // 章节页对未知 slug 渲染自定义 not-found 内容（HTTP 状态为 200）
    await expect(page.locator("body")).toContainText(/不存在|找不到|not found/i);
    expect(res!.status()).toBeLessThan(500);
  });
});

/**
 * R13.17：可索引表面的线上契约（sitemap / robots.txt / 页面 robots meta 三者自洽）。
 * 产物级全量复核在 `npm run check:seo-surface`，这里只钉住用户可见的几条真实响应。
 */
test.describe("SEO 表面复核（R13.17）", () => {
  test("可索引页面有自身 canonical 且没有 noindex", async ({ page }) => {
    await page.goto("/zh/path");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/zh\/path$/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test("仪表盘与 FAQ 明确 noindex", async ({ page }) => {
    await page.goto("/zh/stats");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.goto("/zh/faq");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("软 404 自报 noindex（未知章节 / 未知课程）", async ({ page }) => {
    await page.goto("/zh/knowledge/nonexistent-chapter");
    await expect(page.locator("body")).toContainText(/不存在|找不到|not found/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    // 章节在、课程不存在：同样走软 404 分支
    await page.goto("/zh/knowledge/getting-started/nonexistent-lesson");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("robots.txt 只挡非页面资源，不再与页面的 noindex 打架", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/^Sitemap:\s+https?:\/\/\S+\/sitemap\.xml$/m);
    expect(body).toContain("Disallow: /api/");
    expect(body).not.toContain("Disallow: /*/ai");
  });

  test("sitemap 收录可索引页面、排除 noindex 页面", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    for (const path of ["/zh", "/en", "/zh/path", "/en/path", "/zh/chart", "/zh/search"]) {
      expect(body).toContain(`${path}<`);
    }
    expect(body).toContain("/zh/knowledge/getting-started<");
    for (const path of ["/zh/faq", "/zh/stats", "/zh/privacy", "/zh/about", "/zh/glossary"]) {
      expect(body).not.toContain(`${path}<`);
    }
  });
});
