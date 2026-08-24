// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocList } from "./doc-list";
import type { DocMeta } from "@/lib/content";

// mock useLocalProgress
vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: () => null, // 无已读
}));

const metas: DocMeta[] = [
  { slug: "doc-a", title: "文档A", description: "描述A", order: 0 },
  { slug: "doc-b", title: "文档B", description: "描述B", order: 1 },
];

describe("DocList", () => {
  it("渲染所有课程链接", () => {
    render(<DocList metas={metas} chapterSlug="spot" locale="zh" />);
    expect(screen.getByText("文档A")).toBeInTheDocument();
    expect(screen.getByText("文档B")).toBeInTheDocument();
  });

  it("显示进度 0/total", () => {
    render(<DocList metas={metas} chapterSlug="spot" locale="zh" />);
    expect(screen.getAllByText("0/2").length).toBeGreaterThan(0);
  });

  it("链接指向正确路径", () => {
    const { container } = render(<DocList metas={metas} chapterSlug="spot" locale="zh" />);
    const links = container.querySelectorAll("a[href*='doc-a']");
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].getAttribute("href")).toBe("/zh/knowledge/spot/doc-a");
  });

  it("显示描述", () => {
    render(<DocList metas={metas} chapterSlug="spot" locale="zh" />);
    expect(screen.getAllByText("描述A").length).toBeGreaterThan(0);
  });
});
