import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * 根级路由守卫（PR #33 回归）。
 *
 * `src/proxy.ts` 会给所有没有语言前缀的路径补 `/{locale}`。Next 在根级暴露的
 * 静态 / 元数据路由恰好是「无扩展名」的（`/icon`、`/apple-icon`、
 * `/opengraph-image`…），一旦被代理重定向到 `/en/icon` 就会退化成 404 HTML。
 * PR #33 的 `/icon` 正是这么坏的：manifest 的两枚图标与页面自动生成的
 * `<link rel="icon">` 都直接引用它。
 *
 * 这里不硬编码清单，而是从构建产物 `.next/app-path-routes-manifest.json`
 * 枚举全部根级单段路由，逐个要求「本站直接 200」。将来新增 `apple-icon` /
 * `twitter-image` 之类的根级路由会被自动纳入，无需再改测试。
 */

const manifestPath = path.join(
  process.cwd(),
  ".next",
  "app-path-routes-manifest.json"
);

function rootRoutes(): string[] {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `读取 ${manifestPath} 失败，请先 npm run build：${(error as Error).message}`
    );
  }
  const routes = new Set<string>();
  for (const value of Object.values(raw)) {
    if (typeof value !== "string" || !value.startsWith("/")) continue;
    const segments = value.slice(1).split("/");
    // 只取根级单段路由；跳过 Next 内部产物（`_not-found` / `_global-error`）
    // 与动态模板（清单里会出现字面量 `/[locale]`）。
    if (
      segments.length !== 1 ||
      segments[0].startsWith("_") ||
      segments[0].includes("[")
    ) {
      continue;
    }
    routes.add(value);
  }
  return [...routes].sort();
}

test.describe("根级路由不被语言代理重定向", () => {
  const routes = rootRoutes();

  // 枚举出空集时下面的用例会全部消失、测试静默变绿，所以先钉住已知路由。
  test("构建产物里存在已知的根级元数据路由", () => {
    expect(routes).toEqual(
      expect.arrayContaining([
        "/favicon.ico",
        "/icon",
        "/manifest.webmanifest",
        "/robots.txt",
        "/sitemap.xml",
      ])
    );
  });

  for (const route of routes) {
    test(`${route} 由本站直接返回 200`, async ({ request }) => {
      const response = await request.get(route, { maxRedirects: 0 });

      const location = response.headers()["location"];
      if (location) {
        const target = new URL(location, "http://localhost").pathname;
        for (const locale of ["zh", "en"]) {
          expect(target, `${route} 被语言代理重定向到 ${target}`).not.toBe(
            `/${locale}${route}`
          );
        }
      }

      expect(response.status(), `${route} 应直接返回 200`).toBe(200);
    });
  }
});
