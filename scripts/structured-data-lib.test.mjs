import { describe, expect, it } from "vitest";
import {
  expectedTypesForRoute,
  extractJsonLd,
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
});
