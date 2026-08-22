import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

function CandleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="7" width="4" height="10" rx="1" fill="#34d399" />
      <rect x="5.5" y="4" width="1" height="16" fill="#34d399" />
      <rect x="14" y="9" width="4" height="8" rx="1" fill="#f87171" />
      <rect x="15.5" y="6" width="1" height="14" fill="#f87171" />
    </svg>
  );
}

export function generateStaticParams() {
  return [{ locale: "zh" }, { locale: "en" }];
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const p = (path: string) => `/${locale}${path}`;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-5 h-14 sm:h-16 flex items-center justify-between">
          <Link href={p("/")} className="flex items-center gap-2 font-bold tracking-tight">
            <CandleMark />
            <span className="text-lg min-[420px]:inline hidden">{t.brand.name}</span>
            <span className="hidden lg:inline ml-1 px-2 py-0.5 rounded-full border border-[var(--accent)]/40 text-[11px] font-medium text-accent">
              {t.brand.badge}
            </span>
          </Link>
          <nav className="text-sm flex items-center gap-0.5 sm:gap-1">
            <Link
              href={p("/path")}
              className="px-2 sm:px-3 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition whitespace-nowrap"
            >
              {t.nav.path}
            </Link>
            <Link
              href={p("/chart")}
              className="px-2 sm:px-3 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition whitespace-nowrap"
            >
              {t.nav.chart}
            </Link>
            <Link
              href={p("/search")}
              className="px-2 sm:px-3 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition whitespace-nowrap"
            >
              {t.nav.search}
            </Link>
            <LanguageToggle />
            <ThemeToggle />
            <a
              href="https://github.com/Sun1090/trade-buty"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition hidden min-[420px]:block"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--border)] mt-24">
        <div className="mx-auto max-w-6xl px-5 py-10 grid gap-8 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3 max-w-md">
            <div className="flex items-center gap-2 font-bold">
              <CandleMark />
              {t.brand.name}
            </div>
            <p className="text-sm leading-relaxed text-muted">{t.footer.tagline}</p>
            <p className="text-xs leading-relaxed text-faint">{t.footer.disclaimer}</p>
          </div>
          <div className="text-sm space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-3">
              {t.footer.navHeading}
            </p>
            <Link href={p("/path")} className="block text-muted hover:text-accent transition">
              {t.nav.path}
            </Link>
            <Link href={p("/chart")} className="block text-muted hover:text-accent transition">
              {t.nav.chart}
            </Link>
            <Link href={p("/search")} className="block text-muted hover:text-accent transition">
              {t.nav.search}
            </Link>
            <a
              href="https://github.com/sun1090/kline-buty"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-muted hover:text-accent transition"
            >
              {t.footer.source}
            </a>
          </div>
        </div>
        <div className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-6xl px-5 py-4 text-xs text-faint flex flex-wrap justify-between gap-2">
            <span>{t.footer.copyright}</span>
            <span>{t.footer.source}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
