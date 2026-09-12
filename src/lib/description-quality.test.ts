import { describe, expect, it } from "vitest";
import { scoreDescription, renderDescriptionQualityMarkdown } from "../../scripts/description-quality-lib.mjs";

describe("description quality (R10.4)", () => {
  it("rewards a present, detailed description relevant to its title", () => {
    const result = scoreDescription({ title: "杠杆与保证金", description: "杠杆与保证金的计算、清算价格、维持保证金与风险控制要点" });
    expect(result.status).toBe("pass");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("marks missing and too-short descriptions as gaps", () => {
    expect(scoreDescription({ title: "标题", description: "" })).toMatchObject({ status: "gap", score: 0 });
    expect(scoreDescription({ title: "标题", description: "太短" }).status).toBe("gap");
  });

  it("uses Unicode character length and keeps medium descriptions reviewable", () => {
    const result = scoreDescription({ title: "Market Risk", description: "Explains the mechanics and practical limits." });
    expect(result.length).toBe(44);
    expect(result.status).toBe("pass");
  });

  it("renders stable status counts", () => {
    const markdown = renderDescriptionQualityMarkdown({ generatedAt: "2026-09-06", results: [
      scoreDescription({ title: "Spot Trading", description: "Spot trading basics, market mechanics, and risk control." }),
    ].map((result) => ({ locale: "en", chapter: "spot", document: "basics", ...result })) });
    expect(markdown).toContain("总课程：1");
    expect(markdown).toContain("2026-09-06");
  });

  it("ignores the NN · lesson-order prefix when scoring title relevance (R10.4)", () => {
    const description = "Traditional finance assumes you are a rational agent, but real traders sell winners and hold losers.";
    const prefixed = scoreDescription({ title: "01 · Foundations of Behavioral Finance", description });
    const plain = scoreDescription({ title: "Foundations of Behavioral Finance", description });
    expect(prefixed.title).toBe("01 · Foundations of Behavioral Finance");
    expect(prefixed.dimensions.titleRelevance).toBe(plain.dimensions.titleRelevance);
    expect(prefixed.score).toBe(plain.score);
    expect(prefixed.matchedTitleWords).toEqual(plain.matchedTitleWords);
    expect(prefixed.matchedTitleWords).not.toContain("01");
  });
});
