// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DocList } from "./doc-list";
import type { DocMeta } from "@/lib/content";
import type { ProgressMap } from "@/lib/progress";

// 可控的进度桩：每次渲染都会重新读取，便于在同一用例里切换已读集合。
const { store } = vi.hoisted(() => ({
  store: { progress: null as ProgressMap | null },
}));

vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: () => store.progress,
}));

const metas: DocMeta[] = [
  { slug: "doc-a", fileName: "doc-a.md", chapterSlug: "spot", title: "文档A", description: "描述A" },
  { slug: "doc-b", fileName: "doc-b.md", chapterSlug: "spot", title: "文档B", description: "描述B" },
];

const metasNoDescription: DocMeta[] = [
  { slug: "doc-a", fileName: "doc-a.md", chapterSlug: "spot", title: "文档A", description: "" },
];

beforeEach(() => {
  store.progress = null;
});
afterEach(() => {
  store.progress = null;
});

describe("DocList", () => {
  it("渲染所有课程链接", () => {
    render(<DocList metas={metas} chapterSlug="spot" locale="zh" />);
    expect(screen.getByText("文档A")).toBeInTheDocument();
    expect(screen.getByText("文档B")).toBeInTheDocument();
  });

  it("旧已读键（改课留下的）不计入角标，进度条也不过 100%", () => {
    store.progress = { spot: ["doc-a", "renamed-x", "removed-y", "gone-z"] } as unknown as ProgressMap;
    const { container } = render(<DocList metas={metas} chapterSlug="spot" locale="zh" />);
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(
      (container.querySelector(".h-full.rounded-full") as HTMLElement).style.width,
    ).toBe("50%");
  });

  it("显示进度 0/total", () => {
    render(<DocList metas={metas} chapterSlug="spot" locale="zh" />);
    expect(screen.getByText("0/2")).toBeInTheDocument();
  });

  it("链接指向正确路径", () => {
    const { container } = render(<DocList metas={metas} chapterSlug="spot" locale="zh" />);
    const links = container.querySelectorAll("a[href*='doc-a']");
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].getAttribute("href")).toBe("/zh/knowledge/spot/doc-a");
  });

  it("显示描述", () => {
    render(<DocList metas={metas} chapterSlug="spot" locale="zh" />);
    expect(screen.getByText("描述A")).toBeInTheDocument();
  });

  it("没有描述时不渲染段落", () => {
    const { container } = render(
      <DocList metas={metasNoDescription} chapterSlug="spot" locale="zh" />,
    );
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].querySelector("p")).toBeNull();
  });

  it("已读项显示勾选、进度计数与百分比", () => {
    store.progress = { spot: ["doc-a"] };
    const { container } = render(
      <DocList metas={metas} chapterSlug="spot" locale="zh" />,
    );
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("✓")).toBeInTheDocument();
    const bar = container.querySelector("div[style]") as HTMLDivElement;
    expect(bar.style.width).toBe("50%");
  });

  it("全部已读时进度为 100%", () => {
    store.progress = { spot: ["doc-a", "doc-b"] };
    const { container } = render(
      <DocList metas={metas} chapterSlug="spot" locale="zh" />,
    );
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(screen.getAllByText("✓")).toHaveLength(2);
    const bar = container.querySelector("div[style]") as HTMLDivElement;
    expect(bar.style.width).toBe("100%");

    // 全部已读时开启未读优先：排序比较器两侧都是已读，仍保持原顺序
    fireEvent.click(screen.getByRole("button", { name: "未读优先" }));
    expect(screen.getAllByText("✓")).toHaveLength(2);
  });

  it("进度键与章节不匹配时按未读处理", () => {
    store.progress = { "other-chapter": ["doc-a"] };
    render(<DocList metas={metas} chapterSlug="spot" locale="zh" />);
    expect(screen.getByText("0/2")).toBeInTheDocument();
    expect(screen.queryByText("✓")).toBeNull();
  });

  it("未读优先后已读项沉底，但编号仍按原始顺序", () => {
    store.progress = { spot: ["doc-a"] };
    const { container } = render(
      <DocList metas={metas} chapterSlug="spot" locale="zh" />,
    );

    // 初始：doc-a 在前
    let items = container.querySelectorAll("ol > li");
    expect(items[0].textContent).toContain("文档A");

    fireEvent.click(screen.getByRole("button", { name: "未读优先" }));

    items = container.querySelectorAll("ol > li");
    // 已读的 doc-a 被排到末尾
    expect(items[0].textContent).toContain("文档B");
    expect(items[1].textContent).toContain("文档A");
    // doc-b 仍编号 02（按 metas 原始位置），而不是排到首位的 01
    expect(within(items[0] as HTMLElement).getByText("02")).toBeInTheDocument();
    // 已读 doc-a 显示勾选
    expect(within(items[1] as HTMLElement).getByText("✓")).toBeInTheDocument();
  });

  it("再次点击未读优先恢复原始顺序", () => {
    store.progress = { spot: ["doc-a"] };
    const { container } = render(
      <DocList metas={metas} chapterSlug="spot" locale="zh" />,
    );
    const toggle = screen.getByRole("button", { name: "未读优先" });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    const items = container.querySelectorAll("ol > li");
    expect(items[0].textContent).toContain("文档A");
    expect(items[1].textContent).toContain("文档B");
  });

  it("切换按钮使用中文文案且 aria-pressed 随状态更新", () => {
    render(<DocList metas={metas} chapterSlug="spot" locale="zh" />);
    const toggle = screen.getByRole("button", { name: "未读优先" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "未读优先" })).toBeInTheDocument();
  });

  it("英文环境使用英文切换文案", () => {
    render(<DocList metas={metas} chapterSlug="spot" locale="en" />);
    expect(screen.getByRole("button", { name: "Unread first" })).toBeInTheDocument();
  });

  it("空课程列表显示中文空态", () => {
    render(<DocList metas={[]} chapterSlug="spot" locale="zh" />);
    expect(screen.getByText("暂无课程。")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("空课程列表显示英文空态", () => {
    render(<DocList metas={[]} chapterSlug="spot" locale="en" />);
    expect(screen.getByText("No lessons yet.")).toBeInTheDocument();
  });

  it("未读项显示两位补零的课号", () => {
    const many: DocMeta[] = Array.from({ length: 3 }, (_, i) => ({
      slug: `doc-${i}`,
      fileName: `doc-${i}.md`,
      chapterSlug: "spot",
      title: `文档${i}`,
      description: "",
    }));
    render(<DocList metas={many} chapterSlug="spot" locale="zh" />);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });
});
