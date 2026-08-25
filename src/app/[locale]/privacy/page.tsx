import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  return { title: "Privacy Policy", robots: { index: false, follow: false } };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 py-10 space-y-6 text-sm text-muted leading-relaxed">
      <h1 className="text-2xl font-bold">{locale === "en" ? "Privacy Policy" : "隐私政策"}</h1>
      <p>{locale === "en" ? "Last updated: 2026" : "更新日期：2026 年"}</p>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Data We Collect" : "我们收集的数据"}</h2>
        <p>{locale === "en" ? "Trade Buty does not collect personal data. All learning progress (read status, quiz results, replay history) is stored locally in your browser's localStorage. No data is sent to our servers unless you choose to log in with email." : "Trade Buty 不收集个人数据。所有学习进度（已读状态、测验成绩、回放记录）仅存储在浏览器的 localStorage 中。除非你选择登录，否则不会向服务器发送任何数据。"}</p>
        <p>{locale === "en" ? "When you log in via email magic link, your email address is stored by Supabase Auth (our authentication provider, hosted in the US). Your learning progress is synced to Supabase only to enable cross-device access." : "当你通过邮箱魔法链接登录时，你的邮箱地址由 Supabase Auth（我们的认证服务商，托管于美国）存储。学习进度同步到 Supabase 仅用于跨设备恢复。"}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Cookies" : "Cookie"}</h2>
        <p>{locale === "en" ? "We use a single cookie (tb-lang) to remember your language preference. No tracking cookies, no analytics cookies, no third-party cookies." : "我们使用一个 cookie（tb-lang）来记住你的语言偏好。没有追踪 cookie、没有分析 cookie、没有第三方 cookie。"}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Third-Party Services" : "第三方服务"}</h2>
        <p>{locale === "en" ? "Supabase (authentication + database), Binance public API (market data), SenseNova (AI chat), SiliconFlow (AI embeddings). Each service is used only when you explicitly interact with the feature." : "Supabase（认证+数据库）、Binance 公开 API（行情数据）、SenseNova（AI 对话）、硅基流动（AI 向量化）。每项服务仅在你主动使用功能时调用。"}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Contact" : "联系方式"}</h2>
        <p>{locale === "en" ? "For privacy concerns, open an issue at github.com/Sun1090/trade-buty." : "如有隐私相关问题，请在 github.com/Sun1090/trade-buty 提 issue。"}</p>
      </section>
    </div>
  );
}