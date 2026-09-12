import { readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  encodeQuiz,
  encodeReplay,
  encodeStreak,
} from "../src/lib/share-decode";

/**
 * 根级静态表面 + 软 404 的 HTTP 契约（proxy matcher 回归）。
 *
 * 背景：`src/proxy.ts` 的 matcher 以前用 `.*\.\w+$` 兜住所有带扩展名的路径，
 * 外加写得很宽的无扩展名白名单。副作用是**不存在**的根级路径（`/foo.png`、
 * `/apple-icon`、`/knowledge-assets`、`/sitemap.json`）会绕过代理直接落进根级动态段
 * `/[locale]`，被当成非法 locale 渲染成 HTTP 200 的首页外壳 —— 一批软 404。
 *
 * 反方向也坏过：`/share/...` 是根级真实页面（locale 编码在载荷里），却被代理补成
 * `/en/share/...` → 404，分享链接全站失效。这里同时钉住两侧。
 *
 * 与 `metadata-routes.spec.ts` 的分工：那个 spec 从构建产物枚举**根级单段**路由并
 * 要求直连 200；本 spec 覆盖「不存在的根级路径必须 404」以及多段的 `/share/*`。
 */

const LOCALE_PREFIXES = ["/zh/", "/en/"];

/** 根级单段、确定不存在的路径：修复前会渲染成 200 首页外壳。 */
const MISSING_ROOT_PATHS = [
  "/apple-icon",
  "/foo.png",
  "/knowledge-assets",
  "/sitemap.json",
  "/icon.svg",
  "/robots.txt.bak",
];

/** 根级静态表面：必须直连 200，不能被补上语言前缀。 */
const STATIC_SURFACES = [
  "/favicon.ico",
  "/icon",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/search-index.json",
  "/sw.js",
  "/offline.html",
];

function walkFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(absolute, base);
    const relative = path.relative(base, absolute).split(path.sep).join("/");
    return [relative];
  });
}

test.describe("根级不存在的路径是真 404", () => {
  for (const route of MISSING_ROOT_PATHS) {
    test(`${route} 最终 404`, async ({ request }) => {
      const first = await request.get(route, { maxRedirects: 0 });

      if (first.status() === 307) {
        // 允许代理补语言前缀，但落点必须落在 /{locale}/ 下，由路由层定状态码
        const location = first.headers()["location"];
        expect(location, `${route} 返回 307 时必须带 Location`).toBeTruthy();
        const target = new URL(location!, "http://localhost");
        expect(
          LOCALE_PREFIXES.some((prefix) => target.pathname.startsWith(prefix)),
          `${route} → ${target.pathname}`
        ).toBe(true);
      } else {
        expect(first.status(), `${route} 不应以 2xx 冒充真实页面`).toBe(404);
      }

      const final = await request.get(route, { maxRedirects: 10 });
      expect(final.status(), `${route} 最终状态码`).toBe(404);
    });
  }
});

test.describe("根级静态表面直连 200", () => {
  for (const route of STATIC_SURFACES) {
    test(`${route} 直连 200`, async ({ request }) => {
      const response = await request.get(route, { maxRedirects: 0 });
      expect(
        response.status(),
        `${route} 被改写成 ${response.headers()["location"] ?? "非 200"}`
      ).toBe(200);
    });
  }

  test("知识库资产目录下的真实文件直连 200", async ({ request }) => {
    const root = path.join(process.cwd(), "public", "knowledge-assets");
    const asset = walkFiles(root).find((file) => file.endsWith(".svg"));
    expect(
      asset,
      "public/knowledge-assets/ 下应有构建生成的资产，请先 npm run build"
    ).toBeTruthy();

    const response = await request.get(`/knowledge-assets/${asset}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("svg");
  });
});

test.describe("分享落地页保持无语言前缀", () => {
  const cases = [
    [
      "quiz",
      encodeQuiz({
        chapterTitle: "入门基础",
        score: 8,
        total: 10,
        percent: 80,
        locale: "zh",
      }),
    ],
    [
      "replay",
      encodeReplay({
        symbol: "BTCUSDT",
        interval: "1h",
        correct: 7,
        total: 10,
        accuracyBps: 7000,
        bestStreak: 5,
        currentStreak: 3,
        locale: "zh",
      }),
    ],
    ["streak", encodeStreak({ currentStreak: 12, longestStreak: 30, locale: "zh" })],
  ] as const;

  for (const [kind, segment] of cases) {
    test(`/share/${kind}/... 直连 200`, async ({ request }) => {
      const response = await request.get(
        `/share/${kind}/${encodeURIComponent(segment)}`,
        { maxRedirects: 0 }
      );

      expect(
        response.headers()["location"],
        `/share/${kind}/... 不应被补语言前缀`
      ).toBeUndefined();
      expect(response.status()).toBe(200);

      const html = await response.text();
      // 载荷里的 locale 决定站内 CTA 语言；这里必须是中文入口而不是被改写成 /en
      expect(html).toContain("/zh/path");
    });
  }
});

test.describe("软 404 语义未被误伤", () => {
  test("未知知识库 slug 仍是 200 + noindex + 推荐 CTA", async ({ request }) => {
    for (const route of [
      "/zh/knowledge/nonexistent-chapter",
      "/zh/knowledge/getting-started/nonexistent-lesson",
    ]) {
      const response = await request.get(route, { maxRedirects: 0 });
      expect(response.status(), `${route} 应保持软 404 的 200`).toBe(200);
      const html = await response.text();
      expect(html, route).toContain("noindex");
      expect(html, route).toMatch(/不存在|找不到|not found/i);
    }
  });
});
