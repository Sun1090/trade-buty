import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { config, LOCALE_FREE_PREFIXES, proxy } from "./proxy";

function request(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie !== undefined) headers.set("cookie", `tb-lang=${cookie}`);
  return new NextRequest(`http://localhost${path}`, { headers });
}

/** 返回重定向目标（未重定向时返回 null）。 */
function redirectLocation(res: Response | undefined): string | null {
  if (!res) return null;
  expect(res).toBeInstanceOf(NextResponse);
  expect(res.status).toBe(307);
  return res.headers.get("location");
}

/**
 * `config.matcher` 是本仓库唯一的路径过滤声明，Next 用 path-to-regexp 解释它。
 * 该 pattern 形如 `/` + 一个自定义正则分组，因此等价于把分组内容作为锚定正则整体匹配。
 */
function matchesMatcher(pathname: string): boolean {
  const source = config.matcher[0];
  expect(source.startsWith("/")).toBe(true);
  return new RegExp(`^${source}$`).test(pathname);
}

/** 递归列出 `public/` 下的全部文件（相对仓库根、POSIX 分隔符）。 */
function listPublicFiles(dir = "public"): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = path.posix.join(dir.split(path.sep).join("/"), entry.name);
      return entry.isDirectory() ? listPublicFiles(path.join(dir, entry.name)) : [relative];
    })
    .sort();
}

describe("proxy 语言前缀重定向", () => {
  it("/zh 与 /en 开头（含子路径）时不重定向", () => {
    expect(proxy(request("/zh"))).toBeUndefined();
    expect(proxy(request("/zh/knowledge/candlestick"))).toBeUndefined();
    expect(proxy(request("/en"))).toBeUndefined();
    expect(proxy(request("/en/stats", "zh"))).toBeUndefined();
  });

  it("根路径无 cookie 时落到默认 en", () => {
    expect(redirectLocation(proxy(request("/")))).toBe("http://localhost/en");
  });

  it("根路径按 tb-lang cookie 选择语言", () => {
    expect(redirectLocation(proxy(request("/", "zh")))).toBe("http://localhost/zh");
    expect(redirectLocation(proxy(request("/", "en")))).toBe("http://localhost/en");
  });

  it("无语言前缀的深路径按 cookie 补前缀", () => {
    expect(redirectLocation(proxy(request("/knowledge/candlestick", "zh")))).toBe(
      "http://localhost/zh/knowledge/candlestick",
    );
    expect(redirectLocation(proxy(request("/knowledge/candlestick")))).toBe(
      "http://localhost/en/knowledge/candlestick",
    );
  });

  it("非法 cookie 值一律回退默认 en", () => {
    for (const cookie of ["fr", "zh-CN", "ZH", "zh-Hans", "en-US", "", "  "]) {
      expect(redirectLocation(proxy(request("/", cookie)))).toBe("http://localhost/en");
    }
  });

  it("重复 tb-lang cookie 时不拼接，按 Next 解析取最后一个值", () => {
    expect(redirectLocation(proxy(request("/", "zh;tb-lang=en")))).toBe("http://localhost/en");
    expect(redirectLocation(proxy(request("/", "fr;tb-lang=zh")))).toBe("http://localhost/zh");
  });

  it("cookie 属性（path/max-age）被忽略，只取 tb-lang 值", () => {
    expect(redirectLocation(proxy(request("/", "zh; path=/; max-age=31536000; samesite=lax")))).toBe(
      "http://localhost/zh",
    );
  });

  it("重定向保留 query 与 hash 之外的其余 URL 组成", () => {
    expect(redirectLocation(proxy(request("/courses?tab=quiz&page=2", "zh")))).toBe(
      "http://localhost/zh/courses?tab=quiz&page=2",
    );
  });

  it("前缀匹配按整段判定，/zhx 不是语言前缀", () => {
    expect(redirectLocation(proxy(request("/zhx", "zh")))).toBe("http://localhost/zh/zhx");
  });

  it("重定向使用 307，保持方法与请求体语义", () => {
    expect(redirectLocation(proxy(request("/replay/trend")))).toBe(
      "http://localhost/en/replay/trend",
    );
  });

  /**
   * R13.6 回归：分享链接由 `origin + /share/...` 拼成（载荷里自带 locale），
   * 一旦被补上 `/en` 前缀就会落到不存在的 `/[locale]/share/...`，分享链接全站 404。
   */
  it("根级无语言前缀的真实页面（/share/...）不重定向", () => {
    for (const prefix of LOCALE_FREE_PREFIXES) {
      expect(proxy(request(`/${prefix}`)), `/${prefix}`).toBeUndefined();
      expect(proxy(request(`/${prefix}/quiz/v1abc`)), `/${prefix}/quiz`).toBeUndefined();
      expect(proxy(request(`/${prefix}/quiz/v1abc`, "zh")), `/${prefix}/quiz + zh`).toBeUndefined();
    }
  });
});

describe("proxy matcher", () => {
  it("放行需要按语言重定向的页面路径", () => {
    for (const path of ["/", "/knowledge/x", "/en/knowledge/x", "/stats", "/zh"]) {
      expect(matchesMatcher(path)).toBe(true);
    }
  });

  it("放行真实静态表面——public 文件与 app 根级 file-route", () => {
    for (const path of [
      "/_next/static/chunk.js",
      "/_next/image",
      "/api/error-reports",
      "/favicon.ico",
      "/icon",
      "/manifest.webmanifest",
      "/robots.txt",
      "/sitemap.xml",
      "/search-index.json",
      "/sw.js",
      "/offline.html",
      "/knowledge-assets/zh/getting-started/kline-anatomy.svg",
    ]) {
      expect(matchesMatcher(path), path).toBe(false);
    }
  });

  it("放行根级无语言前缀的真实页面前缀（/share/）", () => {
    for (const prefix of LOCALE_FREE_PREFIXES) {
      expect(matchesMatcher(`/${prefix}/quiz/v1abc`), prefix).toBe(false);
    }
  });

  /**
   * 软 404 回归：以前 `.*\.\w+$` 会把不存在的类文件路径也放行，
   * 它们落到 `/[locale]` 被当成非法 locale，渲染出 HTTP 200 的首页外壳。
   * 现在这里不再按扩展名通配放行——由代理补前缀后交路由层处理，
   * 真实路由（如 `/[locale]/opengraph-image.png`）照常 200，不存在的路径真实 404。
   */
  it("不再按扩展名通配放行（补前缀后由路由层定状态码）", () => {
    for (const path of [
      "/foo.png",
      "/sitemap.json",
      "/icon.svg",
      "/apple-icon",
      "/opengraph-image.png",
      "/robots.txt.bak",
      "/knowledge-assets",
      "/sw.jsx",
      "/api",
      "/_next-ish",
    ]) {
      expect(matchesMatcher(path), path).toBe(true);
    }
  });

  it("精确匹配根级 file-route，同前缀路径不被误放行", () => {
    for (const path of ["/iconography", "/icons", "/favicon.icon", "/search-index.json5"]) {
      expect(matchesMatcher(path), path).toBe(true);
    }
  });

  /**
   * 守卫：`public/` 下每个文件都必须被 matcher 放行，否则新增静态文件会静默 404。
   * 注意 `public/knowledge-assets/` 与 `public/search-index.json` 是 prebuild 生成的，
   * 全新检出时并不存在；枚举结果为空也要挡住（见下面的长度断言）。
   */
  it("public/ 下的每个文件都被 matcher 放行", () => {
    const files = listPublicFiles();
    expect(files.length, "public/ 下没有文件，守卫失去意义").toBeGreaterThan(0);
    expect(files).toContain("public/offline.html");
    for (const file of files) {
      const pathname = `/${file.replace(/^public\//, "")}`;
      expect(matchesMatcher(pathname), `${pathname} 会被语言代理重定向`).toBe(false);
    }
  });
});
