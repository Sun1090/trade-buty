import { describe, it, expect } from "vitest";
import { buildPageMetadata } from "./metadata";

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
