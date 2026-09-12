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
        <p>{locale === "en" ? "If a page crashes or an action fails, your browser may send a minimal diagnostic signal to our own same-origin endpoint (/api/error-reports). It carries only a coarse level (fatal / recoverable), a fixed scope name (for example route-error), an error type name, and \u2014 for server-rendered crashes \u2014 Next.js\u0027s opaque digest hash. It never contains the error message, stack trace, page URL, account identity, or any free text you typed. These signals are written to short-lived server logs for debugging only: not stored in our database, not linked to your account, and not used for tracking or advertising." : "\u5f53\u9875\u9762\u5d29\u6e83\u6216\u64cd\u4f5c\u5931\u8d25\u65f6\uff0c\u4f60\u7684\u6d4f\u89c8\u5668\u53ef\u80fd\u4f1a\u5411\u672c\u7ad9\u540c\u6e90\u7aef\u70b9\uff08/api/error-reports\uff09\u53d1\u9001\u4e00\u6761\u6700\u5c0f\u5316\u8bca\u65ad\u4fe1\u53f7\uff1a\u4ec5\u5305\u542b\u7c97\u7c92\u5ea6\u7ea7\u522b\uff08fatal\uff0frecoverable\uff09\u3001\u56fa\u5b9a\u8303\u56f4\u540d\uff08\u5982 route-error\uff09\u3001\u9519\u8bef\u7c7b\u578b\u540d\uff0c\u4ee5\u53ca\u670d\u52a1\u7aef\u6e32\u67d3\u5d29\u6e83\u65f6 Next.js \u7684\u4e0d\u900f\u660e digest \u54c8\u5e0c\u3002\u5b83\u7edd\u4e0d\u5305\u542b\u9519\u8bef\u6b63\u6587\u3001\u5806\u6808\u3001\u9875\u9762 URL\u3001\u8d26\u53f7\u8eab\u4efd\uff0c\u6216\u4f60\u8f93\u5165\u7684\u4efb\u4f55\u81ea\u7531\u6587\u672c\u3002\u8fd9\u4e9b\u4fe1\u53f7\u53ea\u5199\u5165\u7528\u4e8e\u6392\u969c\u7684\u77ed\u671f\u670d\u52a1\u7aef\u65e5\u5fd7\uff1a\u4e0d\u5199\u5165\u6570\u636e\u5e93\u3001\u4e0d\u4e0e\u4f60\u7684\u8d26\u6237\u5173\u8054\uff0c\u4e5f\u4e0d\u7528\u4e8e\u8ffd\u8e2a\u6216\u5e7f\u544a\u3002"}</p>
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
          ? "Local data lives only in your browser's localStorage and stays until you clear site data. Before you log in our servers keep no personal profile — the only request that reaches us without an account is the anonymous crash diagnostic above, which is never persisted to the database. Built-in trims keep the local footprint small: the study-time ledger keeps the most recent 90 days and market replay history keeps the latest 100 rounds."
          : "本机数据只存活于浏览器 localStorage，直到你清除站点数据为止。未登录时服务器不保存任何个人资料——唯一在无账户时到达服务器的请求就是上方匿名崩溃诊断，它从不写入数据库。为控制本机体积，学习时长台账仅保留最近 90 天，行情回放历史仅保留最近 100 轮。"}</p>
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
