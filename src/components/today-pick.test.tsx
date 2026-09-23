// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

let progress: Record<string, string[]> | null = {};
vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: () => progress,
}));

import { TodayPick } from "./today-pick";

const chapters = [
  {
    slug: "chapter-a",
    title: "章节 A",
    docs: [
      { slug: "a1", title: "A1" },
      { slug: "a2", title: "A2" },
    ],
  },
  {
    slug: "chapter-b",
    title: "章节 B",
    docs: [{ slug: "b1", title: "B1" }],
  },
];

const props = { locale: "zh", label: "今日推荐", hint: "继续", done: "全部学完" };

beforeEach(() => {
  progress = {};
});

describe("TodayPick", () => {
  it("从第一章的第一篇未读课程开始推荐", () => {
    progress = { "chapter-a": ["a1"] };
    render(<TodayPick chapters={chapters} {...props} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/zh/knowledge/chapter-a/a2");
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.getByText(/继续 · 章节 A/)).toBeInTheDocument();
  });

  it("无任何进度时推荐第一章第一篇", () => {
    progress = {};
    render(<TodayPick chapters={chapters} {...props} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/zh/knowledge/chapter-a/a1",
    );
  });

  it("全部读完时回退到第一篇并显示完成文案", () => {
    progress = { "chapter-a": ["a1", "a2"], "chapter-b": ["b1"] };
    render(<TodayPick chapters={chapters} {...props} />);
    expect(screen.getByText("全部学完")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/zh/knowledge/chapter-a/a1",
    );
  });

  it("没有章节时不渲染", () => {
    const { container } = render(<TodayPick chapters={[]} {...props} />);
    expect(container.firstChild).toBeNull();
  });

  it("locale 影响链接前缀", () => {
    progress = {};
    render(<TodayPick chapters={chapters} {...props} locale="en" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/en/knowledge/chapter-a/a1",
    );
  });
});

/**
 * R16.45：`done` 这句「都学完了」是调用方写的，组件只负责在**它传给它的篇章**全部读完后
 * 把这句话显示出来。原来首页传的是全部 27 章、文案却写「主线课程已完成」——
 * 于是真把主线读完的人看不到这句话，看到它的人其实整套都读完了。
 * 这里两头都钉：调用范围 + 文案口径。
 */
describe("TodayPick 的完成文案与它真的检查的范围一致（R16.45）", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/app/[locale]/page.tsx"), "utf8");
  const callStart = source.indexOf("<TodayPick");
  const call = source.slice(callStart, source.indexOf("/>", callStart) + 2);

  it("扫描面本身非空，且调用点传的是全部篇章", () => {
    expect(callStart, "首页必须还在用 TodayPick").toBeGreaterThan(-1);
    expect(call).toContain("chapters={learningChapters}");
    expect(source).toContain("const learningChapters = chapters.map(");
    expect(source).toContain("const chapters = getChapters(locale)");
  });

  it("范围是全部篇章，文案就不许收窄成「主线」", () => {
    expect(call.toLowerCase()).not.toMatch(/主线|core path|core courses/);
  });
});
