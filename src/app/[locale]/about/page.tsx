import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { HeroCard } from "@/components/hero-card";
import { NewsletterSignup } from "@/components/newsletter-signup";

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


      <section className="prose-sm space-y-4 text-muted leading-relaxed border-t border-[var(--border)] pt-8">
        <h2 className="text-base font-semibold text-foreground">
          {en ? "Support & neutrality" : "支持我们与中立承诺"}
        </h2>
        <p>
          {en
            ? "Trade Buty is independent. We don't run ads, sell courses, recommend brokers, or accept donations. The project is maintained by volunteers and funded only by the team's own time. If you find it useful, the best support is to star the repo, share it with a friend who's learning trading, or report an issue that improves the content."
            : "Trade Buty 保持独立。我们不接受广告、不卖课、不导流券商、不接受任何形式的捐赠。项目由志愿者用业余时间维护。如果你觉得本站有用，最好的支持是给仓库点个 ★、把它推荐给也在学交易的朋友，或者在 GitHub 提一个能改进内容的 issue。"}
        </p>
        <p className="text-xs text-faint">
          {en
            ? "Why no donations? Accepting money would compromise the platform's neutrality. A paid platform could be pressured into softening risk warnings or adding affiliate links. We chose to stay free instead."
            : "为什么不接受捐赠？一旦收钱，平台的中立性就会面临压力——付费方可能要求弱化风险提示、插入券商导流。我们宁愿保持免费。"}
        </p>
      </section>

      <section>
        <NewsletterSignup
          labels={getDict(locale).newsletter}
          locale={locale === "en" ? "en" : "zh"}
        />
      </section>
    </div>
  );
}