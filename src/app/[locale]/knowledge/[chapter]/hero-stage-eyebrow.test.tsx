// @vitest-environment jsdom
/**
 * R16.123：篇章页顶上的眉标只能说它自己站得稳的事。
 *
 * 那个位置曾经写着 `t.chapter.progressLabel`＝「篇章进度 / Chapter progress」，
 * 而它底下只有标题、导语和「📚 N 课」——进度在更下面的课文清单里（doc-list 的 `2/7`）
 * 和右侧栏的进度卡里，这个区块一个进度都不显示。
 * 现在眉标报的是这一篇属于哪一阶段，取值与 `/path` 的分层表、阶段名同一个所有者。
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";

import ChapterPage from "./page";
import { getDict } from "@/lib/i18n";
import { stageOfChapter } from "@/lib/path";

/** 三个阶段各取一篇 */
const CHAPTERS = ["getting-started", "trading-practice", "options-strategies"];

describe("篇章页眉标", () => {
  for (const locale of ["zh", "en"] as const) {
    for (const chapter of CHAPTERS) {
      it(`${locale}/${chapter}：眉标就是它在 /path 里的那一阶段`, async () => {
        const stage = stageOfChapter(chapter);
        expect(stage, `${chapter} 没登记进 /path 的分层表`).not.toBeNull();
        const t = getDict(locale);
        const label = `${t.path.stages[stage!].label} · ${t.path.stages[stage!].title}`;
        const { container } = render(
          (await ChapterPage({
            params: Promise.resolve({ locale, chapter }),
          } as PageProps<"/[locale]/knowledge/[chapter]">)) as ReactElement
        );
        // 眉标要真的渲染出来（exact:false：文本前后还有 · 与空白）
        expect(screen.getByText(label, { exact: false })).toBeInTheDocument();
        // 反向断言：这一页任何一段落都不许整段写着「篇章进度」——
        // 那个词原来的位置（标题区）根本没有进度，进度在课文清单的 `2/7` 和右侧栏卡片里。
        expect(
          [...container.querySelectorAll("section p")].some(
            (p) => p.textContent?.trim() === t.chapter.progressLabel
          ),
          `${chapter} 的标题区仍写着「${t.chapter.progressLabel}」`
        ).toBe(false);
      });
    }
  }
});
