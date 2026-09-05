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
