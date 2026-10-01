import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    environment: "node",
    // 组件测试文件用 // @vitest-environment jsdom 注释切换
    setupFiles: ["src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      // 覆盖度回归门禁：2026-09-30 在 CI 同款 Node 22 与本地 Node 26 上实测读数完全一致
      // （语句 95.20% / 分支 90.94% / 函数 95.13% / 行 97.13%），阈值收到实测下约 1–2 个
      // 百分点——覆盖计数只随代码变动、不随机器漂移，这个裕量给「新代码尚未带测试」的
      // 合并留空间，同时让成规模的无测试代码当场红。跌破任一项即 exit 1；
      // 新增代码应带测试，不要为了过门禁而下调阈值（R14.12：只许上调）。
      thresholds: {
        statements: 94,
        branches: 89,
        functions: 94,
        lines: 96,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
