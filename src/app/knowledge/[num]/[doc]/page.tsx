import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getAdjacentDocs,
  getChapter,
  getChapterNums,
  getDoc,
  getDocMetas,
  prepareForRender,
} from "@/lib/content";
import { Markdown } from "@/components/markdown";
import { Quiz } from "@/components/quiz";
import { QUIZZES } from "@/lib/quizzes";

export function generateStaticParams() {
  const params: { num: string; doc: string }[] = [];
  for (const num of getChapterNums()) {
    for (const doc of getDocMetas(num)) {
      params.push({ num, doc: doc.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: PageProps<"/knowledge/[num]/[doc]">): Promise<Metadata> {
  const { num, doc: docSlug } = await params;
  const doc = getDoc(num, docSlug);
  if (!doc) return {};
  return { title: doc.title, description: doc.description };
}

export default async function DocPage({
  params,
}: PageProps<"/knowledge/[num]/[doc]">) {
  const { num, doc: docSlug } = await params;
  const doc = getDoc(num, docSlug);
  if (!doc) notFound();
  const { prev, next } = getAdjacentDocs(num, docSlug);
  const chapter = getChapter(num)?.chapter;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="text-sm opacity-60 mb-6">
        <Link href="/" className="hover:text-blue-500">
          学习路线
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/knowledge/${num}`} className="hover:text-blue-500">
          {chapter?.title}
        </Link>
      </nav>

      <article>
        <h1 className="text-3xl font-bold mb-8">{doc.title}</h1>
        <Markdown content={prepareForRender(doc.content, num)} />
      </article>

      {QUIZZES[num]?.docSlug === docSlug && (
        <Quiz quiz={QUIZZES[num]} />
      )}

      {/* 边学边练 */}
      <aside className="mt-12 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-semibold">📖 学完这篇，去看真盘</p>
          <p className="mt-1 text-sm text-muted">
            {num === "06"
              ? "技术分析最好的老师是真实行情——对照刚学的形态和指标，去图上找一找。"
              : "在真实行情图表里找找这篇内容提到的概念，看懂了再继续。"}
          </p>
        </div>
        <Link
          href="/chart"
          className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2.5 transition shrink-0"
        >
          打开实时行情 →
        </Link>
      </aside>

      <nav className="mt-16 pt-6 border-t border-black/10 dark:border-white/15 grid gap-3 sm:grid-cols-2 text-sm">
        {prev ? (
          <Link
            href={`/knowledge/${num}/${prev.slug}`}
            className="rounded-lg border border-black/10 dark:border-white/15 px-4 py-3 hover:border-blue-500/60 transition"
          >
            <span className="block text-xs opacity-50">上一篇</span>
            {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            href={`/knowledge/${num}/${next.slug}`}
            className="rounded-lg border border-black/10 dark:border-white/15 px-4 py-3 hover:border-blue-500/60 transition sm:text-right"
          >
            <span className="block text-xs opacity-50">下一篇</span>
            {next.title}
          </Link>
        )}
      </nav>
    </div>
  );
}
