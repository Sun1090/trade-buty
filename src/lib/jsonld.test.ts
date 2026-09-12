import { describe, it, expect } from "vitest";
import {
  article,
  breadcrumbList,
  course,
  faqPage,
  ORGANIZATION_ID,
  quiz,
  siteGraph,
  webPage,
} from "./jsonld";
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

  it("页面级 BreadcrumbList 带稳定 @id", () => {
    const href = "/zh/knowledge/getting-started";
    const out = breadcrumbList([{ name: "入门", href }], href);
    expect(out["@id"]).toBe(`${SITE_URL}${href}#breadcrumb`);
  });
});

describe("siteGraph", () => {
  it("生成可被页面实体引用的组织与站点身份", () => {
    const out = siteGraph("zh");
    const graph = out["@graph"] as Array<Record<string, unknown>>;
    const org = graph.find((node) => node["@type"] === "EducationalOrganization")!;
    const site = graph.find((node) => node["@type"] === "WebSite")!;
    expect(org["@id"]).toBe(ORGANIZATION_ID);
    expect(org.url).toBe(SITE_URL);
    expect(site.url).toBe(`${SITE_URL}/zh`);
    expect(site.inLanguage).toBe("zh-CN");
    expect((site.publisher as Record<string, string>)["@id"]).toBe(ORGANIZATION_ID);
    expect((site.potentialAction as Record<string, unknown>)["query-input"]).toBe(
      "required name=search_term_string",
    );
  });

  it("en locale 使用英文语言标记", () => {
    const graph = siteGraph("en")["@graph"] as Array<Record<string, unknown>>;
    const site = graph.find((node) => node["@type"] === "WebSite")!;
    expect(site.inLanguage).toBe("en");
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
    expect((out.provider as Record<string, string>)["@id"]).toBe(ORGANIZATION_ID);
    expect(out.isAccessibleForFree).toBe(true);
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

describe("article", () => {
  it("用稳定实体引用连接正文页与章节 Course", () => {
    const out = article({
      locale: "zh",
      title: "金融市场全景",
      description: "课程简介",
      pageHref: "/zh/knowledge/getting-started/market-overview",
      chapterTitle: "入门基础",
      chapterHref: "/zh/knowledge/getting-started",
    });
    expect(out["@type"]).toBe("Article");
    expect((out.author as Record<string, string>)["@id"]).toBe(ORGANIZATION_ID);
    expect((out.publisher as Record<string, string>)["@id"]).toBe(ORGANIZATION_ID);
    expect((out.mainEntityOfPage as Record<string, string>)["@id"]).toBe(
      `${SITE_URL}/zh/knowledge/getting-started/market-overview`,
    );
    expect((out.isPartOf as Record<string, string>)["@id"]).toBe(
      `${SITE_URL}/zh/knowledge/getting-started#course`,
    );
  });
});

describe("webPage", () => {
  it("将分享页挂到同语言 WebSite 实体", () => {
    const out = webPage({
      locale: "en",
      title: "Quiz result",
      description: "Shared result",
      pageHref: "/share/quiz/example",
    });
    expect(out["@type"]).toBe("WebPage");
    expect(out.url).toBe(`${SITE_URL}/share/quiz/example`);
    expect((out.isPartOf as Record<string, string>)["@id"]).toBe(
      `${SITE_URL}/en#website`,
    );
  });
});

describe("faqPage", () => {
  it("将可见问答逐条映射为 Question/Answer", () => {
    const out = faqPage("zh", [
      { question: "是否免费？", answer: "永久免费。" },
      { question: "需要注册吗？", answer: "不需要。" },
    ]);
    expect(out["@type"]).toBe("FAQPage");
    expect(out.url).toBe(`${SITE_URL}/zh/faq`);
    const questions = out.mainEntity as Array<Record<string, unknown>>;
    expect(questions).toHaveLength(2);
    expect(questions[0]!.name).toBe("是否免费？");
    expect((questions[0]!.acceptedAnswer as Record<string, string>).text).toBe(
      "永久免费。",
    );
  });

  it("无可见问答时不伪造 FAQ 条目", () => {
    expect(faqPage("en", []).mainEntity).toEqual([]);
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
