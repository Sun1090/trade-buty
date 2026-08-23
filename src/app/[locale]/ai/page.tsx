import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { AiChat } from "@/components/ai-chat";

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

  return <AiChat locale={locale} dict={t.ai} />;
}
