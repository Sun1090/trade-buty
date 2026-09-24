// @vitest-environment jsdom
/**
 * R16.121：Quiz 结构化数据只由真正渲染这套题的那一页发出。
 *
 * `jsonld.ts` 开头写的规矩是「每个节点都得描述发它的那一页上看得见的内容」，
 * 而篇章页曾经无条件发一个 `Quiz` 节点（27 篇全中），把整套题的题干列在自己名下——
 * 它页面那张卡片只是个入口，一道题都不渲染；测验实际挂在 `QUIZZES[章节].docSlug`
 * 那一节课的末尾（实测 27 套题库全部如此）。搜索引擎按章节页的声明去找「页面上的测验」，
 * 找到的是一句「N 题 →」。
 *
 * 现在两边都按 `quizHostDocSlug()` 判断：宿主课文页发，篇章页和其他课文页都不发。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import ChapterPage from "./[chapter]/page";
import DocPage from "./[chapter]/[doc]/page";
import { QUIZZES, QUIZ_BANK_LANGUAGE, quizHostDocSlug } from "@/lib/quizzes";
import { getDocMetas } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

type Node = Record<string, unknown>;

// jsdom 没有 IntersectionObserver；课文页里的目录/进度组件用它只做高亮
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", ObserverStub);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const HOSTED = Object.keys(QUIZZES).filter((slug) => quizHostDocSlug(slug) !== null);

async function chapterHtml(locale: "zh" | "en", chapter: string): Promise<string> {
  const props = {
    params: Promise.resolve({ locale, chapter }),
  } as PageProps<"/[locale]/knowledge/[chapter]">;
  const view = render((await ChapterPage(props)) as ReactElement);
  const html = scriptsOf(view.container);
  view.unmount();
  return html;
}

async function docHtml(locale: "zh" | "en", chapter: string, doc: string): Promise<string> {
  const props = {
    params: Promise.resolve({ locale, chapter, doc }),
  } as PageProps<"/[locale]/knowledge/[chapter]/[doc]">;
  const view = render((await DocPage(props)) as ReactElement);
  const html = scriptsOf(view.container);
  view.unmount();
  return html;
}

function scriptsOf(container: HTMLElement): string {
  return [...container.querySelectorAll('script[type="application/ld+json"]')]
    .map((s) => s.textContent ?? "")
    .join("\n");
}

function quizNodes(html: string): Node[] {
  // serializeJsonLd 把 `<>&` 转成 \\u003c 之类的合法 JSON 转义，JSON.parse 认得，不用还原
  return html
    .split("\n")
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as Node)
    .filter((node) => node["@type"] === "Quiz");
}

describe("Quiz 结构化数据跟着渲染走", () => {
  it("27 套题库都有宿主课文，而且宿主真的存在（否则结构化数据指向 404）", () => {
    expect(Object.keys(QUIZZES).length).toBeGreaterThanOrEqual(27);
    const missing = HOSTED.filter(
      (slug) =>
        !getDocMetas("zh", slug).some((d) => d.slug === quizHostDocSlug(slug))
    );
    expect(missing, "这些篇章的测验挂在不存在的课文上").toEqual([]);
    expect(HOSTED.length).toBeGreaterThanOrEqual(27);
  });

  for (const locale of ["zh", "en"] as const) {
    it(`${locale}：篇章页只给入口，不宣称本页有整套题`, async () => {
      for (const chapter of ["getting-started", "trading-system", "options-strategies"]) {
        const html = await chapterHtml(locale, chapter);
        expect(quizNodes(html), `${locale}/${chapter} 篇章页发了 Quiz`).toEqual([]);
        // 入口卡片本身要在（否则这条断言只是页面没渲染出来）
        expect(html).toContain("Course");
      }
    });

    it(`${locale}：宿主课文页发 Quiz，且实体指向自己这一页`, async () => {
      const chapter = "getting-started";
      const host = quizHostDocSlug(chapter)!;
      const html = await docHtml(locale, chapter, host);
      const [node] = quizNodes(html);
      expect(node, `${locale}/${chapter}/${host} 应当发一个 Quiz`).toBeTruthy();
      expect(node!.inLanguage).toBe(QUIZ_BANK_LANGUAGE);
      expect(node!.url).toBe(`${SITE_URL}/${locale}/knowledge/${chapter}/${host}`);
      expect(node!["@id"]).toBe(`${SITE_URL}/${locale}/knowledge/${chapter}/${host}#quiz`);
      expect((node!.isPartOf as Node)["@id"]).toBe(
        `${SITE_URL}/${locale}/knowledge/${chapter}#course`
      );
      expect((node!.hasPart as unknown[]).length).toBe(QUIZZES[chapter]!.questions.length);
    });

    it(`${locale}：同章其他课文不替宿主认领这套题`, async () => {
      const chapter = "getting-started";
      const host = quizHostDocSlug(chapter)!;
      const other = getDocMetas(locale, chapter).find((d) => d.slug !== host);
      expect(other, "这一章至少要有两节课").toBeTruthy();
      expect(quizNodes(await docHtml(locale, chapter, other!.slug))).toEqual([]);
    });
  }
});
