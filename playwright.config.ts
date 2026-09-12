import { defineConfig, devices } from "@playwright/test";

/**
 * R7.7/R7.8：E2E 配置。
 * - smoke（CI 每次推送）：关键路径冒烟，需先 build（webServer npm start）
 * - visual（本地/人工流程）：`npm run e2e:visual`，截图基线 diff 人工复核
 */
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
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3000" },
    },
  ],
  webServer: {
    command: "npm start",
    url: "http://localhost:3000/zh",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
