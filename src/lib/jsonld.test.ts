import { describe, it, expect } from "vitest";
import { breadcrumbList, course, quiz } from "./jsonld";
import { SITE_URL } from "./site";

describe("breadcrumbList", () => {
  it("按 items 顺序生成 ListItem，position 从 1 开始", () => {
    const out = breadcrumbList([
      { name: "Home", href: "/zh" },
      { name: "入门", href: "/zh/knowledge/getting-started" },
      { name: "第一笔交易", href: "/zh/knowledge/getting-started/first-trade" },
    ]);
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("BreadcrumbList");
    const items = out.itemListElement as { position: number; name: string; item: string }[];
    expect(items).toHaveLength(3);
    expect(items[0]!.position).toBe(1);
    expect(items[2]!.position).toBe(3);
    expect(items[0]!.item).toBe(`${SITE_URL}/zh`);
    expect(items[2]!.name).toBe("第一笔交易");
  });
});

describe("course", () => {
  it("生成包含 hasPart 的 Course schema，URL 用 SITE_URL", () => {
    const out = course({
      locale: "zh",
      title: "入门基础",
      description: "短课节 + 清晰路径",
      chapterHref: "/zh/knowledge/getting-started",
      lessons: [
        { title: "第一笔交易", href: "/zh/knowledge/getting-started/first-trade" },
        { title: "风险常识", href: "/zh/knowledge/getting-started/risk-basics" },
      ],
    });
    expect(out["@type"]).toBe("Course");
    expect(out.inLanguage).toBe("zh-CN");
    expect(out.url).toBe(`${SITE_URL}/zh/knowledge/getting-started`);
    const parts = out.hasPart as { name: string; "@type": string }[];
    expect(parts).toHaveLength(2);
    expect(parts[0]!["@type"]).toBe("LearningResource");
    expect(parts[1]!.name).toBe("风险常识");
  });

  it("en locale → inLanguage en", () => {
    const out = course({
      locale: "en",
      title: "Getting Started",
      description: "x",
      chapterHref: "/en/knowledge/getting-started",
      lessons: [],
    });
    expect(out.inLanguage).toBe("en");
    expect(out.hasPart).toEqual([]);
  });
});

describe("quiz", () => {
  it("生成 Quiz schema，hasPart 列出所有题", () => {
    const out = quiz({
      locale: "zh",
      title: "入门基础 · 随堂测",
      chapterHref: "/zh/knowledge/getting-started",
      questions: [
        { text: "阳线说明什么？" },
        { text: "市价单与限价单的区别？" },
      ],
    });
    expect(out["@type"]).toBe("Quiz");
    const parts = out.hasPart as { text: string; "@type": string }[];
    expect(parts).toHaveLength(2);
    expect(parts[0]!.text).toBe("阳线说明什么？");
    expect(parts[1]!["@type"]).toBe("Question");
  });
});
