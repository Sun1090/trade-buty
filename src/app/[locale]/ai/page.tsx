import { notFound } from "next/navigation";
import { withChapterCount } from "@/lib/content";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { AiChat } from "@/components/ai-chat";
import { aiEnabledForPage } from "@/lib/ai-toggle";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/ai">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).ai;
  return buildPageMetadata({
    locale,
    title: t.label,
    description: withChapterCount(t.subtitle),
    path: `/${locale}/ai`,
    noindex: true,
  });
}

export default async function AiPage({
  params,
}: PageProps<"/[locale]/ai">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  // R3.9/R3.10：无 key 或总开关关闭时展示禁用态，不渲染 AI 入口
  if (!aiEnabledForPage()) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] items-center justify-center px-4">
        <p className="text-sm text-muted">🤖 {t.ai.aiDisabled}</p>
      </div>
    );
  }

  // dict 会原样交给客户端组件，所以 {chapters} 必须在这里代入——
  // 占位符漏到界面上，用户看到的就是「基于 {chapters} 篇章知识库」。
  return <AiChat locale={locale} dict={{ ...t.ai, subtitle: withChapterCount(t.ai.subtitle) }} />;
}
