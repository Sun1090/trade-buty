import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function findRouteFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findRouteFiles(fullPath);
    return entry.name === "route.ts" ? [fullPath] : [];
  });
}

describe("AI route runtime contract", () => {
  it("does not opt routes into the deprecated Edge Runtime", () => {
    const root = path.resolve(process.cwd(), "src/app/api/ai");
    const routes = findRouteFiles(root);
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      expect(fs.readFileSync(route, "utf8"), route).not.toMatch(
        /export\s+const\s+runtime\s*=\s*["']edge["']/,
      );
    }
  });
});
