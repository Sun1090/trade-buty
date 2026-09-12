import { afterEach, describe, expect, it, vi } from "vitest";
import { trackAiClick } from "./analytics";

describe("trackAiClick", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the entry and meta on the console channel", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    trackAiClick("lesson-ask-ai", { chapter: 3 });
    expect(info).toHaveBeenCalledWith("[ai-track]", "lesson-ask-ai", {
      chapter: 3,
    });
  });

  it("defaults meta to an empty object", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    trackAiClick("chapter-summary");
    expect(info).toHaveBeenCalledWith("[ai-track]", "chapter-summary", {});
  });

  it("never throws when the console channel is unavailable", () => {
    vi.spyOn(console, "info").mockImplementation(() => {
      throw new Error("console closed");
    });
    expect(() => trackAiClick("term-explainer")).not.toThrow();
  });
});
