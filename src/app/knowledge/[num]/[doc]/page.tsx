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
