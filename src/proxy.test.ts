import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { config, proxy } from "./proxy";

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
    expect(redirectLocation(proxy(request("/share/lesson/abc")))).toBe(
      "http://localhost/en/share/lesson/abc",
    );
  });
});

describe("proxy matcher", () => {
  it("放行需要按语言重定向的页面路径", () => {
    for (const path of ["/", "/knowledge/x", "/en/knowledge/x", "/stats?tab=1".split("?")[0], "/zh"]) {
      expect(matchesMatcher(path)).toBe(true);
    }
  });

  it("排除静态资源、内部路径与机器可读端点", () => {
    for (const path of [
      "/_next/static/chunk.js",
      "/_next/image",
      "/api/error-reports",
      "/api",
      "/favicon.ico",
      "/knowledge-assets/lesson/a.png",
      "/sitemap.xml",
      "/robots.txt",
      "/search-index.json",
      "/opengraph-image.png",
      "/icon.svg",
    ]) {
      expect(matchesMatcher(path)).toBe(false);
    }
  });

  it("排除带扩展名的文件但保留同名路径段", () => {
    expect(matchesMatcher("/knowledge/candlestick.md")).toBe(false);
    expect(matchesMatcher("/knowledge/candlestick")).toBe(true);
  });
});
