// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import {
  CELEBRATION_EMOJIS,
  CELEBRATION_FRESH_WINDOW_MS,
  ChapterCompleteCelebration,
} from "./chapter-complete-celebration";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

/** 写入「本机在 at 时刻读完 b 篇」的完成台账，键格式与 src/lib/progress.ts 一致。 */
function seedCompletion(chapter: string, doc: string, at: number) {
  store.set(
    "tb-progress-completions",
    JSON.stringify({ [`${chapter}:${doc}`]: { chapter, doc, at } }),
  );
}

describe("ChapterCompleteCelebration (R12.18)", () => {
  beforeEach(() => {
    store.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("emoji set stays learning-neutral: no profit/bull-market/holding hints", () => {
    const forbidden = ["📈", "💎", "🚀", "💰", "🤑", "🐂", "🌕"];
    for (const glyph of forbidden) {
      expect(CELEBRATION_EMOJIS).not.toContain(glyph);
    }
    expect(CELEBRATION_EMOJIS.length).toBeGreaterThan(0);
  });

  it("shows neutral localized copy when mounted on a just-completed chapter, never when incomplete", async () => {
    // 未完成：挂载不庆祝
    store.set("tb-progress", JSON.stringify({ "getting-started": ["a"] }));
    const first = render(<ChapterCompleteCelebration chapterSlug="getting-started" docSlugs={["a", "b"]} locale="zh" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    first.unmount();

    // 刚完成（读完最后一篇后导航回章节页，本机台账里有一条几秒前的记录）：
    // 庆祝，但文案只肯定学习完成
    store.set("tb-progress", JSON.stringify({ "getting-started": ["a", "b"] }));
    seedCompletion("getting-started", "b", Date.now());
    render(<ChapterCompleteCelebration chapterSlug="getting-started" docSlugs={["a", "b"]} locale="zh" />);
    expect(screen.getByRole("status")).toHaveTextContent("篇章完成！");
    expect(screen.queryByText(/盈利|收益|赚|胜率|profit|gain|return/i)).not.toBeInTheDocument();

    // 3 秒后自动消失
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // 「进度是满的」不等于「刚刚完成」：按前者判定会让用户几周后随便点开一篇已学完的
  // 篇章目录页时再放一次礼花，对着早已完成的成就喊「篇章完成！」是假反馈。
  it("回访早已学完的篇章不再庆祝", () => {
    store.set("tb-progress", JSON.stringify({ "getting-started": ["a", "b"] }));
    seedCompletion(
      "getting-started",
      "b",
      Date.now() - CELEBRATION_FRESH_WINDOW_MS - 60_000,
    );
    render(<ChapterCompleteCelebration chapterSlug="getting-started" docSlugs={["a", "b"]} locale="zh" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // 登录换设备时进度会从云端补回来，本机却没有阅读时间戳——那不是在设备上刚读完的
  it("云端同步来、本机没有阅读记录的进度不庆祝", () => {
    store.set("tb-progress", JSON.stringify({ "getting-started": ["a", "b"] }));
    render(<ChapterCompleteCelebration chapterSlug="getting-started" docSlugs={["a", "b"]} locale="zh" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // 真实流程是「读完最后一篇 → 几秒后回到章节页」，但用户也可能先去做点别的：
  // 窗口取到 10 分钟，9 分钟前刚读完的回来仍然要庆祝。
  it("窗口内（10 分钟前刚读完）仍然庆祝", () => {
    store.set("tb-progress", JSON.stringify({ "getting-started": ["a", "b"] }));
    seedCompletion("getting-started", "b", Date.now() - 9 * 60_000);
    render(<ChapterCompleteCelebration chapterSlug="getting-started" docSlugs={["a", "b"]} locale="zh" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // R16.57：本组件曾经自己 JSON.parse 原始存储再取 `.length`，绕开了 readProgress() 的归一化。
  // 字符串也有 `.length`：{"getting-started": "ab"} 在它眼里是「读了 2 篇」，于是别处都显示
  // 0/2 未完成时，这里对着一个坏掉的存储值放礼花。
  it("存储值不是数组时不庆祝（不是这一章读完了，是数据坏了）", () => {
    store.set("tb-progress", JSON.stringify({ "getting-started": "ab" }));
    seedCompletion("getting-started", "b", Date.now());
    render(<ChapterCompleteCelebration chapterSlug="getting-started" docSlugs={["a", "b"]} locale="zh" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // R16.57：0 课的篇章（英文章节回填中、或课文被整章撤下）没有「读完」可言。
  // 少了 docCount > 0 这一条，0 >= 0 会为真，台账里残留的旧阅读记录就够放一次礼花。
  it("0 课的篇章不庆祝", () => {
    store.set("tb-progress", JSON.stringify({ "getting-started": [] }));
    seedCompletion("getting-started", "removed-lesson", Date.now());
    render(<ChapterCompleteCelebration chapterSlug="getting-started" docSlugs={[]} locale="zh" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // R16.122：封顶挡不住「旧键顶上新课数」。这一章现在有 7 篇，存储里只有 2 篇是真的、
  // 另外 5 个是改课留下的废键：封顶 min(7 个键, 7 篇) = 7/7 会放礼花，
  // 而同一页课文清单只勾着 2/7。清单看得见课表，庆祝就必须按同一张课表数。
  it("存储里有废键顶出的『满读数』时不庆祝", () => {
    store.set(
      "tb-progress",
      JSON.stringify({
        "getting-started": ["a", "b", "旧-1", "旧-2", "旧-3", "旧-4", "旧-5"],
      }),
    );
    seedCompletion("getting-started", "旧-5", Date.now());
    render(
      <ChapterCompleteCelebration
        chapterSlug="getting-started"
        docSlugs={["a", "b", "c", "d", "e", "f", "g"]}
        locale="zh"
      />
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("把废键换成第 7 篇真课的键之后才庆祝", () => {
    store.set(
      "tb-progress",
      JSON.stringify({ "getting-started": ["a", "b", "c", "d", "e", "f", "g"] }),
    );
    seedCompletion("getting-started", "g", Date.now());
    render(
      <ChapterCompleteCelebration
        chapterSlug="getting-started"
        docSlugs={["a", "b", "c", "d", "e", "f", "g"]}
        locale="zh"
      />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("auto-dismisses after the animation window", async () => {
    store.set("tb-progress", JSON.stringify({ c: ["a"] }));
    seedCompletion("c", "a", Date.now());
    render(<ChapterCompleteCelebration chapterSlug="c" docSlugs={["a"]} locale="en" />);
    expect(screen.getByRole("status")).toHaveTextContent("Chapter complete!");
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
