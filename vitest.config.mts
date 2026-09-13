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
      // 覆盖度回归门禁：以 2026-09-13 实测基线（语句 86.45% / 分支 79.31% /
      // 函数 84.84% / 行 89%）为参照，向下留出约 2 个百分点的裕量吸收
      // 本地（Node 26）与 CI（Node 22）的 V8 计数差异。跌破任一项即 exit 1；
      // 新增代码应带测试，不要为了过门禁而下调阈值。
      thresholds: {
        statements: 84,
        branches: 77,
        functions: 83,
        lines: 87,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
