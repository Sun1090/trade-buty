import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { AuthCallbackClient } from "@/components/auth-callback-client";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export function generateMetadata() {
  // 回调页是瞬态功能页，不应被收录
  return { robots: { index: false, follow: false } };
}

export default async function AuthCallbackPage({
  params,
}: PageProps<"/[locale]/auth/callback">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  return <AuthCallbackClient dict={t.auth} locale={locale} />;
}
