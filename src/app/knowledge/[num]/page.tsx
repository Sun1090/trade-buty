import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getChapter, getChapterNums, getDocMetas, prepareForRender } from "@/lib/content";
import { QUIZZES } from "@/lib/quizzes";
import { Markdown } from "@/components/markdown";
import { Quiz } from "@/components/quiz";

export function generateStaticParams() {
  return getChapterNums().map((num) => ({ num }));
}

export async function generateMetadata({
  params,
}: PageProps<"/knowledge/[num]">): Promise<Metadata> {
  const { num } = await params;
  const data = getChapter(num);
  if (!data) return {};
  return {
    title: `${data.chapter.num} ${data.chapter.title}`,
    description: data.chapter.tagline,
  };
}

export default async function ChapterPage({
  params,
}: PageProps<"/knowledge/[num]">) {
  const { num } = await params;
  const data = getChapter(num);
  if (!data) notFound();
  const docs = getDocMetas(num);
  const { chapter, introContent } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="text-sm opacity-60 mb-6">
        <Link href="/" className="hover:opacity-100 hover:text-blue-500">
          学习路线
        </Link>
        <span className="mx-2">/</span>
        <span>{chapter.title}</span>
      </nav>

      <h1 className="text-3xl font-bold">
        <span className="font-mono opacity-40 mr-2">{chapter.num}</span>
        {chapter.title}
      </h1>

      {introContent && (
        <section className="mt-8 rounded-xl border border-black/10 dark:border-white/15 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-50 mb-3">
            篇章导语
          </h2>
          <Markdown content={prepareForRender(introContent, num)} />
        </section>
      )}

      {QUIZZES[num] && !QUIZZES[num].docSlug && (
        <section className="mt-12">
          <Quiz quiz={QUIZZES[num]} />
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-50 mb-4">
          本篇课程（{docs.length} 篇）
        </h2>
        <ol className="space-y-3">
          {docs.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/knowledge/${num}/${d.slug}`}
                className="block rounded-lg border border-black/10 dark:border-white/15 px-5 py-4 hover:border-blue-500/60 transition"
              >
                <span className="font-medium">{d.title}</span>
                {d.description && (
                  <p className="mt-1 text-sm opacity-60 line-clamp-2">{d.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
