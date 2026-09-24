// @vitest-environment jsdom
/**
 * 面包屑第一格链到 `/${locale}`（首页），它写的字必须就是「首页」：
 * 同一页的 JSON-LD BreadcrumbList 早就把这个节点声明成首页了，人读的那一格却写着
 * 「学习路线」——那是 `/path` 的名字，链子指向的却是工作台。
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { getDict } from "@/lib/i18n";
import ChapterPage from "./page";

const CHAPTER = "getting-started";

async function rendered(locale: "zh" | "en") {
  const props = { params: Promise.resolve({ locale, chapter: CHAPTER }) } as PageProps<
    "/[locale]/knowledge/[chapter]"
  >;
  return render((await ChapterPage(props)) as ReactElement);
}

describe("章节页面包屑的第一格说的是它链去的那个页面", () => {
  for (const locale of ["zh", "en"] as const) {
    const t = getDict(locale).nav;

    it(`${locale}: 「${t.home}」这条链子指向 /${locale}，不挂 /path 的名字`, async () => {
      const { container } = await rendered(locale);
      const crumb = screen.getByRole("link", { name: t.home });
      expect(crumb.getAttribute("href")).toBe(`/${locale}`);
      // 首页那条链上不得再出现 /path 的名字（面包屑以外的区块不算）
      expect(crumb.textContent).toBe(t.home);
      expect(container.querySelector("nav")).not.toBeNull();
    });

    it(`${locale}: 页面自己的结构化数据与面包屑用同一个名字`, async () => {
      const { container } = await rendered(locale);
      const graphs = [...container.querySelectorAll('script[type="application/ld+json"]')].map((node) =>
        JSON.parse(node.textContent ?? "{}"),
      );
      const root = graphs
        .flatMap((g) => g.itemListElement ?? [])
        .find((e: { item?: unknown }) => typeof e.item === "string" && e.item.endsWith(`/${locale}`));
      expect(root, "JSON-LD 里必须有一个指向首页的面包屑节点").toBeDefined();
      expect(root.name, "结构化数据与人读的面包屑必须叫同一个名字").toBe(t.home);
    });
  }
});
