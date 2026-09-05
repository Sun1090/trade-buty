import { getChapters, getChapterSlugs, getDocMetas, type Chapter, type DocMeta } from "./content";
import type { SuggestibleItem } from "./url-suggest";

/**
 * R8.11 服务端辅助：组装语料。
 * 因为依赖 fs，放在 server-only 文件——客户端组件 import 根 url-suggest 时不会牵连。
 */
export function buildKnowledgeCorpus(locale: "zh" | "en"): SuggestibleItem[] {
  const items: SuggestibleItem[] = [];
  const chapters = getChapters(locale);
  const titleBySlug = new Map<string, string>(chapters.map((c: Chapter) => [c.slug, c.title]));
  for (const slug of getChapterSlugs(locale)) {
    items.push({
      slug,
      title: titleBySlug.get(slug) ?? slug,
      href: `/${locale}/knowledge/${slug}`,
    });
    const docs: DocMeta[] = getDocMetas(locale, slug);
    for (const d of docs) {
      items.push({
        slug: d.slug,
        title: d.title,
        href: `/${locale}/knowledge/${slug}/${d.slug}`,
      });
    }
  }
  return items;
}
