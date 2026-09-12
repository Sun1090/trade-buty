import { describe, it, expect } from "vitest";
import { buildPageMetadata, buildSoftNotFoundMetadata } from "./metadata";

describe("buildPageMetadata", () => {
  it("zh：openGraph locale = zh_CN，alternateLocale = en_US", () => {
    const m = buildPageMetadata({
      locale: "zh",
      title: "首页",
      description: "desc",
      path: "/zh",
    });
    expect(m.title).toBe("首页");
    expect(m.description).toBe("desc");
    expect(m.alternates?.canonical).toBe("/zh");
    const og = m.openGraph!;
    expect(og.title).toBe("首页");
    expect(og.description).toBe("desc");
    expect(og.locale).toBe("zh_CN");
    expect(og.alternateLocale).toEqual(["en_US"]);
    expect(og.siteName).toBe("Trade Buty");
    expect(og.url).toContain("/zh");
    expect((m.twitter as unknown as Record<string, unknown>)?.card).toBe("summary_large_image");
    expect(m.twitter?.title).toBe("首页");
    expect(m.twitter?.description).toBe("desc");
  });

  it("en：openGraph locale = en_US，alternateLocale = zh_CN", () => {
    const m = buildPageMetadata({
      locale: "en",
      title: "Home",
      description: "desc-en",
      path: "/en",
    });
    const og = m.openGraph!;
    expect(og.locale).toBe("en_US");
    expect(og.alternateLocale).toEqual(["zh_CN"]);
    expect(og.url).toContain("/en");
  });

  it("noindex=true → robots.index=false", () => {
    const m = buildPageMetadata({
      locale: "en",
      title: "AI",
      description: "x",
      path: "/en/ai",
      noindex: true,
    });
    const robots = m.robots as { index: boolean; follow: boolean } | undefined;
    expect(robots?.index).toBe(false);
    expect(robots?.follow).toBe(false);
  });

  it("article 类型 + publishedTime 透传", () => {
    const m = buildPageMetadata({
      locale: "zh",
      title: "lesson",
      description: "d",
      path: "/zh/knowledge/x/y",
      type: "article",
      publishedTime: "2026-09-01T00:00:00Z",
      modifiedTime: "2026-09-05T00:00:00Z",
    });
    const og = m.openGraph as unknown as Record<string, unknown>;
    expect(og.type).toBe("article");
    expect(og.publishedTime).toBe("2026-09-01T00:00:00Z");
  });

  it("path 注入 canonical 与 og:url", () => {
    const m = buildPageMetadata({
      locale: "zh",
      title: "t",
      description: "d",
      path: "/zh/knowledge/getting-started/first-trade",
    });
    expect(m.alternates?.canonical).toBe("/zh/knowledge/getting-started/first-trade");
    expect(m.openGraph?.url).toContain("/zh/knowledge/getting-started/first-trade");
  });
});

describe("buildPageMetadata alternates.languages（R10.23 hreflang）", () => {
  it("zh 页 + en 对侧存在：声明双语对 + x-default=en", () => {
    const m = buildPageMetadata({
      locale: "zh",
      title: "课程",
      description: "d",
      path: "/zh/knowledge/getting-started/candlestick-basics",
      type: "article",
      languages: {
        zh: "/zh/knowledge/getting-started/candlestick-basics",
        en: "/en/knowledge/getting-started/candlestick-basics",
      },
    });
    expect(m.alternates?.canonical).toBe("/zh/knowledge/getting-started/candlestick-basics");
    expect(m.alternates?.languages).toEqual({
      zh: "/zh/knowledge/getting-started/candlestick-basics",
      en: "/en/knowledge/getting-started/candlestick-basics",
      "x-default": "/en/knowledge/getting-started/candlestick-basics",
    });
  });

  it("en 页 + zh 对侧存在：x-default 仍取 en 本页", () => {
    const m = buildPageMetadata({
      locale: "en",
      title: "Lesson",
      description: "d",
      path: "/en/knowledge/getting-started/candlestick-basics",
      type: "article",
      languages: {
        en: "/en/knowledge/getting-started/candlestick-basics",
        zh: "/zh/knowledge/getting-started/candlestick-basics",
      },
    });
    expect(m.alternates?.languages).toEqual({
      en: "/en/knowledge/getting-started/candlestick-basics",
      zh: "/zh/knowledge/getting-started/candlestick-basics",
      "x-default": "/en/knowledge/getting-started/candlestick-basics",
    });
  });

  it("对侧缺（翻译缺口）：只声明本页 + x-default 回退", () => {
    const m = buildPageMetadata({
      locale: "zh",
      title: "课程",
      description: "d",
      path: "/zh/knowledge/advanced-zh-only",
      type: "article",
      languages: { zh: "/zh/knowledge/advanced-zh-only" },
    });
    expect(m.alternates?.languages).toEqual({
      zh: "/zh/knowledge/advanced-zh-only",
      "x-default": "/zh/knowledge/advanced-zh-only",
    });
  });

  it("不传 languages：无 languages 键（维持单语 canonical，向后兼容）", () => {
    const m = buildPageMetadata({
      locale: "en",
      title: "Home",
      description: "d",
      path: "/en",
    });
    expect(m.alternates?.canonical).toBe("/en");
    expect(m.alternates?.languages).toBeUndefined();
  });
});

describe("buildSoftNotFoundMetadata（R13.17）", () => {
  it("软 404 自报 noindex 但保留 follow", () => {
    const m = buildSoftNotFoundMetadata("zh");
    expect(m.robots).toEqual({ index: false, follow: true });
  });

  it("不产出 canonical —— 指向不存在的 URL 只会制造重复信号", () => {
    for (const locale of ["zh", "en"] as const) {
      const m = buildSoftNotFoundMetadata(locale);
      expect(m.alternates).toBeUndefined();
    }
  });

  it("标题/描述按 locale 取，不回落成站点默认文案", () => {
    const zh = buildSoftNotFoundMetadata("zh");
    const en = buildSoftNotFoundMetadata("en");
    expect(typeof zh.title).toBe("string");
    expect(zh.title).not.toEqual(en.title);
    expect(String(en.title).toLowerCase()).toContain("not found");
  });
});
