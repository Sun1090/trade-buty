import { describe, expect, it } from "vitest";
import { knowledgeHref } from "./hrefs";

describe("knowledgeHref", () => {
  it("builds chapter and lesson routes", () => {
    expect(knowledgeHref("zh", "getting-started")).toBe("/zh/knowledge/getting-started");
    expect(knowledgeHref("en", "risk-control", "position-sizing")).toBe(
      "/en/knowledge/risk-control/position-sizing",
    );
  });

  it("rejects values that could change the URL scheme or traverse the path", () => {
    expect(() => knowledgeHref("../../admin", "getting-started")).toThrow("Invalid locale");
    expect(() => knowledgeHref("zh", "javascript:alert(1)")).toThrow("Invalid knowledge path segment");
    expect(() => knowledgeHref("zh", "..")).toThrow("Invalid knowledge path segment");
    expect(() => knowledgeHref("zh", "chapter", "../../admin")).toThrow("Invalid knowledge path segment");
  });
});
