import { test, expect, type Page } from "@playwright/test";

/**
 * R16.332：分享链接在 IM / 短信里被截断是**常态**，不是理论风险。
 *
 * 病灶：`resolveShareLanding` 把「kind 不认识」和「kind 认识但载荷解不开」压成同一个
 * null，页面于是统一 `notFound()` → 用户看到的是整站通用「Page not found」。
 * 而作者其实为这种情况写过话：字典里 `share.invalidBody`（中英齐全，
 * 「链接无效——分享链接已损坏或版本不匹配」）以及 `ShareCardPreview.summarizeText`
 * 里三处 invalid 分支——**全部不可达**，因为路由在它们之前就降级走了。
 *
 * 判据分两侧，缺一侧都不算修好：
 * ① kind 合法 + 载荷解不开 → 说「链接无效」，且**不许**出现通用 not-found 文案；
 * ② kind 本身不认识 → 仍然是整站 not-found（真·错路由不许被伪装成「链接坏了」）。
 *
 * 读法（本轮付过三次学费才写对）：`/share/*` 是动态路由，根级 `loading.tsx` 的骨架会
 * 先流出来，`domcontentloaded` 那一刻 `document.querySelector("h1")` 是 **null**、
 * `body.innerText` 是空串——照这个时刻断言会把「仪器读早了」当成「页面有缺陷」。
 * 所以一律先等 `h1` 挂上再读，且用 `expect(...).toContainText`（自带重试）而不是取一次快照。
 *
 * 元标签按 R16.331 的教训现读：这类页面上 `meta[name=robots]` **可能不止一个**，
 * 用 locator 单点读会被 strict-mode violation 打成假读数，所以这里数个数。
 */

/** 载荷形状：`v1|<base64url(JSON)>`；下面三条都是「kind 合法但解不开」 */
const BROKEN_PAYLOAD_PATHS = [
  "/share/streak/Zm9vYmFy", // base64("foobar")：不是本编码器的产物
  "/share/quiz/v1%7C", // 版本前缀在、载荷空
  "/share/replay/v1%7CWm9vYmFy", // 能 base64 解开但不是 replay 形状
];

async function blockCrossOrigin(page: Page) {
  await page.route(
    (url) => url.hostname !== "localhost" && url.hostname !== "127.0.0.1",
    (r) => r.abort("blockedbyclient"),
  );
}

/** 等流式骨架让位给真内容：`h1` 挂上才算这一页渲染完成 */
async function gotoRendered(page: Page, route: string) {
  await blockCrossOrigin(page);
  const res = await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toBeAttached({ timeout: 10_000 });
  return res!;
}

function readRobots(html: string): string[] {
  return [...html.matchAll(/<meta[^>]*name="robots"[^>]*content="([^"]*)"/g)].map((m) => m[1]);
}

for (const route of BROKEN_PAYLOAD_PATHS) {
  test(`载荷坏了：说「链接无效」而不是通用 404 —— ${route}`, async ({ page }) => {
    const res = await gotoRendered(page, route);
    expect(res.status()).toBeLessThan(500);

    await expect(page.locator("body")).toContainText(/链接无效|Invalid link/);
    // 通用 not-found 的标题与 tagline 不许出现在这一页上
    await expect(page.locator("body")).not.toContainText(/Page not found|市场永远都在/);
    // 载荷解不开就**不渲染卡片预览**：一个永远画不出来的 canvas 配一颗禁用按钮，
    // 只会把页面停在「正在生成预览…」这个假状态上。所以这里断言的是「不存在」，
    // 而不是「存在但禁用」——我第一版把形状写错了，红在按钮找不到。
    await expect(page.getByTestId(/^share-download-btn-/)).toHaveCount(0);
    await expect(page.getByTestId(/^share-canvas-/)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/正在生成预览|Generating preview/);
    // 但必须留下出口与风险提示：错误页不许把人关在原地
    await expect(page.getByTestId("share-invalid-cta")).toBeVisible();
    await expect(page.locator("body")).toContainText(/风险提示|Risk notice|不构成投资/i);
  });
}

test("kind 本身不认识：仍是整站 not-found，不许被伪装成「链接坏了」", async ({ page }) => {
  const res = await gotoRendered(page, "/share/nonsense-kind/cGF5bG9hZA");
  expect(res.status()).toBeLessThan(500);
  await expect(page.locator("body")).toContainText(/Page not found|页面不存在/);
  await expect(page.locator("body")).not.toContainText(/链接无效|Invalid link/);
});

test("坏载荷与未知 kind 两类页都自报 noindex（按个数现读，不被 strict-mode 骗成 null）", async ({ request }) => {
  for (const route of [...BROKEN_PAYLOAD_PATHS, "/share/nonsense-kind/cGF5bG9hZA"]) {
    const res = await request.get(route);
    expect(res.status()).toBeLessThan(500);
    const robots = readRobots(await res.text());
    expect(
      robots.length,
      `${route} 上现读到 ${robots.length} 个 robots meta，一个都没有就是可被索引`,
    ).toBeGreaterThan(0);
    expect(
      robots.some((r) => /noindex/i.test(r)),
      `${route} 的 robots 集合里没有 noindex：${JSON.stringify(robots)}`,
    ).toBe(true);
  }
});
