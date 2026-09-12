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
    await expect(page.getByTestId("estimated-reading-time")).toContainText(/约 \d+ 分钟阅读/);

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
 * R13.22：里程碑分享必须由真实学习进度触发，并在零进度时保持静默。
 */
test.describe("学习里程碑分享（R13.22）", () => {
  test("已有学习进度时显示用户主动分享入口", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "tb-progress",
        JSON.stringify({ "getting-started": ["market-overview"] }),
      );
      localStorage.setItem(
        "tb-progress-completions",
        JSON.stringify({
          "getting-started:market-overview": {
            chapter: "getting-started",
            doc: "market-overview",
            at: Date.now(),
          },
        }),
      );
    });

    await page.goto("/zh/stats");
    const share = page.getByTestId("milestone-share");
    await expect(share).toBeVisible();
    await expect(share.getByRole("button", { name: /分享里程碑/ })).toBeVisible();
  });

  test("零学习进度时不显示分享催促", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });

    await page.goto("/zh/stats");
    await expect(page.getByText("还没有学习记录")).toBeVisible();
    await expect(page.getByTestId("milestone-share")).toHaveCount(0);
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

/**
 * R13.18：搜索引擎旧链接进入未知页面时，用户必须能一键返回搜索或学习路线。
 */
test.describe("无结果页面 CTA（R13.18）", () => {
  test("根级 404 提供本地化可达入口", async ({ page }) => {
    await page.goto("/missing-from-search-engine");
    const ctas = page.getByTestId("root-no-result-cta");
    await expect(ctas).toBeVisible();
    await expect(ctas.locator('a[href="/en/search"]')).toBeVisible();
    await expect(ctas.locator('a[href="/en/path"]')).toBeVisible();
    await expect(ctas.locator('a[href="/en"]')).toBeVisible();
  });

  test("未知章节的搜索 CTA 进入当前语言搜索页", async ({ page }) => {
    await page.goto("/zh/knowledge/nonexistent-chapter");
    const ctas = page.getByTestId("chapter-no-result-cta");
    await expect(ctas).toBeVisible();
    const search = ctas.locator('a[href="/zh/search"]');
    await expect(search).toBeVisible();
    await expect(ctas.locator('a[href="/zh/path"]')).toBeVisible();
    await search.click();
    await expect(page).toHaveURL(/\/zh\/search$/);
    await expect(page.getByRole("searchbox")).toBeVisible();
  });

  test("未知课程保留推荐并提供英文学习路线出口", async ({ page }) => {
    await page.goto("/en/knowledge/getting-started/nonexistent-lesson");
    const ctas = page.getByTestId("doc-no-result-cta");
    await expect(ctas).toBeVisible();
    await expect(page.getByTestId("doc-suggestions")).toBeVisible();
    const path = ctas.locator('a[href="/en/path"]');
    await path.click();
    await expect(page).toHaveURL(/\/en\/path$/);
    await expect(page.locator("a[href*='/knowledge/']").first()).toBeVisible();
  });

  test("搜索零结果提供明显的学习路线 CTA", async ({ page }) => {
    await page.goto("/zh/search");
    await page.getByRole("searchbox").fill("definitely-no-such-lesson");
    const cta = page.getByTestId("search-empty-cta");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/zh/path");
    await cta.click();
    await expect(page).toHaveURL(/\/zh\/path$/);
  });
});

test.describe("更新日志（发布说明一致）", () => {
  test("中文页渲染策展版本记录", async ({ page }) => {
    await page.goto("/zh/changelog");
    await expect(page.getByRole("heading", { name: "最近更新" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /v0\.6\.0/ })).toBeVisible();
    await expect(page.getByText("内容覆盖、AI 质量与学习留存")).toBeVisible();
  });

  test("英文页渲染对应语言的发布说明", async ({ page }) => {
    await page.goto("/en/changelog");
    await expect(page.getByText("Content coverage, AI quality, and learning retention")).toBeVisible();
  });
});

test.describe("安全响应头（R7.12）", () => {
  test("HTML 路由下发完整安全头集合", async ({ request }) => {
    const res = await request.get("/zh");
    expect(res.status()).toBe(200);
    const headers = res.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe(
      "camera=(), microphone=(), geolocation=(), payment=()"
    );

    const csp = headers["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self'");

    // 2026-09 HSTS 补口：两年期 + includeSubDomains，刻意不含不可逆的 preload。
    const hsts = headers["strict-transport-security"] ?? "";
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).not.toContain("preload");
    expect(Number(/max-age=(\d+)/.exec(hsts)?.[1])).toBeGreaterThanOrEqual(63072000);
  });

  test("静态内容产物同样带安全头与重验证缓存（R10.24）", async ({ request }) => {
    const res = await request.get("/search-index.json");
    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers["strict-transport-security"]).toContain("includeSubDomains");
    expect(headers["cache-control"]).toBe("public, max-age=0, must-revalidate");
  });
});

test.describe("错误上报端点（R7.6）", () => {
  test("合法匿名诊断返回 202 且不缓存", async ({ request }) => {
    const res = await request.post("/api/error-reports", {
      data: { level: "fatal", scope: "route-error", kind: "Error", digest: "abc123" },
    });
    expect(res.status()).toBe(202);
    expect(res.headers()["cache-control"]).toBe("no-store");
  });

  test("未知字段整包拒绝，不记录也不透传", async ({ request }) => {
    const res = await request.post("/api/error-reports", {
      data: {
        level: "fatal",
        scope: "route-error",
        kind: "Error",
        message: "token=secret-13800138000",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("超长 body 被有界读取拒绝", async ({ request }) => {
    const res = await request.post("/api/error-reports", {
      data: { level: "fatal", scope: "a".repeat(3000), kind: "Error" },
    });
    expect(res.status()).toBe(413);
  });
});
