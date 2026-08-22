import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { AuthCallbackClient } from "@/components/auth-callback-client";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function AuthCallbackPage({
  params,
}: PageProps<"/[locale]/auth/callback">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  return <AuthCallbackClient dict={t.auth} locale={locale} />;
}
