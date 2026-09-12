// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

let pathname = "/zh/path";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

import { LocaleHtmlLang } from "./locale-html-lang";

describe("LocaleHtmlLang", () => {
  it("marks the document as zh-CN for the zh locale", () => {
    pathname = "/zh/knowledge/getting-started";
    render(<LocaleHtmlLang />);
    expect(document.documentElement.lang).toBe("zh-CN");
  });

  it("marks the document as en for the en locale", () => {
    pathname = "/en/knowledge/getting-started";
    render(<LocaleHtmlLang />);
    expect(document.documentElement.lang).toBe("en");
  });

  it("falls back to zh-CN for unknown first segments", () => {
    pathname = "/share/quiz";
    render(<LocaleHtmlLang />);
    expect(document.documentElement.lang).toBe("zh-CN");
  });
});
