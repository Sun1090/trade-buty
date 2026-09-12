import type { Locale } from "@/lib/i18n";

const COPY = {
  zh: {
    title: "⚠️ 风险提示",
    body: "本站内容仅用于教育与研究，不构成任何投资建议。交易具有重大风险，亏损可能超过本金。",
  },
  en: {
    title: "⚠️ Risk Warning",
    body: "This content is for education and research only and is not investment advice. Trading involves significant risk, and losses may exceed your principal.",
  },
} as const;

/** 上游 README 缺少合规风险块时，在章节页展示的本地化兜底提示。 */
export function RiskWarningNotice({ locale }: { locale: Locale }) {
  const copy = COPY[locale];

  return (
    <aside
      role="note"
      aria-label={copy.title}
      className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5"
    >
      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
        {copy.title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{copy.body}</p>
    </aside>
  );
}
