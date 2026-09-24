// @vitest-environment jsdom
/**
 * 「本页目录」里每一条链子都必须落在页面上真实存在的标题上。
 *
 * 目录的 id 曾经是从**未经转换**的课文原文里提取的，正文渲染的却是转换后的那份：
 * 转换器把 `<KbBadge t="最基础" />` 换成「【最基础】」，标题于是从
 * `多头long-做多buy-long` 变成 `多头long-做多buy-long-最基础`，
 * 目录点下去哪里也不去——而 AGENTS.md 写着「锚点链接必须滚到真正的目标标题」。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import DocPage from "./page";

// jsdom 没有 IntersectionObserver；目录组件用它只做高亮，与锚点是否存在无关
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

/** 课文标题里带 `<KbBadge>` 的三篇——正是原文与转换后文本会分叉的那一类 */
const DOCS = ["getting-started/core-concepts", "getting-started/order-types-execution", "trading-system/risk-management"];

async function rendered(locale: "zh" | "en", docPath: string) {
  const [chapter, doc] = docPath.split("/");
  const props = { params: Promise.resolve({ locale, chapter, doc }) } as PageProps<
    "/[locale]/knowledge/[chapter]/[doc]"
  >;
  return render((await DocPage(props)) as ReactElement);
}

describe("课文目录的锚点指向页面上真正的标题", () => {
  for (const locale of ["zh", "en"] as const) {
    for (const docPath of DOCS) {
      it(`${locale}/${docPath}：目录里每个 #id 都能在正文里找到`, async () => {
        const { container } = await rendered(locale, docPath);
        const tocLinks = [
          ...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label] a[href^="#"]'),
          ...container.querySelectorAll<HTMLAnchorElement>('details a[href^="#"]'),
        ];
        expect(tocLinks.length, "这一篇有三节以上标题，目录应当渲染出来").toBeGreaterThan(0);
        const dead = tocLinks
          .map((a) => a.getAttribute("href") ?? "")
          .filter((href) => container.querySelector(`[id="${href.slice(1)}"]`) === null);
        expect(dead, "目录指向了页面上不存在的锚点").toEqual([]);
      });

      it(`${locale}/${docPath}：正文里每个 h2/h3 都在目录里有一份，文字与标题一致`, async () => {
        const { container } = await rendered(locale, docPath);
        const article = container.querySelector("article");
        expect(article).not.toBeNull();
        const tocTexts = new Set(
          [
            ...container.querySelectorAll<HTMLAnchorElement>('nav[aria-label] a[href^="#"]'),
            ...container.querySelectorAll<HTMLAnchorElement>('details a[href^="#"]'),
          ].map((a) => (a.textContent ?? "").trim()),
        );
        const missing = [...article!.querySelectorAll("h2, h3")]
          .map((h) => (h.textContent ?? "").trim())
          .filter((text) => text && !tocTexts.has(text));
        expect(missing, "正文标题没能原样出现在目录里").toEqual([]);
      });
    }
  }
});
