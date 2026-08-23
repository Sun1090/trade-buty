import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { LoginClient } from "@/components/login-client";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/auth">) {
  const { locale } = await params;
  return {
    title: getDict(locale).auth.title,
    // 功能页不应被搜索引擎收录
    robots: { index: false, follow: false },
  };
}

export default async function AuthPage({
  params,
}: PageProps<"/[locale]/auth">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const p = (path: string) => `/${locale}${path}`;

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <header className="mb-8 text-center">
        <div className="inline-flex items-center justify-center gap-2 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="4" y="7" width="4" height="10" rx="1" fill="#34d399" />
            <rect x="5.5" y="4" width="1" height="16" fill="#34d399" />
            <rect x="14" y="9" width="4" height="8" rx="1" fill="#f87171" />
            <rect x="15.5" y="6" width="1" height="14" fill="#f87171" />
          </svg>
          <span className="font-bold text-lg">Trade Buty</span>
        </div>
        <h1 className="text-3xl font-bold">{t.auth.title}</h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          {t.auth.subtitle}
        </p>
      </header>
      <LoginClient dict={t.auth} locale={locale} />
      <p className="mt-6 text-center text-xs text-faint leading-relaxed">
        {t.auth.guestHint}
      </p>
      <div className="mt-4 text-center">
        <a
          href={p("/")}
          className="text-sm text-accent underline underline-offset-4"
        >
          {t.auth.continueGuest}
        </a>
      </div>
    </div>
  );
}
