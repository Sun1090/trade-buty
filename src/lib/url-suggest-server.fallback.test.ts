import { describe, expect, it, vi } from "vitest";
import { buildKnowledgeCorpus } from "./url-suggest-server";

const getChapters = vi.fn().mockImplementation(() => [] as Array<{ slug: string; title: string }>);
const getChapterSlugs = vi.fn().mockImplementation(() => [] as string[]);
const getDocMetas = vi.fn().mockImplementation(() => [] as Array<{ slug: string; title: string }>);

vi.mock("./content", () => ({
  getChapters: (locale: string) => getChapters(locale),
  getChapterSlugs: (locale: string) => getChapterSlugs(locale),
  getDocMetas: (locale: string, chapterSlug: string) => getDocMetas(locale, chapterSlug),
}));

describe("buildKnowledgeCorpus fallback", () => {
  it("章节缺少 title 时回退到 slug", () => {
    getChapters.mockReturnValueOnce([]);
    getChapterSlugs.mockReturnValueOnce(["missing-title"]);
    getDocMetas.mockReturnValueOnce([]);
    expect(buildKnowledgeCorpus("zh")).toEqual([
      { slug: "missing-title", title: "missing-title", href: "/zh/knowledge/missing-title" },
    ]);
  });
});
