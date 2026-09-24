import { describe, expect, it } from "vitest";
import {
  collectNodes,
  expectedTypesForRoute,
  extractJsonLd,
  nodeTypes,
  hasPageIdentity,
  validateBreadcrumb,
  validateFaqPage,
  validateStructuredData,
} from "./structured-data-lib.mjs";

function script(document, raw = JSON.stringify(document)) {
  return { raw, document, error: null };
}

describe("structured-data extraction", () => {
  it("extracts and parses every JSON-LD script", () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"}</script>
      <script type='application/ld+json'>{"@context":"https://schema.org","@type":"Article"}</script>
    `;
    const scripts = extractJsonLd(html);
    expect(scripts).toHaveLength(2);
    expect(scripts.map((item) => item.document["@type"])).toEqual(["WebSite", "Article"]);
  });

  it("keeps malformed JSON as an explicit error", () => {
    const scripts = extractJsonLd(
      '<script type="application/ld+json">{"@type":</script>',
    );
    expect(scripts).toHaveLength(1);
    expect(scripts[0].document).toBeNull();
    expect(scripts[0].error).toMatch(/JSON/);
  });
});

describe("structured-data validation", () => {
  const pageUrl = "https://example.com/zh/knowledge/getting-started";
  const scripts = [
    script({
      "@context": "https://schema.org",
      "@type": "Course",
      "@id": `${pageUrl}#course`,
      url: pageUrl,
      inLanguage: "zh-CN",
      provider: { "@id": "https://example.com/#organization" },
    }),
    script({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://example.com/zh#website",
      url: "https://example.com/zh",
      inLanguage: "zh-CN",
    }),
  ];

  it("accepts expected types, locale, canonical identity, and absolute URLs", () => {
    const result = validateStructuredData({
      scripts,
      expectedTypes: ["Course", "WebSite"],
      locale: "zh",
      pageUrl,
    });
    expect(result.errors).toEqual([]);
  });

  it("collects nested array and type-array nodes", () => {
    const result = validateStructuredData({
      scripts: [
        script({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", url: "https://example.com" },
            { "@type": ["EducationalOrganization", "Organization"], url: "https://example.com" },
          ],
        }),
      ],
      expectedTypes: ["WebSite", "EducationalOrganization"],
      locale: "en",
      requirePageIdentity: false,
    });
    expect(result.errors).toEqual([]);
    expect(result.types).toContain("Organization");
  });

  it("reports context, non-http template URLs, and skipped page identity", () => {
    const result = validateStructuredData({
      scripts: [
        script({
          "@context": "https://not-schema.org",
          "@type": "EducationalOrganization",
          "@id": "mailto:support@example.com",
          sameAs: ["https://example.com/{org}"],
        }),
      ],
      expectedTypes: ["EducationalOrganization"],
      locale: "en",
      requirePageIdentity: false,
      pageUrl,
    });
    expect(result.errors).toContain("script[0] @context must be https://schema.org");
    expect(result.errors).toContain(
      'script[0].@id: non-http URL "mailto:support@example.com"',
    );
    expect(result.errors).not.toContain(`no structured-data node identifies the canonical page ${pageUrl}`);
  });

  it("reports missing types, wrong language, and relative URLs", () => {
    const result = validateStructuredData({
      scripts: [
        script({
          "@context": "https://schema.org",
          "@type": "Article",
          url: "/relative",
          inLanguage: "en",
        }),
      ],
      expectedTypes: ["Article", "FAQPage"],
      locale: "zh",
      pageUrl,
    });
    expect(result.errors).toContain("missing required @type FAQPage");
    expect(result.errors.some((error) => error.includes("inLanguage must be zh-CN"))).toBe(true);
    expect(result.errors.some((error) => error.includes("relative or invalid URL"))).toBe(true);
    expect(result.errors.some((error) => error.includes("canonical page"))).toBe(true);
  });

  it("报英文却印中文的节点当场抓住（inLanguage 必须等于真正印出来的语言）", () => {
    const result = validateStructuredData({
      scripts: [
        script({
          "@context": "https://schema.org",
          "@type": "Quiz",
          inLanguage: "en",
          name: "入门基础 · 随堂测",
          hasPart: [{ "@type": "Question", text: "阳线说明什么？" }],
        }),
      ],
      expectedTypes: ["Quiz"],
      locale: "en",
      pageUrl,
    });
    expect(
      result.errors.some((error) => error.includes('declares inLanguage "en" but carries Chinese text')),
      result.errors.join("\n"),
    ).toBe(true);
  });

  it("foreignLanguageTypes 允许素材语言自定的节点不跟页面语言", () => {
    const document = {
      "@context": "https://schema.org",
      "@type": "Quiz",
      inLanguage: "zh-CN",
      "@id": `${pageUrl}#quiz`,
      url: pageUrl,
      name: "行为金融篇 · 随堂测",
    };
    const strict = validateStructuredData({
      scripts: [script(document)],
      expectedTypes: ["Quiz"],
      locale: "en",
      pageUrl,
    });
    expect(strict.errors.some((error) => error.includes("inLanguage must be en"))).toBe(true);
    const lenient = validateStructuredData({
      scripts: [script(document)],
      expectedTypes: ["Quiz"],
      locale: "en",
      pageUrl,
      foreignLanguageTypes: ["Quiz"],
    });
    expect(lenient.errors).toEqual([]);
  });

  it("rejects relative sameAs values", () => {
    const result = validateStructuredData({
      scripts: [
        script({
          "@context": "https://schema.org",
          "@type": "Organization",
          url: "https://example.com",
          sameAs: ["/github"],
        }),
      ],
      expectedTypes: ["Organization"],
      locale: "zh",
      requirePageIdentity: false,
    });
    expect(result.errors).toContain(
      "script[0].sameAs[0]: relative or invalid URL \"/github\"",
    );
  });

  it("finds page identity in @id and nested mainEntityOfPage values", () => {
    expect(
      hasPageIdentity(
        [script({ "@type": "Article", mainEntityOfPage: { "@id": pageUrl } })],
        pageUrl,
      ),
    ).toBe(true);
  });
});

describe("route contracts", () => {
  it.each([
    ["zh", ["WebSite", "EducationalOrganization"]],
    ["en/faq", ["WebSite", "EducationalOrganization", "FAQPage"]],
    ["zh/knowledge/getting-started", ["WebSite", "EducationalOrganization", "Course", "BreadcrumbList"]],
    ["en/knowledge/getting-started/market-overview", ["WebSite", "EducationalOrganization", "Article", "BreadcrumbList"]],
    ["share/quiz/example", ["WebSite", "EducationalOrganization", "WebPage"]],
  ])("maps %s to its required types", (route, expected) => {
    expect(expectedTypesForRoute(route)).toEqual(expected);
  });
});

describe("semantic page contracts", () => {
  it("requires a complete ordered breadcrumb ending on the page", () => {
    const pageUrl = "https://example.com/zh/knowledge/getting-started/first-trade";
    const valid = [
      script({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { position: 1, name: "首页", item: "https://example.com/zh" },
          { position: 2, name: "课程", item: pageUrl },
        ],
      }),
    ];
    expect(validateBreadcrumb(valid, pageUrl)).toEqual([]);
    expect(validateBreadcrumb([], pageUrl)).toContain(
      "expected exactly one BreadcrumbList node, got 0",
    );
  });

  it("rejects FAQ entries with empty question or answer text", () => {
    const invalid = [
      script({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { name: "", acceptedAnswer: { text: "" } },
          { name: "Q2", acceptedAnswer: { text: "A2" } },
        ],
      }),
    ];
    expect(validateFaqPage(invalid)).toEqual([
      "FAQPage question[0] has an empty name",
      "FAQPage question[0] has an empty acceptedAnswer.text",
    ]);
  });

  it("reports FAQ mainEntity when it is not a non-empty array", () => {
    expect(
      validateFaqPage([script({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: "not-array" })]),
    ).toEqual(["FAQPage mainEntity must be a non-empty array"]);
    expect(
      validateFaqPage([script({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [] })]),
    ).toEqual(["FAQPage mainEntity must be a non-empty array"]);
  });

  it("rejects malformed breadcrumb items, short lists, and wrong final target", () => {
    const pageUrl = "https://example.com/zh/knowledge/getting-started/market-overview";
    const invalid = [
      script({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { position: 2, name: "首页", item: "https://example.com/zh" },
          { position: 2, name: "", item: "https://example.com/zh/faq" },
        ],
      }),
    ];
    expect(validateBreadcrumb(invalid, pageUrl)).toEqual([
      "BreadcrumbList item[0] position must be 1",
      "BreadcrumbList item[1] must have a name and item URL",
      "BreadcrumbList last item must be https://example.com/zh/knowledge/getting-started/market-overview",
    ]);
    expect(
      validateBreadcrumb([script({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [] })], pageUrl),
    ).toEqual(["BreadcrumbList itemListElement must contain at least two items"]);
    expect(
      validateBreadcrumb([script({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: "bad" })], pageUrl),
    ).toEqual(["BreadcrumbList itemListElement must contain at least two items"]);
  });
});

/**
 * 门禁读的是上游生成的 JSON-LD，形状不可信：非对象文档、循环引用、混进数组的
 * 原始值都必须被点名或被跳过，而不是让检查本身抛错。
 */
describe("structured-data 对畸形文档的容忍", () => {
  it("nodeTypes 只认字符串与字符串数组", () => {
    expect(nodeTypes({ "@type": "WebPage" })).toEqual(["WebPage"]);
    expect(nodeTypes({ "@type": ["A", 1, null, "B"] })).toEqual(["A", "B"]);
    expect(nodeTypes({ "@type": 7 })).toEqual([]);
    expect(nodeTypes({})).toEqual([]);
    expect(nodeTypes(null)).toEqual([]);
    expect(nodeTypes(undefined)).toEqual([]);
  });

  it("collectNodes 去重、走数组，且不被循环引用和原始值绊住", () => {
    const doc = { "@type": "WebSite", list: [1, "x", null, { "@type": "Thing" }] };
    doc.self = doc;
    expect(collectNodes(doc).map((node) => node["@type"])).toEqual(["WebSite", "Thing"]);
    expect(collectNodes(null)).toEqual([]);
    expect(collectNodes("text")).toEqual([]);
  });

  it("合法 JSON 但不是对象的文档会被点名，而不是中断整轮核对", () => {
    const result = validateStructuredData({
      scripts: [script(123), script("nope"), script(null)],
      expectedTypes: ["WebSite"],
      locale: "zh",
      pageUrl: "https://example.com/zh",
    });
    // 非对象文档除自身报错外还会连带缺类型 / 缺身份，这里只要求它如实点名且不崩。
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "script[0] must contain a JSON object",
        "script[1] must contain a JSON object",
        "script[2] must contain a JSON object",
      ])
    );
  });

  it("hasPageIdentity 在数组里也要找到身份，找不到时如实报告", () => {
    const url = "https://example.com/zh";
    expect(hasPageIdentity([script({ "@graph": [{ url }] })], url)).toBe(true);
    expect(hasPageIdentity([script({ "@graph": [1, "x", null, { other: url }] })], url)).toBe(false);
    expect(hasPageIdentity([], url)).toBe(false);
  });
});
