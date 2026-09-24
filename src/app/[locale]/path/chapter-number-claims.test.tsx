// @vitest-environment jsdom
/**
 * R16.120：一个篇章在页面上只顶着一个编号——标题自带的那个 `NN ·`。
 *
 * 改之前同一页并存三套序号，全都印在标题旁边（实测取值）：
 * - 入门主线时间轴用「路径第几位」：第 3 个圆点写 03，标题却是「04 · 股票篇」；
 * - 进阶/深潜卡片印 `chapterRank`（0 起）：trading-practice 路径第 10 位、写 09、标题「11 · 交易实战篇」；
 * - 知识点图谱按阶段各自从 01 数起：regulation-compliance 写 01、标题「16 · 监管与合规篇」；
 * - 首页那 6 张篇章卡印「首页第几张」（1–6）：第 3 张写 03、标题「04 · 股票篇」。
 * 而全站通用编号（篇章页 H1、面包屑、侧栏、分享卡、本页导语）就是标题里的 `NN ·`，
 * 于是导语说「主线最后一站『08 · 入土篇』」、它自己的圆点写 09。27 篇里有 19 篇两套号不一致。
 * 现在这些裸数字全部撤掉。
 *
 * 判据：凡是装着某个篇章标题的条目（`a` 或 `li`），里面不许有「文字只有一个数字」的元素。
 * 不认 className，也不管数字是序号还是第几位——重新加回来的任何一种写法都会撞上。
 * 顺带钉住 R16.55 的另一半：卡片课数得带单位词，「8 篇」退化成裸「8」同样在这里红。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import PathPage from "./page";
import HomePage from "../page";
import { getChapters } from "@/lib/content";

type Locales = "zh" | "en";

/** 扫过的条目少于这个数，说明渲染或知识库树变了，门禁自己先瞎 */
const MIN_ENTRIES = { path: 27, home: 6 };

async function renderPage(
  page: (props: never) => Promise<ReactElement>,
  locale: Locales
): Promise<HTMLElement> {
  const props = {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({}),
  };
  const view = render((await page(props as never)) as ReactElement) as unknown as {
    container: HTMLElement;
    unmount: () => void;
  };
  const container = view.container;
  expect(container.textContent, `${locale} 页面渲染为空`).not.toBe("");
  return container;
}

/** 页面上装着某个篇章标题的条目（卡片 / 时间轴行 / 图谱节点） */
function chapterEntries(container: HTMLElement, titles: string[]): Element[] {
  return Array.from(container.querySelectorAll("a, li")).filter((el) =>
    titles.some((t) => (el.textContent ?? "").includes(t))
  );
}

/** 条目里「只写着一个数字」的元素 = 第二个编号，正是这条门禁要禁的东西 */
function bareNumbers(container: HTMLElement, titles: string[]): string[] {
  const found: string[] = [];
  for (const entry of chapterEntries(container, titles)) {
    const label = (entry.textContent ?? "").trim().slice(0, 24);
    for (const child of Array.from(entry.querySelectorAll("*"))) {
      if (child.children.length > 0) continue;
      const text = (child.textContent ?? "").trim();
      if (/^\d{1,2}$/.test(text)) found.push(`${text} 挂在「${label}」上`);
    }
  }
  return found;
}

describe("篇章条目的编号只有一个", () => {
  for (const locale of ["zh", "en"] as const) {
    it(`路线页 ${locale}：条目上不挂第二个序号`, async () => {
      const titles = getChapters(locale).map((c) => c.title);
      const container = await renderPage(PathPage, locale);
      expect(
        chapterEntries(container, titles).length,
        "篇章条目数不足，门禁瞎了"
      ).toBeGreaterThanOrEqual(MIN_ENTRIES.path);
      expect(bareNumbers(container, titles), "标题旁又出现了第二个序号").toEqual([]);
    });

    it(`首页 ${locale}：篇章卡上不挂第二个序号`, async () => {
      const titles = getChapters(locale).map((c) => c.title);
      const container = await renderPage(HomePage, locale);
      expect(
        chapterEntries(container, titles).length,
        "首页篇章卡数不足"
      ).toBeGreaterThanOrEqual(MIN_ENTRIES.home);
      expect(bareNumbers(container, titles), "卡片上又出现了第二个序号").toEqual([]);
    });
  }

  it("「路径第几位」与「知识库编号」确实不是一套（否则上面的门禁没有意义）", () => {
    const numbers = getChapters("zh").map((c) => Number(c.title.slice(0, 2)));
    expect(numbers.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    const mismatched = numbers.filter((n, i) => n !== i + 1).length;
    expect(mismatched, `实测只有 ${mismatched} 篇两套号不同，门禁的靶子变了`).toBeGreaterThanOrEqual(19);
  });
});
