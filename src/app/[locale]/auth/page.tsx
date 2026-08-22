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
  return { title: getDict(locale).auth.title };
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
