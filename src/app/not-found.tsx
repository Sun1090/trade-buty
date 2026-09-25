import Link from "next/link";
import { getChapters } from "@/lib/content";
import { knowledgeHref } from "@/lib/hrefs";
import { DEFAULT_LOCALE, getDict } from "@/lib/i18n";
import { buildKnowledgeCorpus } from "@/lib/url-suggest-server";
import { NotFoundSuggestions } from "@/components/not-found-suggestions";

// 根级 404：无 locale 上下文 → 默认 locale；客户端组件读 pathname 再做距离推荐
export default function NotFound() {
  const t = getDict(DEFAULT_LOCALE);
  const corpus = buildKnowledgeCorpus(DEFAULT_LOCALE);
  const starters = getChapters(DEFAULT_LOCALE).slice(0, 6);

  return (
    <div className="relative mx-auto max-w-3xl px-5 py-20 text-center overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(52,211,153,.08), transparent 70%)",
        }}
        aria-hidden
      />
      <p className="relative font-mono text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-accent to-[var(--info)]">404</p>
      <h1 className="mt-6 text-2xl font-bold">
        Page not found
        <span className="block mt-2 text-sm font-normal text-muted">
          市场永远都在，页面不一定。
        </span>
      </h1>
      <div className="mt-10 flex flex-wrap justify-center gap-3" data-testid="root-no-result-cta">
        <Link
          href={`/${DEFAULT_LOCALE}/search`}
          className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-7 py-3 transition"
        >
          🔍 {t.notFound.searchCta}
        </Link>
        <Link
          href={`/${DEFAULT_LOCALE}`}
          className="rounded-full border border-border-strong px-7 py-3 font-medium hover:border-accent/60 transition"
        >
          {t.notFound.homeCta}
        </Link>
        <Link
          href={`/${DEFAULT_LOCALE}/path`}
          className="rounded-full border border-border-strong px-7 py-3 font-medium hover:border-accent/60 transition"
        >
          {t.notFound.pathCta}
        </Link>
      </div>

      {/* R8.11：URL 推荐位（客户端组件：按地址排得出推荐才显示；排不出就整栏不渲染，
          由下方「从这几篇开始」兜底——那一栏才是与地址无关的固定列表） */}
      <NotFoundSuggestions
        corpus={corpus}
        heading={t.notFound.suggestTitle}
        subheading={t.notFound.suggestHint}
      />

      {starters.length > 0 && (
        <div className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-faint mb-6">
            {t.notFound.popularStarters}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {starters.map((c, index) => (
              <Link
                key={index}
                href={knowledgeHref(DEFAULT_LOCALE, c.slug)}
                className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-left hover:border-[var(--accent)]/50 transition"
              >
                <p className="font-semibold text-sm group-hover:text-accent transition-colors">
                  {c.title}
                </p>
                <p className="mt-1 text-xs text-faint line-clamp-2">
                  {c.tagline}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/*
        * 这一页在 `[locale]` 之外，页脚那句风险提示到不了这里（`src/app/layout.tsx` 没有页脚），
        * 而它替访客列出 6 张篇章卡与课文标题——那就是内容。红线要求「每篇内容带风险提示」，
        * 由 `src/app/not-found-claims.test.tsx` 钉住这一句真的在场。
        */}
      <p className="relative mt-16 text-xs text-faint">{t.footer.disclaimer}</p>
    </div>
  );
}
