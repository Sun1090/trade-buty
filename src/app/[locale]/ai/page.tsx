import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { AiChat } from "@/components/ai-chat";
import { aiEnabledForPage } from "@/lib/ai-toggle";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export function generateMetadata(): Metadata {
  // 功能页不收录
  return { robots: { index: false, follow: false } };
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

  return <AiChat locale={locale} dict={t.ai} />;
}
