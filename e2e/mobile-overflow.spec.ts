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

/**
 * 「溢出时是谁撑宽的」——**只此一份**，页面判据与自证用例共用。
 *
 * 探针踩出来的：先前我在 `expectNoPageOverflow` 和自证用例里各抄了一份同样的挑选逻辑，
 * 变异只命中第一份，自证那条腿就此空转（`.gate-logs/detector-fixture-r83.mjs` 同一对坑）。
 * 这正是 R16.329 的病灶本身：逻辑没有主人，抄两份就有一份会烂掉。
 *
 * 两个坑都要防：
 * ① 只看盒子的 `getBoundingClientRect()` 会点名被 `overflow-hidden` 裁掉的装饰元素
 *    （它 rect 越界却撑不宽页面，报出来与 `scrollWidth` 自相矛盾）→ 祖先链上有裁剪的排除。
 * ② inline 文本溢出**不改变元素自己的 rect**（真凶的 rect 仍在视口内）→ 必须同时看
 *    元素自身的 `scrollWidth > clientWidth`，只看几何就结构上看不见这类溢出。
 *
 * 作为自包含函数交给 `page.evaluate`（Playwright 序列化其源码，不引用外部绑定）。
 */
function findOverflowCulprits(): {
  id: string | null;
  tag: string;
  cls: string;
  right: number;
  inner: string | null;
  text: string;
}[] {
  const edge = window.innerWidth + 1;
  const clipped = (el: Element) => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      if (o === "hidden" || o === "clip" || o === "auto" || o === "scroll") return true;
    }
    return false;
  };
  // 两种越界都要看：盒子本身越界，或盒子里的内容（inline 溢出）越出自己的盒子
  const over = (el: Element) =>
    el.getBoundingClientRect().right > edge || el.scrollWidth > el.clientWidth + 1;
  const rows = Array.from(document.querySelectorAll("body *"))
    .filter(over)
    .map((el) => ({
      id: el.id || null,
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute("class") ?? "").slice(0, 60),
      right: Math.round(el.getBoundingClientRect().right),
      clipped: clipped(el),
      inner: el.scrollWidth > el.clientWidth + 1 ? `${el.scrollWidth}>${el.clientWidth}` : null,
      // 有没有更深的子元素也越界：外层容器必然跟着撑宽，报它没有信息量
      deeper: Array.from(el.children).some(over),
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
    }));
  const live = rows.filter((row) => !row.clipped);
  const leaf = live.filter((row) => !row.deeper);
  return (leaf.length > 0 ? leaf : live.length > 0 ? live : rows).slice(0, 6);
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
  // 探测器踩过的两个坑，都有夹具作证（`.gate-logs/detector-fixture-r83.mjs`）：
  // ① 第一版只看盒子的 `getBoundingClientRect()`，于是点名了一个 `right: 367` 的装饰光晕——
  //    它祖先带 `overflow-hidden`，压根撑不宽页面，而 `scrollWidth` 只有 354：读数自相矛盾
  //    就是挑错了人。所以祖先链上有裁剪的要排除。
  // ② 排除之后夹具里**一个都不剩**：真凶是一段不可断行的长 token，而 inline 文本溢出
  //    **不会改变元素自己的 rect**（它的 rect 仍是 304）。所以必须同时看元素自身的
  //    `scrollWidth > clientWidth`——只看盒子几何，这类溢出结构上就看不见。
  const overflowing = widths.scroll > 320;
  const culprits = overflowing ? await page.evaluate(findOverflowCulprits) : [];
  expect(
    widths.scroll,
    `${path}: page scrollWidth ${widths.scroll} > clientWidth ${widths.client}（320px 视口横向溢出）` +
      (overflowing ? ` · 越界的叶子元素：${JSON.stringify(culprits)}` : ""),
  ).toBeLessThanOrEqual(320);
  expect(widths.body).toBeLessThanOrEqual(320);
}

test.describe("R13.7 320px 核心路径不横向溢出", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  /**
   * 上面那套「溢出时点名元凶」的探测器本身也要有判据：它挑错人时，红在 CI 上仍然只能靠猜。
   * 夹具（`.gate-logs/detector-fixture-r83.mjs`）量出两个坑——被 `overflow-hidden` 裁掉的
   * 装饰元素会顶掉真凶；而 inline 文本溢出**不改变元素自己的 rect**，只看几何就一个都抓不到。
   * 这里在同一份逻辑上跑一次真浏览器：两种越界都要抓到、被裁的那个不许报。
   */
  test("溢出探测器认得出真凶、不误报被裁剪的装饰元素（自证）", async ({ page }) => {
    await page.setContent(`<!doctype html><html><head><meta charset=utf-8><style>
      *,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}
      .page{padding:0 16px}
      .card{position:relative;overflow:hidden;border:1px solid #888;padding:24px}
      .glow{position:absolute;right:-64px;top:-80px;width:192px;height:192px;background:#0f0}
      p{font-size:14px}
    </style></head><body><div class="page">
      <div class="card"><div class="glow"></div><p>正文</p></div>
      <p id="real">${"A".repeat(120)}</p>
    </div></body></html>`);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      "夹具本身没造出溢出，下面所有比对都是空转",
    ).toBeGreaterThan(320);
    const picked = (await page.evaluate(findOverflowCulprits)).map((row) => row.id);
    // 只点名那个真把内容撑出盒子的段落；被祖先裁掉的 .glow 不许出现
    expect(picked, `探测器点名了 ${JSON.stringify(picked)}，应当只有 real`).toEqual(["real"]);
  });

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

  /**
   * R16.329：更新日志页会渲染**仓库原文**（commit subject、文档路径），里面出现
   * 40 位 SHA、`docs/v0.7.2-release-review.md` 这类不可断行长 token 是常态。
   * 这条缺陷本地永远测不到：CI 上 HEAD 是 PR 的 merge 提交（subject 含 40 位完整 SHA），
   * 本地 HEAD 的 subject 里没有这种 token——同一份代码，两个环境两个读数。
   * 所以判据不能依赖「恰好有一条长 subject」，必须在真页面上**现造**一个最坏载荷来量。
   */
  test("更新日志页遇到不可断行的长 token 不许把页面顶宽（R16.329）", async ({ page }) => {
    await page.goto("/zh/changelog");
    const rows = page.locator('p[data-copy-source="commit"]');
    await expect(rows.first()).toBeVisible();
    // 用 CI 上真实出现过的那条 subject 作载荷：`Merge <40 位 SHA> into <8 位 SHA>`
    await rows.first().evaluate((el) => {
      el.textContent =
        "Merge 782e4ba5900f11665b387694b602a1bdbe6c3c82 into 15b74e7f";
    });
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cell: (() => {
        const el = document.querySelector('p[data-copy-source="commit"]');
        return el ? `${el.scrollWidth}>${el.clientWidth}` : null;
      })(),
    }));
    expect(
      widths.scroll,
      `/zh/changelog 塞入一条含 40 位 SHA 的 commit subject 后页级溢出（scrollWidth ${widths.scroll}，该行 ${widths.cell}）：这一页渲染仓库原文，长 token 必须由样式兜住断行`,
    ).toBeLessThanOrEqual(320);

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
