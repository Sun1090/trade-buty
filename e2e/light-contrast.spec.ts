import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const AXE_PATH = resolve("node_modules/axe-core/axe.min.js");

type ContrastViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
};

type AxeWindow = Window & {
  axe: {
    run: (options: { runOnly: string[] }) => Promise<{ violations: ContrastViolation[] }>;
  };
};

test.describe("亮色主题颜色对比度", () => {
  test.use({ colorScheme: "light" });

  for (const path of [
    "/zh",
    "/zh/knowledge/getting-started/market-overview",
    "/zh/chart",
  ]) {
    test(`${path} 无颜色对比度违规`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("tb-theme", "light");
      });
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});
      await page.addScriptTag({ path: AXE_PATH });

      const violations = await page.evaluate(async () => {
        const results = await (window as unknown as AxeWindow).axe.run({
          runOnly: ["color-contrast"],
        });
        return results.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            failureSummary: node.failureSummary,
          })),
        }));
      });

      expect(violations).toEqual([]);
    });
  }
});
