// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KnowledgeMiss } from "./knowledge-miss";

const suggestions = [
  {
    slug: "getting-started",
    title: "入门基础",
    href: "/zh/knowledge/getting-started",
  },
];

describe("KnowledgeMiss (R13.18)", () => {
  it("render zh chapter CTAs and route them inside the locale", () => {
    render(
      <KnowledgeMiss
        locale="zh"
        kind="chapter"
        heading="这个篇章不存在"
        suggestTitle="最接近的课程"
        searchCta="搜索课程"
        pathCta="从学习路线开始"
        suggestions={suggestions}
      />
    );

    const ctas = screen.getByTestId("chapter-no-result-cta");
    expect(ctas).toHaveTextContent("搜索课程");
    expect(ctas.querySelector('a[href="/zh/search"]')).toBeInTheDocument();
    expect(ctas.querySelector('a[href="/zh/path"]')).toBeInTheDocument();
    expect(screen.getByTestId("chapter-suggestions")).toHaveTextContent("入门基础");
  });

  it("render en doc CTAs and preserve the document hint", () => {
    render(
      <KnowledgeMiss
        locale="en"
        kind="doc"
        heading="This lesson doesn't exist"
        hint="It may not be translated yet."
        suggestTitle="Closest lessons"
        searchCta="Search lessons"
        pathCta="Browse the learning path"
        suggestions={[{ slug: "risk-control", title: "Risk Control", href: "/en/knowledge/risk-control" }]}
      />
    );

    const ctas = screen.getByTestId("doc-no-result-cta");
    expect(ctas.querySelector('a[href="/en/search"]')).toBeInTheDocument();
    expect(ctas.querySelector('a[href="/en/path"]')).toBeInTheDocument();
    expect(screen.getByText("It may not be translated yet.")).toBeInTheDocument();
    expect(screen.getByTestId("doc-suggestions").tagName).toBe("OL");
  });

  it("keeps both CTAs when URL-distance suggestions are empty", () => {
    render(
      <KnowledgeMiss
        locale="en"
        kind="chapter"
        heading="Chapter not found"
        suggestTitle="Closest lessons"
        searchCta="Search lessons"
        pathCta="Browse the learning path"
        suggestions={[]}
      />
    );

    expect(screen.getByTestId("chapter-no-result-cta")).toBeVisible();
    expect(screen.queryByTestId("chapter-suggestions")).toBeNull();
  });
});
