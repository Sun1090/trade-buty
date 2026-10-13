import { test, expect, type Page } from "@playwright/test";
import { LOCALES } from "../src/lib/i18n";
import { encodeQuiz, encodeReplay, encodeStreak } from "../src/lib/share-decode";

/**
 * R13.7：320px 宽（最窄主流手机）核心路径不横向溢出。
 * R13.8：关键可点区域（测验选项、分享动作、移动端导航触发）≥ 40px。
 * 表格/代码块属于文档正文，允许块级内部横向滚动，不允许页级溢出。
 */

/**
 * 核心路径 × 全部语言。原先清单只有 `/zh/…`，而 `docs/ops.md` 写着「14 个关键 zh/en
 * 页面」——en 的字符串普遍更长，溢出风险只会更高，那一半从来没被量过。
 * `/zh/feedback` 也不是一页（站内只有 `/api/ai/feedback`），它混进来之后那条用例
 * 量的其实是 404 页，永远不会红；换成 `/chart`（最宽的交互界面）。
 */
const CORE_SUFFIXES = [
  "",
  "/path",
  "/knowledge/getting-started",
  "/knowledge/getting-started/first-trade",
  "/review",
  "/replay",
  "/stats",
  "/glossary",
  "/chart",
  "/ai",
  /**
   * R16.329：以下 9 条是「两条移动门禁合起来仍然没量到」的那一批页面模板。
   * 病灶不是漏写，而是**清单没有主人**——`scripts/privacy-ext-route-coverage.test.mjs`
   * 上一轮给跨源判据立的那条规矩（清单由源码树推导）同样适用于这里，
   * 由 `scripts/mobile-coverage-claims.test.mjs` 钉住「每个 page.tsx 至少被一条移动门禁量到」。
   *
   * 为什么 `/privacy` 最该先进来：R16.327 刚把那一节的文案从一句改写成三句（含
   * `api.binance.com` 这种不可断行的长 token），而改完之后没有任何东西在 320px 下
   * 看过这一页——**我改了一页自己量不到的界面**。
   */
  "/about",
  "/terms",
  "/faq",
  "/privacy",
  "/changelog",
  "/calendar",
  "/bookmarks",
  "/search",
  "/auth",
  // 回调页与 /auth 是两页（一个是登录入口，一个是 OTP 落地），少一条就漏一整页
  "/auth/callback",
];

/**
 * 根级 `/share/{kind}/{payload}`：locale 编在载荷里，所以它不在 `[locale]` 树下，
 * 上面那份「× LOCALES」的矩阵结构上就盖不到它。载荷由 `src/lib/share-decode`
 * 现生成（不抄 base64 串——编码器一改，抄的那串就变成一条测 404 的假覆盖）。
 */
const SHARE_PATHS = [
  `/share/quiz/${encodeURIComponent(
    encodeQuiz({
      chapterTitle: "入门基础",
      score: 7,
      total: 10,
      percent: 70,
      locale: "zh",
    }),
  )}`,
  `/share/replay/${encodeURIComponent(
    encodeReplay({
      symbol: "BTCUSDT",
      interval: "1h",
      correct: 7,
      total: 10,
      accuracyBps: 7000,
      bestStreak: 5,
      currentStreak: 3,
      locale: "en",
    }),
  )}`,
  `/share/streak/${encodeURIComponent(
    encodeStreak({ currentStreak: 12, longestStreak: 30, locale: "zh" }),
  )}`,
];

/**
 * 本 spec 里**不靠 CORE_PATHS 静态清单**覆盖到的页面模板，写成 Next 的 page 文件形状。
 * 门禁（`scripts/mobile-coverage-claims.test.mjs`）不照单全收：每一串都必须在 spec 源码里
 * 真的对应一处 `page.goto("/<首段>/` ——删掉上面那三条用例而留着这个声明，就会红。
 */
const DYNAMIC_TEMPLATE_COVERAGE = ["/share/[kind]/[path]"];
const CORE_PATHS = LOCALES.flatMap((locale) =>
  CORE_SUFFIXES.map((suffix) => `/${locale}${suffix}`)
);

async function dismissOnboarding(page: Page) {
  // useEffect 才会把引导挂到 DOM；出现即证明客户端已 hydrate。
  const tour = page.getByTestId("onboarding-tour");
  await tour.waitFor({ state: "visible" });
  await page.getByTestId("onboarding-skip").click();
  await expect(tour).toBeHidden();
}

async function expectNoPageOverflow(page: Page, path: string) {
  const res = await page.goto(path);
  // 先钉住「这真的是一页」：清单里混进死路径时，404 页不溢出，用例会在假覆盖上全绿。
  expect(res?.status(), `${path} 未返回 200（清单里混了不存在的路径）`).toBe(200);
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
  }));
  // R16.329：溢出时点名「是谁撑宽的」。同一页可以本地 320 不溢出、CI 354 溢出（字体度量
  // 与仓库原文两处都可能不同），只报一个数字的判据红在 CI 上时无从下手，只能靠猜。
  // 故仅在**已判定溢出**时才现读——通过的那一趟零开销，不做全量 DOM 扫描。
  //
  // 第一版只按「几何越界 + 没有更深的越界子元素」挑，结果点名了一个 `right: 367` 的
  // 装饰光晕：它祖先带 `overflow-hidden`，压根撑不宽页面，而 `scrollWidth` 只有 354——
  // 读数自相矛盾就是探测器挑错了人。现在按**能不能真的撑宽**筛：祖先链上有裁剪的先排除。
  const overflowing = widths.scroll > 320;
  const culprits = overflowing
    ? await page.evaluate(() => {
        const edge = window.innerWidth + 1;
        // 祖先把溢出裁掉了，就不可能是它撑宽了页面
        const clipped = (el: Element) => {
          for (let a = el.parentElement; a; a = a.parentElement) {
            const o = getComputedStyle(a).overflowX;
            if (o === "hidden" || o === "clip" || o === "auto" || o === "scroll") return true;
          }
          return false;
        };
        const rows = Array.from(document.querySelectorAll("body *"))
          .filter((el) => el.getBoundingClientRect().right > edge)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              tag: el.tagName.toLowerCase(),
              cls: (el.getAttribute("class") ?? "").slice(0, 60),
              right: Math.round(r.right),
              clipped: clipped(el),
              // 有没有更深的子元素也越界：外层容器必然跟着撑宽，报它没有信息量
              deeper: Array.from(el.children).some(
                (c) => c.getBoundingClientRect().right > edge
              ),
              text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
            };
          });
        const live = rows.filter((row) => !row.clipped);
        const leaf = live.filter((row) => !row.deeper);
        return (leaf.length > 0 ? leaf : live.length > 0 ? live : rows).slice(0, 6);
      })
    : [];
  expect(
    widths.scroll,
    `${path}: page scrollWidth ${widths.scroll} > clientWidth ${widths.client}（320px 视口横向溢出）` +
      (overflowing ? ` · 越界的叶子元素：${JSON.stringify(culprits)}` : ""),
  ).toBeLessThanOrEqual(320);
  expect(widths.body).toBeLessThanOrEqual(320);
}

test.describe("R13.7 320px 核心路径不横向溢出", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("清单覆盖每一种语言，且没有退回只量 zh", () => {
    // 这一条是上面那组用例的前提：清单塌回单语时，20 条会变成 10 条并且全绿，
    // 而 `docs/ops.md` 说的可是「zh/en 页面」。
    expect(CORE_PATHS.length).toBeGreaterThanOrEqual(LOCALES.length * 10);
    for (const locale of LOCALES) {
      const covered = CORE_PATHS.filter(
        (path) => path === `/${locale}` || path.startsWith(`/${locale}/`)
      ).length;
      expect(covered, `语言 ${locale} 的核心路径不足`).toBeGreaterThanOrEqual(10);
    }
  });

  for (const path of CORE_PATHS) {
    test(`${path} 无页级横向滚动`, async ({ page }) => {
      await expectNoPageOverflow(page, path);
    });
  }

  for (const path of SHARE_PATHS) {
    test(`${path} 无页级横向滚动（根级分享落地页）`, async ({ page }) => {
      await expectNoPageOverflow(page, path);
    });
  }

  test("认领的动态模板必须有真用例兜着（认领不许空转）", () => {
    // `DYNAMIC_TEMPLATE_COVERAGE` 是给门禁读的声明；声明本身可以被绕过，
    // 所以这里在 spec 内部再钉一次：每一串认领都要在 SHARE_PATHS 里真的有具体路径。
    expect(DYNAMIC_TEMPLATE_COVERAGE.length).toBeGreaterThan(0);
    for (const template of DYNAMIC_TEMPLATE_COVERAGE) {
      const head = `/${template.split("/").filter(Boolean)[0]}/`;
      const matched = SHARE_PATHS.filter((path) => path.startsWith(head));
      expect(
        matched.length,
        `认领了 ${template}，但 SHARE_PATHS 里没有以 ${head} 开头的路径：这条认领是空话`,
      ).toBeGreaterThanOrEqual(3);
      // 段数也要对得上：`/share/[kind]/[path]` 是三段模板
      const segs = template.split("/").filter(Boolean).length;
      for (const path of matched) {
        expect(path.split("/").filter(Boolean).length, `${path} 与模板 ${template} 段数不同`).toBe(segs);
      }
    }
  });

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
    const trigger = page.getByRole("button", { name: "菜单" });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "菜单" });
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
