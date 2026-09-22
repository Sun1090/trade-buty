import { notFound } from "next/navigation";
import { withChapterCount } from "@/lib/content";
import {
  CHART_QUICK_SYMBOLS,
  REPLAY_SYMBOLS,
  sameSymbolSet,
  symbolListLabel,
} from "@/lib/chart-symbols";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { HeroCard } from "@/components/hero-card";
import { JsonLd } from "@/components/json-ld";
import { faqPage } from "@/lib/jsonld";

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

/** 回放与图表快捷按钮是否同一批标的：相同就别把名单念第二遍 */
const REPLAY_SAME_AS_CHART = sameSymbolSet(REPLAY_SYMBOLS, CHART_QUICK_SYMBOLS);

const REPLAY_SCOPE_ZH = REPLAY_SAME_AS_CHART
  ? `回放训练只用上面这 ${REPLAY_SYMBOLS.length} 个，暂时不能自定义标的。`
  : `回放训练只做 ${symbolListLabel(REPLAY_SYMBOLS)} 共 ${REPLAY_SYMBOLS.length} 个标的，不能自定义。`;

const REPLAY_SCOPE_EN = REPLAY_SAME_AS_CHART
  ? `Replay training uses only those ${REPLAY_SYMBOLS.length} pairs; custom symbols are not available there yet.`
  : `Replay training covers ${REPLAY_SYMBOLS.length} symbols (${symbolListLabel(REPLAY_SYMBOLS)}), with no custom symbol.`;

const FAQ_ZH = [
  { q: "Trade Buty 是免费的吗？", a: "完全免费，开源（MIT 许可），不卖课、不荐股、不承诺收益。基础课程永远免费。" },
  { q: "需要注册才能学习吗？", a: "不需要。所有课程、图表、回放、测验都可以游客身份使用，数据存在浏览器本地。登录只是为了跨设备同步进度。" },
  { q: "我的学习进度存在哪？", a: "默认存在浏览器的 localStorage。登录后，进度会同步到 Supabase 云端，换设备也不丢。" },
  { q: "内容来自哪里？", a: "知识库来自 kline-buty 开源项目，{chapters} 个篇章覆盖从入门到期权策略的完整交易知识体系。" },
  { q: "图表是实时行情吗？", a: `是的，K 线数据来自 Binance 公开 API。图表提供 ${symbolListLabel(CHART_QUICK_SYMBOLS)} 共 ${CHART_QUICK_SYMBOLS.length} 个快捷币对，也可以直接输入任意以 USDT 计价的币安现货交易对。${REPLAY_SCOPE_ZH}` },
  { q: "回放训练是什么？", a: "选取历史行情，逐根 K 线回放，你判断涨跌方向。系统根据正确率、连击数评分，难度可选。" },
  { q: "AI 陪学怎么用？", a: "每篇课程页面底部有 AI 对话入口，可以提问课程相关问题。AI 会基于知识库内容回答，不荐股、不预测。" },
  { q: "AI 章节摘要是怎么生成的？", a: "篇章页的「AI 章节摘要」卡片，点击后会用 RAG 检索本章内容，由 AI 生成一段导语。生成后缓存在本地。" },
  { q: "支持哪些语言？", a: "中文和英文。默认英文，可在右上角切换。英文内容正在翻译中，部分章节可能仍是中文。" },
  { q: "数据安全吗？", a: "不收集追踪数据、没有追踪 cookie。服务器上可能存在三类内容：登录邮箱（Supabase Auth）、你选择同步的学习进度（Supabase Postgres，受 RLS 行级安全保护），以及 AI 回答评分与引用点击产生的匿名记录（不关联账户）。细节见隐私政策。" },
];

export default async function FaqPage({ params }: PageProps<"/[locale]/faq">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const en = locale === "en";

  const chosen = en
    ? [
        { q: "Is Trade Buty free?", a: "Completely free, open-source (MIT licensed). No courses sold, no stock tips, no returns promised. Core courses are free forever." },
        { q: "Do I need to register to learn?", a: "No. All courses, charts, replay, and quizzes work as a guest. Data is stored locally in your browser. Login is only for cross-device sync." },
        { q: "Where is my progress stored?", a: "In your browser's localStorage by default. When logged in, progress syncs to Supabase cloud — survives device changes." },
        { q: "Where does the content come from?", a: "From kline-buty open-source project. {chapters} chapters cover the full trading knowledge system from basics to options strategies." },
        { q: "Is the chart real-time?", a: `Yes — candlestick data comes from Binance's public API. The chart has ${CHART_QUICK_SYMBOLS.length} quick pairs (${symbolListLabel(CHART_QUICK_SYMBOLS)}) and accepts any Binance spot pair quoted in USDT that you type in. ${REPLAY_SCOPE_EN}` },
        { q: "What is replay training?", a: "Historical market data is played back one candle at a time. You predict up/down. Scored by accuracy and streak. Difficulty selectable." },
        { q: "How does AI tutoring work?", a: "Each lesson page has an AI chat at the bottom. Ask questions about the content. AI answers based on the knowledge base — no tips, no predictions." },
        { q: "How are AI chapter summaries generated?", a: "The 'AI Chapter Summary' card on chapter pages uses RAG to retrieve chapter content, then AI generates a one-paragraph intro. Cached locally." },
        { q: "What languages are supported?", a: "Chinese and English. Default is English, switchable in the top right. English content is being translated — some chapters may still be in Chinese." },
        { q: "Is my data safe?", a: "No tracking data and no tracking cookies. Three things can exist on our servers: your login email (Supabase Auth), the learning progress you choose to sync (Supabase Postgres, RLS-protected), and anonymous rows created when you rate an AI answer or open one of its citations, which carry no account. See the Privacy Policy." },
      ]
    : FAQ_ZH;
  // 篇章总数由知识库现算，文案里只留 {chapters} 占位符
  const faqs = chosen.map((item) => ({ q: withChapterCount(item.q), a: withChapterCount(item.a) }));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-5 py-10 sm:py-14">
      <JsonLd
        data={faqPage(
          locale,
          faqs.map((item) => ({ question: item.q, answer: item.a })),
        )}
      />
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
