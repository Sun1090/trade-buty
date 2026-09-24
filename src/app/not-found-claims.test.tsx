// @vitest-environment jsdom
/**
 * 根级 404 的两句说法。
 *
 * 这一页在 `[locale]` 之外（R16.41 登记过：边界拿不到 params，只能按 `DEFAULT_LOCALE` 出静态一份），
 * 于是两件事一直没人核对：
 * ① 它替访客列出 6 张篇章卡与课文标题——那是内容，而内容红线要求带「⚠️ 风险提示」，
 *    页脚那句在 `[locale]/layout.tsx` 里，这一页拿不到（实测 `.next/server/app/_not-found.html`
 *    里「风险提示」0 次，而 `zh/changelog.html` 有）；
 * ② `suggestHint` 说「用下面搜索」，那颗搜索按钮却在这一栏的**上面**
 *    （`not-found.tsx` 的 CTA 行在 `NotFoundSuggestions` 之前）。
 * 第②条不写死方向词：从文案里抠出它承诺的方向，再拿 DOM 里的真实先后去对，
 * 所以「改文案不改结构」和「改结构不改文案」都会红。
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import NotFound from "./not-found";
import { getDict, DEFAULT_LOCALE } from "@/lib/i18n";

/**
 * `NotFoundSuggestions` 只有在 pathname 落在知识库路径下才渲染（R8.11），
 * 而 `suggestHint` 那句正是它的小标题——不把这个条件造出来，方向词根本没有可对的位置。
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/zh/knowledge/getting-started/no-such-doc",
}));

function pageText(): { text: string; container: HTMLElement; unmount: () => void } {
  const view = render(NotFound()) as unknown as {
    container: HTMLElement;
    unmount: () => void;
  };
  return {
    text: view.container.textContent ?? "",
    container: view.container,
    unmount: view.unmount,
  };
}

/** 文案里承诺的方向（zh 用「上面/下面」，en 用 above/below） */
const DIRECTION = /上面|下面|\babove\b|\bbelow\b/i;

describe("根级 404 的两处说法", () => {
  it("列出课文卡片的那一页带着风险提示", () => {
    const { text, container, unmount } = pageText();
    const disclaimer = getDict(DEFAULT_LOCALE).footer.disclaimer;
    expect(disclaimer, "页脚那句本身就应当带 ⚠️").toContain("⚠️");
    expect(text, "这一页在渲染知识库篇章卡，却没有风险提示块").toContain(disclaimer);
    // 正向对照：这一页确实出了篇章卡，否则上面那条只是「页面本来就空」
    expect(
      container.querySelectorAll('a[href^="/en/knowledge/"]').length,
    ).toBeGreaterThan(0);
    unmount();
  });

  it("禁令抓得住旧文案（旧写法承诺的方向与 DOM 相反）", () => {
    const legacyZh = "按你访问的地址猜的——如果不是你要的，用下面搜索：";
    const legacyEn = "Guessed from the URL you visited — search below if none fit:";
    for (const legacy of [legacyZh, legacyEn]) {
      const token = legacy.match(DIRECTION)?.[0] ?? "";
      expect(token.toLowerCase(), "旧写法抠不出方向词，这条对照是空转").toBeTruthy();
    }
  });

  it("「用上面/下面的搜索」指的方向就是按钮真的在的位置", () => {
    const hint = getDict(DEFAULT_LOCALE).notFound.suggestHint;
    const token = hint.match(DIRECTION)?.[0] ?? "";
    expect(token, `suggestHint 里没有方向词，那条断言无从核对：${hint}`).toBeTruthy();
    expect(
      [...(hint.match(new RegExp(DIRECTION.source, "gi")) ?? [])].length,
      "一句里出现两个方向词，抠出来的那个不能作数",
    ).toBe(1);

    const { container, unmount } = pageText();
    const searchLink = container.querySelector('a[href$="/search"]');
    expect(searchLink, "这一页没有搜索入口").toBeTruthy();
    // 文档序里祖先在前、后代在后，所以「最后一个含这句的元素」就是最内层那一个——
    // 拿外层容器来比位置会把它「包含」按钮这件事读成「按钮在下面」。
    const matches = Array.from(container.querySelectorAll("p,div,span")).filter((el) =>
      (el.textContent ?? "").includes(hint),
    );
    expect(matches.length, "渲染出来的正文里找不到 suggestHint 那句").toBeGreaterThan(0);
    const hintNode = matches[matches.length - 1];

    // DOCUMENT_POSITION_PRECEDING = 2：searchLink 在 hintNode 之前
    const preceding = 2;
    const linkIsAbove =
      (hintNode!.compareDocumentPosition(searchLink!) & preceding) === preceding;
    const promisesAbove = /上面|above/i.test(token);
    expect(
      promisesAbove,
      `按钮在提示${linkIsAbove ? "上方" : "下方"}，文案却写「${token}」`,
    ).toBe(linkIsAbove);
    unmount();
  });
});
