import Link from "next/link";
import { getDocMetas } from "@/lib/content";

/**
 * 相关课程推荐：同篇章其他课程（除当前课外）
 * Server component，无需客户端逻辑
 */
export function RelatedCourses({
  locale,
  chapterSlug,
  currentDoc,
  exclude,
  label,
}: {
  locale: string;
  chapterSlug: string;
  currentDoc: string;
  exclude: string;
  label: string;
}) {
  const docs = getDocMetas(locale, chapterSlug)
    .filter((d) => d.slug !== currentDoc && d.slug !== exclude)
    .slice(0, 5);

  if (docs.length === 0) return null;

  return (
    <aside className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-4">{label}</p>
      <ul className="space-y-2">
        {docs.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/${locale}/knowledge/${chapterSlug}/${d.slug}`}
              className="flex items-center gap-2 text-sm text-muted hover:text-accent transition py-1"
            >
              <span className="text-accent" aria-hidden>→</span>
              {d.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}