// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Chapter } from "@/lib/content";
import type { Stage } from "@/lib/path";

const mocks = vi.hoisted(() => ({
  getStageGroups: vi.fn(() => [] as { stage: Stage; chapters: Chapter[] }[]),
}));

vi.mock("@/lib/path", () => ({
  getStageGroups: mocks.getStageGroups,
}));

import { KnowledgeGraph } from "./knowledge-graph";

function chapter(slug: string, title: string, docCount: number): Chapter {
  return { slug, title, docCount, order: 1, tagline: "" };
}

function groups() {
  return [
    {
      stage: { id: "core" as const, chapterNums: [] },
      chapters: [
        chapter("getting-started", "入门基础篇", 10),
        chapter("spot", "现货交易篇", 5),
      ],
    },
    {
      stage: { id: "practice" as const, chapterNums: [] },
      chapters: [chapter("trading-practice", "交易实践篇", 4)],
    },
    {
      stage: { id: "deep" as const, chapterNums: [] },
      chapters: [chapter("options-strategies", "期权策略篇", 2)],
    },
  ];
}

beforeEach(() => {
  mocks.getStageGroups.mockReset();
  mocks.getStageGroups.mockReturnValue(groups());
});

describe("KnowledgeGraph", () => {
  it("renders the three stage groups with their chapters", () => {
    render(<KnowledgeGraph locale="zh" />);
    expect(screen.getByText(/基础阶段/)).toBeInTheDocument();
    expect(screen.getByText(/进阶阶段/)).toBeInTheDocument();
    expect(screen.getByText(/深化阶段/)).toBeInTheDocument();
    expect(screen.getByText("入门基础篇")).toBeInTheDocument();
    expect(screen.getByText("交易实践篇")).toBeInTheDocument();
    expect(screen.getByText("期权策略篇")).toBeInTheDocument();
  });

  it("links each chapter to its knowledge route", () => {
    render(<KnowledgeGraph locale="zh" />);
    expect(screen.getByRole("link", { name: /入门基础篇/ })).toHaveAttribute(
      "href",
      "/zh/knowledge/getting-started",
    );
  });

  it("prefixes links with the active locale", () => {
    render(<KnowledgeGraph locale="en" />);
    expect(screen.getByRole("link", { name: /入门基础篇/ })).toHaveAttribute(
      "href",
      "/en/knowledge/getting-started",
    );
    expect(screen.getByText(/Foundation · Core path/)).toBeInTheDocument();
  });

  it("scales the lesson bar against the largest chapter", () => {
    render(<KnowledgeGraph locale="zh" />);
    const link = screen.getByRole("link", { name: /入门基础篇/ });
    const bar = link.querySelectorAll("span span")[0] as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });

  it("falls back to the raw stage id for unknown stages", () => {
    mocks.getStageGroups.mockReturnValue([
      {
        stage: { id: "unknown" as unknown as "core", chapterNums: [] },
        chapters: [chapter("mystery", "神秘篇章", 1)],
      },
    ]);
    render(<KnowledgeGraph locale="en" />);
    expect(screen.getByText(/unknown/)).toBeInTheDocument();
  });
});
