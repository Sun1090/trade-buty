import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { HeroCard } from "@/components/hero-card";
import { PrivacyDataExport } from "@/components/privacy-data-export";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getDict(locale).pageMeta;
  return buildPageMetadata({
    locale,
    title: m.privacyTitle,
    description: m.privacyDesc,
    path: `/${locale}/privacy`,
    noindex: true,
  });
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-5 py-10 sm:py-14 space-y-6 text-sm text-muted leading-relaxed">
      <HeroCard label={locale === "en" ? "Your data" : "你的数据"} title={locale === "en" ? "Privacy Policy" : "隐私政策"}>
        {locale === "en" ? "Last updated: 2026" : "更新日期：2026 年"}
      </HeroCard>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Data We Collect" : "我们收集的数据"}</h2>
        <p>{locale === "en" ? "Trade Buty does not collect personal data. All learning progress (read status, quiz results, replay history) is stored locally in your browser's localStorage. No data is sent to our servers unless you choose to log in with email." : "Trade Buty 不收集个人数据。所有学习进度（已读状态、测验成绩、回放记录）仅存储在浏览器的 localStorage 中。除非你选择登录，否则不会向服务器发送任何数据。"}</p>
        <p>{locale === "en" ? "Share, invite and AI entry interactions may print a small allowlisted debug event to your browser's developer console. These events stay on your device, are not sent to us, and do not include raw invite codes, email addresses, chapter titles, full URLs or free text." : "分享、邀请和 AI 入口交互可能会在浏览器开发者控制台打印少量白名单 debug 事件。这些事件只留在你的设备上，不会发送给我们，也不包含原始邀请码、邮箱、章节标题、完整 URL 或自由文本。"}</p>
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
      <PrivacyDataExport locale={locale} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Data retention & cleanup" : "数据保留与清理"}</h2>
        <p>{locale === "en"
          ? "Local data lives only in your browser's localStorage and stays until you clear site data — nothing expires on the server because nothing lives on the server before you log in. Built-in trims keep the footprint small: the study-time ledger keeps the most recent 90 days and market replay history keeps the latest 100 rounds."
          : "本机数据只存活于浏览器 localStorage，直到你清除站点数据为止——未登录时服务器上没有任何数据，因此也没有服务端过期之说。为控制体积，学习时长台账仅保留最近 90 天，行情回放历史仅保留最近 100 轮。"}</p>
        <p>{locale === "en"
          ? "Cloud data (only after you log in) is kept while your account exists so learning progress survives across devices. Pending offline writes are retried until they sync or the account is removed. To delete everything, sign in and use the account menu → Delete account: it removes all cloud rows for your account (progress, mistake log, quiz scores, replay history, settings) and clears local data on that device."
          : "云端数据（仅在登录后存在）在你的账户存续期间保留，用于多设备同步；离线写入队列会持续重试，直到同步成功或账户被删除。如需彻底清理：登录后在账户菜单选择「删除账户」，将删除该账户的全部云端数据（进度、错题、测验成绩、回放历史、设置）并清除本机数据。"}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Contact" : "联系方式"}</h2>
        <p>{locale === "en" ? "For privacy concerns, open an issue at github.com/Sun1090/trade-buty." : "如有隐私相关问题，请在 github.com/Sun1090/trade-buty 提 issue。"}</p>
      </section>
    </div>
  );
}
