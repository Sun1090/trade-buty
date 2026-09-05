import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getDict(locale).pageMeta;
  return buildPageMetadata({
    locale,
    title: m.aboutTitle,
    description: m.aboutDesc,
    path: `/${locale}/about`,
    noindex: true,
  });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const en = locale === "en";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 py-10 space-y-8">
      <HeroCard label="About" title={en ? "About Trade Buty" : "关于 Trade Buty"}>
        {en ? "A free & neutral trading education platform." : "一个免费中立的交易教育平台。"}
      </HeroCard>
      <section className="prose-sm space-y-4 text-muted leading-relaxed">
        <p>{en ? "Trade Buty is a free, open-source trading education platform built for Chinese speakers worldwide. Our mission is to provide structured, neutral, and practical trading knowledge — without selling courses, giving stock tips, or promising returns." : "Trade Buty 是一个面向全球中文用户的免费开源交易教育平台。我们提供结构化、中立、实战导向的交易知识——不卖课、不荐股、不承诺收益。"}</p>
        <p>{en ? "Content is organized into 27 chapters covering everything from market basics to advanced trading strategies. Each chapter includes theory, real-world K-line chart practice, and quizzes to test your understanding." : "内容分为 27 个篇章，涵盖从市场基础到高级交易策略的完整知识体系。每章包含理论、真实 K 线图练习和测验。"}</p>
        <p>{en ? "Built with Next.js, TypeScript, and Tailwind CSS. Knowledge base sourced from kline-buty. All content is MIT licensed." : "基于 Next.js + TypeScript + Tailwind CSS。知识库来自 kline-buty。所有内容 MIT 许可。"}</p>
      </section>
    </div>
  );
}