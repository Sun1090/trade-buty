import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getDict(locale).pageMeta;
  return buildPageMetadata({
    locale,
    title: m.termsTitle,
    description: m.termsDesc,
    path: `/${locale}/terms`,
    noindex: true,
  });
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-5 py-10 sm:py-14 space-y-6 text-sm text-muted leading-relaxed">
      <HeroCard label={locale === "en" ? "Your use" : "使用说明"} title={locale === "en" ? "Terms of Service" : "服务条款"}>
        {locale === "en" ? "Last updated: 2026" : "更新日期：2026 年"}
      </HeroCard>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Educational Purpose Only" : "仅限教育用途"}</h2>
        <p>{locale === "en" ? "Trade Buty provides educational content about trading and financial markets. Nothing on this site constitutes financial advice, investment recommendations, or solicitation to trade. All examples are for illustrative purposes only." : "Trade Buty 提供关于交易和金融市场的教育内容。本站任何内容均不构成财务建议、投资推荐或交易招揽。所有示例仅供说明用途。"}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "No Liability" : "免责声明"}</h2>
        <p>{locale === "en" ? "Trading financial instruments carries significant risk. You alone are responsible for your trading decisions. Trade Buty, its contributors, and maintainers assume no liability for any losses incurred." : "交易金融工具具有重大风险。你独自承担交易决策的责任。Trade Buty 及其贡献者和维护者不对任何损失承担责任。"}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Open Source" : "开源许可"}</h2>
        <p>{locale === "en" ? "The source code is MIT licensed. Content is sourced from kline-buty under the same license. You may use, modify, and distribute freely." : "源代码基于 MIT 许可。内容来自 kline-buty，同样 MIT 许可。你可以自由使用、修改和分发。"}</p>
      </section>
    </div>
  );
}
