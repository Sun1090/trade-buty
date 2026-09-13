// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { JsonLd, serializeJsonLd } from "./json-ld";

describe("JsonLd", () => {
  it("serializes the payload into a JSON-LD script tag", () => {
    render(
      <JsonLd
        data={{ "@context": "https://schema.org", "@type": "Article" }}
      />,
    );
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script?.textContent ?? "")).toEqual({
      "@context": "https://schema.org",
      "@type": "Article",
    });
  });

  it("keeps nested arrays and Unicode intact", () => {
    render(
      <JsonLd
        data={{
          "@type": "FAQPage",
          mainEntity: [{ name: "什么是 K 线？", acceptedAnswer: "一段时间的价格记录" }],
        }}
      />,
    );
    const script = document.querySelector('script[type="application/ld+json"]');
    const parsed = JSON.parse(script?.textContent ?? "") as {
      mainEntity: { name: string }[];
    };
    expect(parsed.mainEntity[0].name).toBe("什么是 K 线？");
  });

  it("escapes script-breaking and line-separator characters", () => {
    const data = { name: "</script><script>alert(1)</script>", separator: "a\u2028b\u2029c" };
    const serialized = serializeJsonLd(data);

    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("\u2028");
    expect(serialized).not.toContain("\u2029");
    expect(JSON.parse(serialized)).toEqual(data);
  });
});
