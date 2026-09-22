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
        <p>{locale === "en" ? "Trade Buty does not collect personal data. All learning progress (read status, quiz results, replay history) lives only in your browser's localStorage, and it stays there until you log in and sync it. Before you log in, exactly two kinds of requests reach our servers: the anonymous crash diagnostic described below (/api/error-reports) and the AI tutor you start on purpose (/api/ai/*, see the paragraph after it). Reading the lessons themselves sends us nothing." : "Trade Buty 不收集个人数据。所有学习进度（已读状态、测验成绩、回放记录）只存在你浏览器的 localStorage 里，不登录就不会同步到我们的服务器。未登录时到达服务器的请求只有两类：下方写明的匿名崩溃诊断（/api/error-reports），以及你主动使用的 AI 助学（/api/ai/*，见紧接着的下一段）。只是浏览课程页面不会向我们发送任何数据。"}</p>
        <p>{locale === "en" ? "Share, invite and AI entry interactions may print a small allowlisted debug event to your browser's developer console. These events stay on your device, are not sent to us, and do not include raw invite codes, email addresses, chapter titles, full URLs or free text." : "分享、邀请和 AI 入口交互可能会在浏览器开发者控制台打印少量白名单 debug 事件。这些事件只留在你的设备上，不会发送给我们，也不包含原始邀请码、邮箱、章节标题、完整 URL 或自由文本。"}</p>
        <p>{locale === "en" ? "If a page crashes or an action fails, your browser may send a minimal diagnostic signal to our own same-origin endpoint (/api/error-reports). It carries only a coarse level (fatal / recoverable), a fixed scope name (for example route-error), an error type name, and \u2014 for server-rendered crashes \u2014 Next.js\u0027s opaque digest hash. It never contains the error message, stack trace, page URL, account identity, or any free text you typed. These signals are written to short-lived server logs for debugging only: not stored in our database, not linked to your account, and not used for tracking or advertising." : "\u5f53\u9875\u9762\u5d29\u6e83\u6216\u64cd\u4f5c\u5931\u8d25\u65f6\uff0c\u4f60\u7684\u6d4f\u89c8\u5668\u53ef\u80fd\u4f1a\u5411\u672c\u7ad9\u540c\u6e90\u7aef\u70b9\uff08/api/error-reports\uff09\u53d1\u9001\u4e00\u6761\u6700\u5c0f\u5316\u8bca\u65ad\u4fe1\u53f7\uff1a\u4ec5\u5305\u542b\u7c97\u7c92\u5ea6\u7ea7\u522b\uff08fatal\uff0frecoverable\uff09\u3001\u56fa\u5b9a\u8303\u56f4\u540d\uff08\u5982 route-error\uff09\u3001\u9519\u8bef\u7c7b\u578b\u540d\uff0c\u4ee5\u53ca\u670d\u52a1\u7aef\u6e32\u67d3\u5d29\u6e83\u65f6 Next.js \u7684\u4e0d\u900f\u660e digest \u54c8\u5e0c\u3002\u5b83\u7edd\u4e0d\u5305\u542b\u9519\u8bef\u6b63\u6587\u3001\u5806\u6808\u3001\u9875\u9762 URL\u3001\u8d26\u53f7\u8eab\u4efd\uff0c\u6216\u4f60\u8f93\u5165\u7684\u4efb\u4f55\u81ea\u7531\u6587\u672c\u3002\u8fd9\u4e9b\u4fe1\u53f7\u53ea\u5199\u5165\u7528\u4e8e\u6392\u969c\u7684\u77ed\u671f\u670d\u52a1\u7aef\u65e5\u5fd7\uff1a\u4e0d\u5199\u5165\u6570\u636e\u5e93\u3001\u4e0d\u4e0e\u4f60\u7684\u8d26\u6237\u5173\u8054\uff0c\u4e5f\u4e0d\u7528\u4e8e\u8ffd\u8e2a\u6216\u5e7f\u544a\u3002"}</p>
        <p>{locale === "en"
          ? "The AI tutor works without an account, which makes it the only thing that sends what you type off your device before you log in: your question and the chapter you are reading are passed through our own server to the AI provider named under Third-Party Services. Conversations started while you are logged out are never written to our database. Two clicks are stored anonymously, though - rating one of the answers helpful or unhelpful saves that rating together with your question and the full answer text, and opening a citation in an answer saves the chapter or lesson it points to together with your question. These rows carry no account, no email address and no device identifier; they exist so a human can review answer quality."
          : "AI 助学不需要账户就能用，未登录时它是唯一会把「你输入的内容」送出设备的功能：你提问时，问题和你正在阅读的篇章会经本站服务器转发给「第三方服务」一节点名的 AI 服务商。未登录时开始的对话不会写入我们的数据库。只有两种点击会以匿名方式落库——给某条回答点「有用/没用」时，这次评分连同你的问题和该条回答全文一起写入；点开回答里的某条引用时，写入的是该引用指向的篇章/小节以及你的问题。这些行不带账户、不带邮箱、不带设备标识，只用于人工复核答案质量。"}</p>
        <p>{locale === "en" ? "When you log in via email magic link, your email address is stored by Supabase Auth (our authentication provider, hosted in the US). Your learning progress is synced to Supabase only to enable cross-device access." : "当你通过邮箱魔法链接登录时，你的邮箱地址由 Supabase Auth（我们的认证服务商，托管于美国）存储。学习进度同步到 Supabase 仅用于跨设备恢复。"}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Cookies" : "Cookie"}</h2>
        <p>{locale === "en" ? "We set one cookie ourselves (tb-lang) to remember your language preference. No tracking cookies, no analytics cookies, no third-party cookies. Once you are logged in, Supabase Auth stores one extra session cookie whose only job is to recognise you." : "本站自己只写入一个 cookie（tb-lang），用来记住你的语言偏好。没有追踪 cookie、没有分析 cookie、没有第三方 cookie。登录后 Supabase Auth 会另存一个会话 cookie，它只用于认出你已经登录。"}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Third-Party Services" : "第三方服务"}</h2>
        <p>{locale === "en" ? "Supabase (authentication + database) and Binance public API (market data). The AI features are not tied to one vendor: your question is forwarded from our own server to an OpenAI-compatible upstream, falling back in order across Zhipu GLM → DeepSeek → SenseNova (a preferred model can be configured), while RAG embedding lookups go to the same endpoint or a separately configured embedding service. What those upstreams receive is your question text and excerpts of the lessons being retrieved - never your email address or account identifier. Each service is contacted only when you use the corresponding feature." : "Supabase（认证+数据库）、Binance 公开 API（行情数据）。AI 功能不锁死单一厂商：你的提问由本站服务器转发给一个 OpenAI 兼容上游，按「智谱 GLM → DeepSeek → SenseNova」的顺序降级（首选模型可配置），RAG 的向量化走同一端点或单独配置的嵌入服务。这些上游收到的是你的提问文本与被检索到的课程片段，不含你的邮箱或账户标识。每项服务仅在你主动使用对应功能时才被调用。"}</p>
      </section>
      <PrivacyDataExport locale={locale} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Data retention & cleanup" : "数据保留与清理"}</h2>
        <p>{locale === "en"
          ? "Local data lives only in your browser's storage: learning records, the mistake log and settings sit in localStorage, while a few interface flags such as \"should this tip still show\" sit in sessionStorage and disappear when the tab closes (they are not part of your account data). Nothing is cleared from your side until you clear site data. Before you log in our servers keep no personal profile: crash diagnostics go to short-lived logs and never reach the database, and the anonymous AI feedback rows named above hold no account, email address or device identifier. Built-in trims keep the local footprint small: the study-time ledger keeps the most recent 90 days and market replay history keeps the latest 100 rounds."
          : "本机数据只存活在你浏览器的本地存储里：学习记录、错题本和设置在 localStorage，另有几个「这条提示还要不要显示」之类的界面状态写在 sessionStorage——关掉标签页就没有，也不属于账户数据。在你清除站点数据之前，这些都不会被动。未登录时服务器不保存任何个人资料：崩溃诊断只写入短期日志、从不写入数据库，上方那两类匿名 AI 反馈行也不含账户、邮箱或设备标识。为控制本机体积，学习时长台账仅保留最近 90 天，行情回放历史仅保留最近 100 轮。"}</p>
        <p>{locale === "en"
          ? "Cloud data (only after you log in) is kept while your account exists so learning progress survives across devices. Writes made while offline are queued and retried, but two things can stop a write from ever reaching the cloud, and they belong in this document: the queue holds at most 200 entries, and a 201st evicts the oldest one, which is then sent to the cloud only if you re-do that change (it stays in your browser's local data meanwhile); and switching to another account on the same device discards the previous account's still-unsent queue outright. To delete everything, sign in and use the account menu → Delete account: it removes every cloud row owned by your account - progress, mistake log, quiz scores, replay history and best streak, settings, AI conversations, and the ratings you gave AI answers - and clears local data on that device. One exception: citation clicks are detached from your account at that moment and kept as anonymous rows, holding only the chapter or lesson you opened and the question asked, which can no longer be tied back to you."
          : "云端数据（仅在登录后存在）在你的账户存续期间保留，用于多设备同步。断网时产生的写入会排队重试，但有两件事会让某条写入永远补传不上去，这里必须写明：队列最多 200 条，第 201 条会挤掉最旧的一条，被挤掉的那条写入不会再被重试（在那之前它只存在于本机的学习记录里，你要补上云端得重做那次操作）；在同一台设备上切换到另一个账户时，上一个账户尚未同步出去的队列会被直接清空。如需彻底清理：登录后在账户菜单选择「删除账户」，会删除该账户名下的全部云端数据——进度、错题本、测验成绩、回放历史与最佳连胜、设置、AI 对话记录，以及你给 AI 回答打过的评分——并清除本机数据。唯一例外：你点开过的 AI 引用记录会在那一刻摘掉账户标识、以匿名行保留，其中只有你打开的篇章/小节与当时的提问文本，且不再能对应回你。"}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "en" ? "Contact" : "联系方式"}</h2>
        <p>{locale === "en" ? "For privacy concerns, open an issue at github.com/Sun1090/trade-buty." : "如有隐私相关问题，请在 github.com/Sun1090/trade-buty 提 issue。"}</p>
      </section>
    </div>
  );
}
