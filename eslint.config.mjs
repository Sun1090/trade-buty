import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vitest 覆盖率产物（lcov/html/json），由 npm run test:coverage 生成
    "coverage/**",
    // 知识库 submodule：内容只读，不参与 lint
    "content/**",
  ]),
]);

export default eslintConfig;
