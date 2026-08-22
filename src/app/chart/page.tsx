import type { Metadata } from "next";
import { KlineChart } from "@/components/kline-chart";

export const metadata: Metadata = {
  title: "实时行情",
  description: "真实加密货币行情 K 线图，配合课程学习使用。数据来自币安公开 API。",
};

export default function ChartPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <header className="max-w-xl mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Practice
        </p>
        <h1 className="text-3xl font-bold mt-3">真实行情图表</h1>
        <p className="mt-3 text-muted leading-relaxed">
          学完概念，来这里看真盘。对照「06 · 技术分析篇」练习识别 K
          线形态与指标——先看懂，再谈操作。
        </p>
      </header>
      <KlineChart />
    </div>
  );
}
