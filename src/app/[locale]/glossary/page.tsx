import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/lib/i18n";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Glossary", robots: { index: false, follow: false } };
}

interface Term { term: string; en: string; def: string; }

const TERMS: Term[] = [
  { term: "做多", en: "Long", def: "买入看涨资产，期望价格上涨后卖出获利。" },
  { term: "做空", en: "Short", def: "卖出看跌资产（借入后卖出），期望价格下跌后买回获利。" },
  { term: "杠杆", en: "Leverage", def: "用借来的资金放大仓位，同倍放大盈亏与爆仓风险。" },
  { term: "止损", en: "Stop Loss", def: "预设的平仓价格，到达时自动卖出，限制亏损。" },
  { term: "止盈", en: "Take Profit", def: "预设的平仓价格，到达时自动卖出，锁定利润。" },
  { term: "K 线", en: "Candlestick", def: "记录一段时间内开盘价、最高价、最低价、收盘价的图表元素。" },
  { term: "订单簿", en: "Order Book", def: "交易所的买单和卖单列表，反映实时供需。" },
  { term: "滑点", en: "Slippage", def: "下单价格与实际成交价格的差异。" },
  { term: "爆仓", en: "Liquidation", def: "杠杆亏损导致保证金不足，仓位被交易所强制平仓。" },
  { term: "保证金", en: "Margin", def: "开杠杆仓位所需的抵押资金。" },
  { term: "现货", en: "Spot", def: "即时交割的资产交易，买入即拥有。" },
  { term: "合约", en: "Futures/Perpetual", def: "约定未来交割的衍生品，可做多做空带杠杆。" },
  { term: "永续合约", en: "Perpetual", def: "无到期日的期货合约，通过资金费率锚定现货价。" },
  { term: "资金费率", en: "Funding Rate", def: "永续合约多空双方定期支付的费率，维持价格锚定。" },
  { term: "成交量", en: "Volume", def: "一段时间内交易的资产数量，衡量市场活跃度。" },
  { term: "流动性", en: "Liquidity", def: "市场快速买卖且不显著影响价格的能力。" },
  { term: "支撑位", en: "Support", def: "价格下跌时可能止跌的价位，买盘聚集。" },
  { term: "阻力位", en: "Resistance", def: "价格上涨时可能受阻的价位，卖盘聚集。" },
  { term: "趋势", en: "Trend", def: "价格持续朝一个方向运动的倾向。" },
  { term: "回撤", en: "Drawdown", def: "从最高点到后续低点的价格下跌幅度。" },
];

export default async function GlossaryPage({ params }: PageProps<"/[locale]/glossary">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const en = locale === "en";

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-5 py-10 sm:py-14">
      <HeroCard label={en ? "Glossary" : "术语表"} title={en ? "Trading Glossary" : "交易术语表"}>
        {en ? "Common terms used across the course." : "课程中常见的交易术语。"}
      </HeroCard>
      <div className="grid gap-3 sm:grid-cols-2">
        {TERMS.map((t) => (
          <div key={t.en} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-semibold text-sm">{en ? t.en : t.term}</span>
              <span className="text-xs text-faint font-mono">{en ? t.term : t.en}</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">{t.def}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
