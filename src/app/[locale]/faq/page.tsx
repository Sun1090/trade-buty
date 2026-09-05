import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/faq">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getDict(locale).pageMeta;
  return buildPageMetadata({
    locale,
    title: m.faqTitle,
    description: m.faqDesc,
    path: `/${locale}/faq`,
    noindex: true,
  });
}

const FAQ_ZH = [
  { q: "Trade Buty 是免费的吗？", a: "完全免费，开源（MIT 许可），不卖课、不荐股、不承诺收益。基础课程永远免费。" },
  { q: "需要注册才能学习吗？", a: "不需要。所有课程、图表、回放、测验都可以游客身份使用，数据存在浏览器本地。登录只是为了跨设备同步进度。" },
  { q: "我的学习进度存在哪？", a: "默认存在浏览器的 localStorage。登录后，进度会同步到 Supabase 云端，换设备也不丢。" },
  { q: "内容来自哪里？", a: "知识库来自 kline-buty 开源项目，27 个篇章覆盖从入门到期权策略的完整交易知识体系。" },
  { q: "图表是实时行情吗？", a: "是的，使用 Binance 公开 API 获取实时 K 线数据，支持 BTC/ETH/BNB/SOL 四个币种。" },
  { q: "回放训练是什么？", a: "选取历史行情，逐根 K 线回放，你判断涨跌方向。系统根据正确率、连击数评分，难度可选。" },
  { q: "AI 陪学怎么用？", a: "每篇课程页面底部有 AI 对话入口，可以提问课程相关问题。AI 会基于知识库内容回答，不荐股、不预测。" },
  { q: "AI 章节摘要是怎么生成的？", a: "篇章页的「AI 章节摘要」卡片，点击后会用 RAG 检索本章内容，由 AI 生成一段导语。生成后缓存在本地。" },
  { q: "支持哪些语言？", a: "中文和英文。默认英文，可在右上角切换。英文内容正在翻译中，部分章节可能仍是中文。" },
  { q: "数据安全吗？", a: "不收集追踪数据。只有登录邮箱（Supabase Auth）和学习进度（Supabase Postgres，受 RLS 行级安全保护）。详见隐私政策。" },
];

export default async function FaqPage({ params }: PageProps<"/[locale]/faq">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const en = locale === "en";

  const faqs = en
    ? [
        { q: "Is Trade Buty free?", a: "Completely free, open-source (MIT licensed). No courses sold, no stock tips, no returns promised. Core courses are free forever." },
        { q: "Do I need to register to learn?", a: "No. All courses, charts, replay, and quizzes work as a guest. Data is stored locally in your browser. Login is only for cross-device sync." },
        { q: "Where is my progress stored?", a: "In your browser's localStorage by default. When logged in, progress syncs to Supabase cloud — survives device changes." },
        { q: "Where does the content come from?", a: "From kline-buty open-source project. 27 chapters cover the full trading knowledge system from basics to options strategies." },
        { q: "Is the chart real-time?", a: "Yes, using Binance public API for live candlestick data. Supports BTC/ETH/BNB/SOL." },
        { q: "What is replay training?", a: "Historical market data is played back one candle at a time. You predict up/down. Scored by accuracy and streak. Difficulty selectable." },
        { q: "How does AI tutoring work?", a: "Each lesson page has an AI chat at the bottom. Ask questions about the content. AI answers based on the knowledge base — no tips, no predictions." },
        { q: "How are AI chapter summaries generated?", a: "The 'AI Chapter Summary' card on chapter pages uses RAG to retrieve chapter content, then AI generates a one-paragraph intro. Cached locally." },
        { q: "What languages are supported?", a: "Chinese and English. Default is English, switchable in the top right. English content is being translated — some chapters may still be in Chinese." },
        { q: "Is my data safe?", a: "No tracking data collected. Only your email (Supabase Auth) and learning progress (Supabase Postgres, RLS-protected). See Privacy Policy." },
      ]
    : FAQ_ZH;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-5 py-10 sm:py-14">
      <HeroCard label="FAQ" title={en ? "Frequently Asked Questions" : "常见问题"} />
      <ul className="space-y-6">
        {faqs.map((item, i) => (
          <li key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="font-semibold text-sm mb-2">{en ? "Q" : "问"}：{item.q}</p>
            <p className="text-sm text-muted leading-relaxed">{en ? "A" : "答"}：{item.a}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
