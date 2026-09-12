import { expect, test, type Page } from "@playwright/test";

/**
 * R13.13：PWA 离线兜底的浏览器级验证。
 *
 * 策略边界（docs/caching.md §5）：Service Worker 只预缓存静态离线引导页，
 * 页面 HTML / API / search-index / knowledge-assets 一律走网络，所以离线时
 * 课程页会退化为引导页，而不是展示可能过期的内容。
 */

async function waitForServiceWorkerControl(page: Page) {
  await page.waitForFunction(
    async () => {
      if (!("serviceWorker" in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return Boolean(registration?.active) && Boolean(navigator.serviceWorker.controller);
    },
    undefined,
    { timeout: 30_000 }
  );
}

async function emitInstallPrompt(page: Page) {
  await page.evaluate(() => {
    const runtime = window as Window & { __installPromptCalls?: number };
    runtime.__installPromptCalls = 0;
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: {
        value: async () => {
          runtime.__installPromptCalls = (runtime.__installPromptCalls ?? 0) + 1;
        },
      },
      userChoice: {
        value: Promise.resolve({ outcome: "accepted", platform: "web" }),
      },
    });
    window.dispatchEvent(event);
  });
}

test.describe("PWA 离线兜底", () => {
  test("manifest / sw / offline 静态产物带正确响应契约", async ({ request }) => {
    const manifestResponse = await request.get("/manifest.webmanifest");
    expect(manifestResponse.status()).toBe(200);
    const manifest = await manifestResponse.json();
    expect(manifest.id).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.start_url).toBe("/zh");
    expect(manifest.display).toBe("standalone");

    const swResponse = await request.get("/sw.js");
    expect(swResponse.status()).toBe(200);
    expect(swResponse.headers()["cache-control"]).toBe("no-cache");
    expect(await swResponse.text()).toContain("trade-buty-offline");

    const offlineResponse = await request.get("/offline.html");
    expect(offlineResponse.status()).toBe(200);
    expect(offlineResponse.headers()["cache-control"]).toBe(
      "public, max-age=0, must-revalidate"
    );
    expect(offlineResponse.headers()["content-type"]).toContain("text/html");
  });

  test("网络不可达时导航落离线页，点击重试恢复真实页面", async ({
    page,
    context,
  }) => {
    await page.goto("/zh");
    await expect(page).toHaveTitle(/Trade Buty/);
    await waitForServiceWorkerControl(page);

    // 先唤醒已安装的 worker，再启用 CDP 离线模式。若 worker 已空闲，
    // Chromium 的离线模拟可能让 SW 启动请求也直接失败，页面就绕过兜底页。
    await page.evaluate(() => {
      navigator.serviceWorker.controller?.postMessage({ type: "keepalive" });
    });
    await context.setOffline(true);

    // 必须用页面内导航，不能 page.goto：CDP Page.navigate 可能在 SW
    // 接管前返回 ERR_INTERNET_DISCONNECTED，测不到应用层离线兜底。
    await page.evaluate(() => {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- E2E 必须触发真实浏览器导航，不能走 Next router
      window.location.href = "/zh/path";
    });

    await expect(page).toHaveURL(/\/zh\/path$/);
    await expect(
      page.getByRole("heading", { name: /你现在处于离线状态/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /重新连接/ })
    ).toBeVisible();

    // 网络恢复后，离线页的重试按钮应重新加载真实课程页。
    await context.setOffline(false);
    await page.getByRole("button", { name: /重新连接/ }).click();
    await expect(page.locator("a[href*='/knowledge/']").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("离线时不缓存课程 HTML / 内容产物（只兜底导航）", async ({ page }) => {
    await page.goto("/zh");
    await waitForServiceWorkerControl(page);

    const cachedUrls = () =>
      page.evaluate(async () => {
        const names = await caches.keys();
        const urls: string[] = [];
        for (const name of names) {
          const cache = await caches.open(name);
          for (const request of await cache.keys()) urls.push(request.url);
        }
        return urls;
      });

    // 安装期预缓存是异步的：轮询等待离线页落盘，同时保证内容产物始终不落盘。
    await expect
      .poll(
        async () => (await cachedUrls()).some((url) => url.endsWith("/offline.html")),
        { timeout: 15_000 }
      )
      .toBe(true);
    expect(
      (await cachedUrls()).some(
        (url) =>
          url.includes("/knowledge/") ||
          url.includes("/search-index.json") ||
          url.includes("/knowledge-assets/")
      )
    ).toBe(false);
  });
});

test.describe("PWA 安装提示（R13.14）", () => {
  test("浏览器提供安装能力时显示，点击后调用原生 prompt 且不再展示", async ({
    page,
  }) => {
    await page.goto("/zh");
    await expect(page.locator("header")).toBeVisible();
    await emitInstallPrompt(page);

    const prompt = page.getByTestId("install-prompt");
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("不会自动安装");

    await prompt.getByRole("button", { name: "安装" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { __installPromptCalls?: number })
              .__installPromptCalls ?? 0
        )
      )
      .toBe(1);
    await expect(prompt).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("tb-install-prompt-dismissed"))
      )
      .toBe("1");
  });

  test("选择暂不后写入本地状态，刷新并再次收到事件也不再展示", async ({
    page,
  }) => {
    await page.goto("/zh");
    await expect(page.locator("header")).toBeVisible();
    await emitInstallPrompt(page);

    await page.getByTestId("install-prompt").getByRole("button", { name: "暂不" }).click();
    await expect(page.getByTestId("install-prompt")).toBeHidden();

    await page.reload();
    await emitInstallPrompt(page);
    await expect(page.getByTestId("install-prompt")).toBeHidden();
  });

  test("standalone 模式即使收到事件也保持静默", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", {
        configurable: true,
        value: true,
      });
    });
    await page.goto("/zh");
    await expect(page.locator("header")).toBeVisible();
    await emitInstallPrompt(page);
    await expect(page.getByTestId("install-prompt")).toBeHidden();
  });

  test("不支持安装的浏览器没有事件时不渲染任何提示", async ({ page }) => {
    await page.goto("/zh");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByTestId("install-prompt")).toBeHidden();
  });
});
