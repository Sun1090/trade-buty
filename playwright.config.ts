import { defineConfig, devices } from "@playwright/test";

/**
 * R7.7/R7.8：E2E 配置。
 * - smoke（CI 每次推送）：关键路径冒烟，需先 build（webServer npm start）
 * - visual（本地/人工流程）：`npm run e2e:visual`，截图基线 diff 人工复核
 *
 * 端口刻意用 3100（偏离 next dev 的 3000）：
 * 之前本地默认复用 3000 上已有的服务，若那个服务是旧构建（`.next` 被新构建
 * 覆盖后仍驻留），整套 E2E 会对着陈旧产物跑出成片假失败/假通过。
 * 现在默认每次自起独立服务；确实想复用已在跑的 3100 服务时用 PW_REUSE_SERVER=1。
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  // Chromium 的离线模拟会停掉空闲 Service Worker；多个 worker 并发运行
  // 同一来源的 SW 生命周期测试时，导航会偶发绕过 worker 直接进入错误页。
  // E2E 套件本身很小，串行执行换取稳定、真实的离线路径验证。
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], baseURL: BASE_URL },
    },
  ],
  webServer: {
    command: `npm start -- -p ${PORT}`,
    url: `${BASE_URL}/zh`,
    reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
    timeout: 120_000,
  },
});
