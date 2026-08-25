"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocalProgress } from "@/components/use-local-progress";

interface DocMeta { slug: string; title: string; }
interface Chapter { slug: string; title: string; docs: DocMeta[]; }

/** 今日推荐：从第一章未读课程中挑第一篇 */
export function TodayPick({
  chapters,
  locale,
  label,
  hint,
  done,
}: {
  chapters: Chapter[];
  locale: string;
  label: string;
  hint: string;
  done: string;
}) {
  const progress = useLocalProgress();
  const [pick, setPick] = useState<{ chapter: string; doc: string; title: string; chapterTitle: string } | null>(null);

  useEffect(() => {
    for (const ch of chapters) {
      const read = new Set(progress?.[ch.slug] ?? []);
      const unread = ch.docs.find((d) => !read.has(d.slug));
      if (unread) {
        setPick({ chapter: ch.slug, doc: unread.slug, title: unread.title, chapterTitle: ch.title });
        return;
      }
    }
    // 全部已读，推荐第一章第一篇
    const first = chapters[0]?.docs[0];
    if (first) {
      setPick({ chapter: chapters[0].slug, doc: first.slug, title: first.title, chapterTitle: chapters[0].title });
    }
  }, [progress, chapters]);

  if (!pick) return null;

  return (
    <Link
      href={`/${locale}/knowledge/${pick.chapter}/${pick.doc}`}
      className="mt-6 block rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-5 hover:border-accent/50 transition"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        {label}
      </p>
      <p className="mt-2 font-semibold">{pick.title}</p>
      <p className="mt-1 text-sm text-muted">{hint} · {pick.chapterTitle}</p>
    </Link>
  );
}
