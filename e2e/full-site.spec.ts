import { readFile } from "node:fs/promises";
import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * R13.24：v0.6 全站冒烟扩展。
 *
 * 与既有三个 spec 分工：
 * - smoke.spec.ts 钉住基础可达性与 SEO 契约
 * - mobile-overflow.spec.ts 钉住 320px / 焦点 / 网络降级
 * - pwa-offline.spec.ts 钉住 Service Worker 生命周期
 *
 * 本文件补齐真实用户闭环：双语路由、搜索、收藏、错题复习、统计、
 * 术语表、隐私导出，以及用确定性行情响应验证图表和回放控制。
 */

const ZH_CORE_PATHS = [
  "/zh",
  "/zh/path",
  "/zh/chart",
  "/zh/replay",
  "/zh/review",
  "/zh/search",
  "/zh/glossary",
  "/zh/privacy",
  "/zh/bookmarks",
] as const;

const EN_CORE_PATHS = [
  "/en",
  "/en/path",
  "/en/chart",
  "/en/replay",
  "/en/review",
  "/en/search",
  "/en/glossary",
  "/en/privacy",
  "/en/bookmarks",
] as const;

const LESSON_PATH = "/zh/knowledge/getting-started/first-trade";

async function expectVisibleFocusRing(page: Page, locator: Locator) {
  await locator.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  const outline = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      color: style.outlineColor,
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(outline.style).toBe("solid");
  expect(outline.width).toBeGreaterThanOrEqual(2);
  expect(outline.color).not.toBe("rgba(0, 0, 0, 0)");
}

async function seedStorage(page: Page, values: Record<string, string>) {
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  }, values);
}

function currentLocalDate(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function klinePayload(limit: number, interval = "1h"): (number | string)[][] {
  const stepMs: Record<string, number> = {
    "15m": 15 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "1d": 24 * 60 * 60_000,
  };
  const step = stepMs[interval] ?? 60 * 60_000;
  const start = Date.UTC(2026, 0, 1);
  return Array.from({ length: limit }, (_, i) => {
    const open = 60_000 + i * 2;
    const close = open + (i % 2 === 0 ? 12 : -8);
    return [
      start + i * step,
      String(open),
      String(Math.max(open, close) + 20),
      String(Math.min(open, close) - 20),
      String(close),
      String(100 + i),
      start + (i + 1) * step - 1,
      "0",
      1,
      "0",
      "0",
      "0",
    ];
  });
}

async function mockBinance(page: Page, requests: string[]) {
  await page.route("https://api.binance.com/api/v3/klines**", async (route) => {
    const url = new URL(route.request().url());
    const interval = url.searchParams.get("interval") ?? "1h";
    const limit = Number(url.searchParams.get("limit") ?? "300");
    requests.push(url.toString());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(klinePayload(limit, interval)),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await seedStorage(page, { "tb-onboarded": "1" });
});

test.describe("R13.24 双语全站核心路由", () => {
  for (const [locale, paths] of [
    ["zh", ZH_CORE_PATHS],
    ["en", EN_CORE_PATHS],
  ] as const) {
    test(`${locale} 版核心路由均返回可读页面`, async ({ page }) => {
      for (const path of paths) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBeLessThan(400);
        await expect(page.locator("html")).toHaveAttribute("lang", new RegExp(`^${locale}`));
        await expect(page.locator("h1").first()).toBeVisible();
        await expect(page.locator("main")).toBeVisible();
      }
    });
  }
});

test.describe("R13.24 搜索与书签闭环", () => {
  test("中文搜索命中课程，结果可跳转", async ({ page }) => {
    await page.goto("/zh/search");
    const searchbox = page.getByRole("searchbox");
    await searchbox.fill("市价单");

    const result = page.locator('a[href^="/zh/knowledge/getting-started/"]').first();
    await expect(result).toBeVisible();
    const href = await result.getAttribute("href");
    expect(href).toMatch(/^\/zh\/knowledge\/getting-started\//);
    await result.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator("article")).toBeVisible();
  });

  test("键盘可高亮结果并用回车打开", async ({ page }) => {
    await page.goto("/zh/search");
    const searchbox = page.getByRole("searchbox");
    await searchbox.fill("市价单");

    const firstResult = page.locator('a[data-search-result-index="0"]').first();
    await expect(firstResult).toBeVisible();
    const expected = await firstResult.getAttribute("href");
    expect(expected).toBeTruthy();

    // Esc 关闭联想，ArrowDown 才落到结果列表的高亮索引。
    await searchbox.press("Escape");
    await searchbox.press("ArrowDown");
    await expect(firstResult).toHaveClass(/border-accent/);

    await searchbox.press("Enter");
    const escaped = (expected ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await expect(page).toHaveURL(new RegExp(`${escaped}$`));
  });

  test("课程收藏写入本机并在收藏页回访", async ({ page }) => {
    await page.goto(LESSON_PATH);
    const bookmark = page.getByRole("button", { name: "收藏", exact: true }).first();
    await expect(bookmark).toBeVisible();
    await bookmark.click();

    await expect(page.getByRole("button", { name: "已收藏", exact: true }).first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const stored = await page.evaluate(() => localStorage.getItem("tb-bookmarks"));
    expect(stored).toContain("getting-started/first-trade");

    await page.goto("/zh/bookmarks");
    const savedLesson = page.locator(`a[href="${LESSON_PATH}"]`);
    await expect(savedLesson).toBeVisible();
    await savedLesson.click();
    await expect(page).toHaveURL(new RegExp(`${LESSON_PATH}$`));
  });
});

test.describe("R13.24 复习与统计本机闭环", () => {
  test("关闭 SRS 时可将错题标记掌握并移出错题本", async ({ page }) => {
    await seedStorage(page, {
      "tb-srs-mode": "off",
      "tb-wrong": JSON.stringify({
        "getting-started:0": {
          chapterNum: "getting-started",
          questionIdx: 0,
          picked: 1,
          at: Date.now(),
        },
      }),
    });

    await page.goto("/zh/review");
    await expect(page.getByText("入门基础 · 随堂测", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "看答案与解析", exact: true }).click();
    await page.getByRole("button", { name: "✓ 已掌握，移出错题本", exact: true }).click();

    await expect(page.getByText("错题本空空如也", { exact: true })).toBeVisible();
    const wrong = await page.evaluate(() => JSON.parse(localStorage.getItem("tb-wrong") ?? "{}"));
    expect(wrong["getting-started:0"]).toBeUndefined();
  });

  test("有本机学习数据时统计页不要求登录且标注本机来源", async ({ page }) => {
    const today = currentLocalDate();
    await seedStorage(page, {
      "tb-progress": JSON.stringify({ "getting-started": ["first-trade"] }),
      "tb-progress-completions": JSON.stringify({
        "getting-started:first-trade": {
          chapter: "getting-started",
          doc: "first-trade",
          at: Date.now(),
        },
      }),
      "tb-quiz-getting-started": JSON.stringify({ best: 2, done: true }),
      "tb-wrong": JSON.stringify({
        "getting-started:2": {
          chapterNum: "getting-started",
          questionIdx: 2,
          picked: 0,
          at: Date.now(),
        },
      }),
      "tb-replay-history": JSON.stringify([
        {
          at: Date.now(),
          symbol: "BTCUSDT",
          interval: "1h",
          total: 10,
          correct: 7,
          bestStreak: 4,
          durationSec: 120,
        },
      ]),
      "tb-study-time": JSON.stringify({
        [today]: { read: 300, quiz: 60, replay: 120 },
      }),
    });

    await page.goto("/zh/stats");
    await expect(page.getByRole("heading", { name: "学习总览", exact: true })).toBeVisible();
    await expect(page.getByLabel("本机数据")).toBeVisible();
    const overview = page.locator('section[aria-labelledby="learning-overview-title"]');
    await expect(overview.getByText("课程进度", { exact: true })).toBeVisible();
    await expect(overview.getByText("测验记录", { exact: true })).toBeVisible();
    await expect(overview.getByText("回放训练", { exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByText(/需要登录|登录后查看/)).toHaveCount(0);
  });
});

test.describe("R13.24 术语表与隐私导出", () => {
  test("术语表在中英文页面都显示双语条目", async ({ page }) => {
    await page.goto("/zh/glossary");
    const zhLong = page.locator("div").filter({ hasText: /^做多Long$/ }).first();
    await expect(zhLong).toBeVisible();
    await expect(zhLong).toContainText("做多");
    await expect(zhLong).toContainText("Long");

    await page.goto("/en/glossary");
    const enLong = page.locator("div").filter({ hasText: /^Long做多$/ }).first();
    await expect(enLong).toBeVisible();
    await expect(enLong).toContainText("Long");
    await expect(enLong).toContainText("做多");
  });

  test("未登录用户可下载完整本机 JSON 导出", async ({ page }) => {
    await seedStorage(page, {
      "tb-progress": JSON.stringify({ "getting-started": ["first-trade"] }),
    });
    await page.goto("/zh/privacy");
    await expect(page.getByTestId("privacy-data-export")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("privacy-export-button").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^trade-buty-export-\d{4}-\d{2}-\d{2}\.json$/);

    const path = await download.path();
    expect(path).not.toBeNull();
    const exported = JSON.parse(await readFile(path!, "utf8"));
    expect(exported.schemaVersion).toBe(1);
    expect(exported.localStorage["tb-progress"]).toContain("first-trade");
    expect(exported.progress.totalRead).toBe(1);
  });
});

test.describe("R13.24 图表与回放确定性交互", () => {
  test("行情图请求真实参数，切换周期后重新拉取", async ({ page }) => {
    const requests: string[] = [];
    await mockBinance(page, requests);
    await page.goto("/zh/chart");
    const chart = page.getByTestId("kline-chart");
    await expect(chart).toBeVisible();
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    await expect(chart.getByText("加载行情中…", { exact: true })).toHaveCount(0);
    expect(new URL(requests[0]).searchParams.get("symbol")).toBe("BTCUSDT");
    expect(new URL(requests[0]).searchParams.get("interval")).toBe("1h");

    const nextRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.hostname === "api.binance.com" && url.searchParams.get("interval") === "4h";
    });
    await page.getByRole("button", { name: "K 线周期 4h", exact: true }).click();
    const request = await nextRequest;
    expect(new URL(request.url()).searchParams.get("symbol")).toBe("BTCUSDT");
    await expect(chart.getByText("加载行情中…", { exact: true })).toHaveCount(0);
  });

  test("回放载入确定性历史窗口，切换品种与周期会重新请求", async ({ page }) => {
    const requests: string[] = [];
    await mockBinance(page, requests);
    await page.goto("/zh/replay");

    const step = page.getByRole("button", { name: "单步 →", exact: true });
    await expect(step).toBeEnabled();
    expect(requests.some((raw) => new URL(raw).searchParams.get("symbol") === "BTCUSDT")).toBe(true);

    const symbolSelect = page.getByRole("combobox", { name: "交易品种", exact: true });
    const intervalSelect = page.getByRole("combobox", { name: "K 线周期", exact: true });
    await expect(symbolSelect).toBeVisible();
    await expect(intervalSelect).toBeVisible();
    const symbolRequest = page.waitForRequest((request) =>
      new URL(request.url()).searchParams.get("symbol") === "ETHUSDT",
    );
    await symbolSelect.selectOption("ETHUSDT");
    await symbolRequest;
    await expect(step).toBeEnabled();

    const intervalRequest = page.waitForRequest((request) =>
      new URL(request.url()).searchParams.get("interval") === "15m",
    );
    await intervalSelect.selectOption("15m");
    await intervalRequest;
    await expect(step).toBeEnabled();

    const speed = page.getByRole("button", { name: "2x", exact: true });
    await speed.focus();
    await page.keyboard.press("Space");
    await expect(speed).toHaveAttribute("aria-pressed", "true");

    const difficulty = page.getByRole("button", { name: "挑战", exact: true });
    await difficulty.focus();
    await page.keyboard.press("Enter");
    await expect(difficulty).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "难度", exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "速度", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "跳到回放末尾", exact: true })).toBeVisible();
  });
});

test.describe("Q2.4 核心交互无障碍", () => {
  test("课程图片可用键盘打开灯箱并在关闭后归还焦点", async ({ page }) => {
    await page.goto("/zh/knowledge/spot/portfolio-rebalancing", { waitUntil: "networkidle" });
    const image = page.getByRole("button", { name: /不同风险偏好的加密组合饼图/ });
    await expect(image).toHaveAttribute("aria-haspopup", "dialog");
    await image.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "关闭大图", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "关闭大图", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(image).toBeFocused();
  });

  test("邮件和自定义行情输入具有稳定的可访问名称", async ({ page }) => {
    await page.goto("/zh/about");
    await expect(page.getByRole("textbox", { name: "订阅邮箱", exact: true })).toBeVisible();

    await page.goto("/zh/chart");
    await expect(page.getByRole("textbox", { name: "自定义交易对", exact: true })).toBeVisible();
  });

  test("键盘焦点在核心控件上可见", async ({ page }) => {
    await page.goto(LESSON_PATH, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "开始测验", exact: true }).click();
    await page.getByRole("button", { name: "开始测验", exact: true }).click();
    await expectVisibleFocusRing(
      page,
      page.getByRole("button", { name: /^A\./ }).first(),
    );

    await page.goto("/zh/replay", { waitUntil: "networkidle" });
    await expectVisibleFocusRing(
      page,
      page.getByRole("combobox", { name: "K 线周期", exact: true }),
    );

    await page.goto("/zh/chart", { waitUntil: "networkidle" });
    await expectVisibleFocusRing(
      page,
      page.getByRole("textbox", { name: "自定义交易对", exact: true }),
    );

    await page.goto("/zh/about", { waitUntil: "networkidle" });
    await expectVisibleFocusRing(
      page,
      page.getByRole("textbox", { name: "订阅邮箱", exact: true }),
    );
  });
});

test.describe("R13.24 完整随堂测", () => {
  test("三题全对后显示满分与历史最佳", async ({ page }) => {
    await page.goto(LESSON_PATH);

    await page.getByRole("button", { name: "开始测验", exact: true }).click();
    await page.getByRole("button", { name: "开始测验", exact: true }).click();

    const choices = ["A", "B", "B"] as const;
    for (let i = 0; i < choices.length; i++) {
      const choice = page.getByRole("button", { name: new RegExp(`^${choices[i]}\\.`) });
      await choice.focus();
      await page.keyboard.press(i === 1 ? "Space" : "Enter");
      const action = i === choices.length - 1 ? "完成" : "下一题 →";
      await page.getByRole("button", { name: action, exact: true }).click();
    }

    await expect(page.getByText(/全对！/).first()).toBeVisible();
    await expect(page.getByText("历史最佳 3/3", { exact: true })).toBeVisible();
    await expect(page.getByText("3/3 · 100%", { exact: true })).toBeVisible();
  });
});
