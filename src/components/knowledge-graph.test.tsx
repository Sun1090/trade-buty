// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Chapter } from "@/lib/content";
import type { Stage } from "@/lib/path";
import { getDict } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  getStageGroups: vi.fn(() => [] as { stage: Stage; chapters: Chapter[] }[]),
}));

vi.mock("@/lib/path", () => ({
  getStageGroups: mocks.getStageGroups,
}));

import { KnowledgeGraph } from "./knowledge-graph";

function chapter(slug: string, title: string, docCount: number): Chapter {
  return { slug, title, docCount, tagline: "" };
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
    expect(screen.getByText("入门基础篇")).toBeInTheDocument();
    expect(screen.getByText("交易实践篇")).toBeInTheDocument();
    expect(screen.getByText("期权策略篇")).toBeInTheDocument();
  });

  /**
   * 阶段名不许组件里再抄一套：同一页上方各节写的是 `t.path.stages`，
   * 图谱列头一旦自己起名（旧实现是「基础阶段 · 入门主线」），一页就有两个名字指同一批篇章。
   */
  for (const locale of ["zh", "en"] as const) {
    it(`${locale}：列头就是字典里的「站点 · 阶段名」`, () => {
      render(<KnowledgeGraph locale={locale} />);
      const s = getDict(locale).path.stages;
      for (const key of ["core", "practice", "deep"] as const) {
        expect(
          screen.getByText(`${s[key].label} · ${s[key].title}`, { exact: false })
        ).toBeInTheDocument();
      }
    });
  }

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
  });

  it("条长按「本章课数 ÷ 全图最多课数」量，三列共用一把尺", () => {
    // fixture 最大值 10：旧实现拿「每阶段几篇」（这里最大 2）当分母，四根条全被夹到 100%，
    // 于是「10 课」和「2 课」一样长——所以断言写的是比例，不只是顶不顶格。
    render(<KnowledgeGraph locale="zh" />);
    const widths = ["入门基础篇", "现货交易篇", "交易实践篇", "期权策略篇"].map((name) => {
      const link = screen.getByRole("link", { name: new RegExp(name) });
      const bar = link.querySelectorAll("span span")[0] as HTMLElement;
      return bar.style.width;
    });
    expect(widths).toEqual(["100%", "50%", "40%", "20%"]);
  });

  it("课数相同的篇章一样长，课数更多的更长（条长真的在数课）", () => {
    mocks.getStageGroups.mockReturnValue([
      {
        stage: { id: "core" as const, chapterNums: [] },
        chapters: [
          chapter("a", "甲篇", 20),
          chapter("b", "乙篇", 10),
          chapter("c", "丙篇", 10),
        ],
      },
    ]);
    render(<KnowledgeGraph locale="zh" />);
    const widthOf = (name: string) =>
      (
        screen
          .getByRole("link", { name: new RegExp(name) })
          .querySelectorAll("span span")[0] as HTMLElement
      ).style.width;
    expect(widthOf("乙篇")).toBe(widthOf("丙篇"));
    expect(parseFloat(widthOf("甲篇"))).toBeGreaterThan(parseFloat(widthOf("乙篇")));
  });

});
