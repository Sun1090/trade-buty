import { test, expect, type Page } from "@playwright/test";

/**
 * 运行时健康门禁：每个关键路由在**生产构建**里水合后不得抛未捕获错误。
 *
 * 这一类缺陷此前没有任何门禁覆盖：单测跑 jsdom、E2E 断言 DOM 与文案，
 * 而「服务端 HTML 与水合首帧对不上」只在真浏览器的生产产物里出现——
 * React 会丢掉整棵服务端树重渲染（minified #418），静态页上表现为
 * 文案闪变与无谓的重渲染。2026-09-22 用一次性探针在 /zh、/en、/zh/ai、/en/ai
 * 上抓到四处（渲染期取随机的「每日心得」卡与 AI 首屏示例问题），修完后由本文件钉住。
 *
 * 口径：只判未捕获异常与真正的 console.error；网络噪声（外部行情轮询、
 * 资源 404）不参与判定，否则门禁会随 CI 出口网络抖动。
 */

const ROUTES = [
  "/zh",
  "/en",
  "/zh/ai",
  "/en/ai",
  "/zh/path",
  "/zh/stats",
  "/en/stats",
  "/zh/review",
  "/zh/replay",
  "/en/replay",
  "/zh/chart",
  "/zh/search",
  "/zh/glossary",
  "/zh/calendar",
  "/en/calendar",
  "/zh/bookmarks",
  "/zh/auth",
  "/zh/privacy",
  "/zh/knowledge/getting-started/first-trade",
  "/en/knowledge/getting-started/first-trade",
  "/zh/changelog",
  // 分享落地页收到畸形载荷时必须降级而不是抛错
  "/share/streak/Zm9vYmFy",
] as const;

function localDate(offsetDays: number): string {
  const now = new Date();
  now.setDate(now.getDate() - offsetDays);
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/** 让只读本地台账的组件真正渲染出内容：空台账下它们整块短路，探不到水合问题 */
async function seedStorage(page: Page) {
  const progress = {
    "getting-started": ["first-trade", "market-overview"],
    spot: ["spot-orders"],
  };
  const studyTime: Record<string, { read: number; quiz: number; replay: number }> = {};
  for (let i = 0; i < 12; i++) studyTime[localDate(i)] = { read: 900, quiz: 120, replay: 60 };
  const wrong: Record<string, unknown> = {};
  for (let q = 0; q < 3; q++) {
    wrong[`getting-started:${q}`] = {
      chapterNum: "getting-started",
      questionIdx: q,
      picked: 1,
      at: Date.now() - (q + 1) * 86_400_000,
      srsStage: q,
      srsDue: localDate(1 - q),
    };
  }
  const values: Record<string, string> = {
    "tb-migrated-v2": "1",
    "tb-progress": JSON.stringify(progress),
    "tb-study-time": JSON.stringify(studyTime),
    "tb-activity": JSON.stringify(Array.from({ length: 12 }, (_, i) => localDate(i))),
    "tb-streak": JSON.stringify({
      lastDate: localDate(0),
      current: 12,
      longest: 20,
      lastTs: Date.now(),
    }),
    "tb-wrong": JSON.stringify(wrong),
    "tb-replay-history": JSON.stringify([
      { symbol: "BTCUSDT", interval: "1h", correct: 4, total: 5, at: Date.now(), durationMs: 90_000 },
    ]),
    "tb-replay-best": JSON.stringify({ symbol: "BTCUSDT", interval: "1h", bestStreak: 3 }),
    "tb-bookmarks": JSON.stringify([
      { url: "/zh/knowledge/getting-started/first-trade", title: "第一笔交易", at: Date.now() },
    ]),
  };
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, values);
}

/** 外部行情与网络抖动不算缺陷 */
const NETWORK_NOISE =
  /Failed to load resource|net::ERR_|ERR_CONNECTION|ERR_TIMED_OUT|favicon|sw\.js|manifest\.webmanifest|ChunkLoadError|Loading chunk/i;

/**
 * 行情域名是外部依赖：CI 出口 IP 被 Binance 以 451 拒答，浏览器会把它写成 console.error。
 * 实时行情那条走 WebSocket，`page.route` 拦不到，所以只能按域名豁免——
 * 站内没有第一方 WebSocket，也没有对 binance 之外的跨源请求，这条豁免不会盖住自己的缺陷。
 */
const EXTERNAL_VENDOR_NOISE = /binance\.com/i;

/**
 * 行情来自 api.binance.com：CI 出口拿不到它的 CORS 头，浏览器会把这件事记成
 * console.error——那是门禁噪声，不是站内缺陷。一律挡掉跨源请求：
 * 每条路由只暴露自己的运行时问题，而失败分支同样是真代码路径。
 */
async function blockCrossOrigin(page: Page) {
  await page.route(
    (url) => url.hostname !== "localhost" && url.hostname !== "127.0.0.1",
    (r) => r.abort("blockedbyclient"),
  );
}

for (const route of ROUTES) {
  test(`水合后无未捕获错误：${route}`, async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => {
      problems.push(`pageerror: ${error.message.split("\n")[0]}`);
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (NETWORK_NOISE.test(text) || EXTERNAL_VENDOR_NOISE.test(text)) return;
      problems.push(`console.error: ${text.split("\n")[0]}`);
    });

    await blockCrossOrigin(page);
    await seedStorage(page);
    await page.goto(route, { waitUntil: "domcontentloaded" });
    // 给挂载后的 effects 与一次性重渲染留出时间：水合错误在这些回调里才会浮出来
    await page.waitForTimeout(1_500);

    expect(problems).toEqual([]);
  });
}
