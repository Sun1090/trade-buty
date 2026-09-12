import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { resolveShareLanding } from "@/lib/share-landing";
import { getDict } from "@/lib/i18n";
import { ShareCardPreview } from "@/components/share-card-preview";
import { ShareLandingCtas } from "@/components/share-landing-ctas";
import { JsonLd } from "@/components/json-ld";
import { siteGraph, webPage } from "@/lib/jsonld";

interface RouteParams {
  kind: string;
  path: string;
}

/** R8.4 分享落地页：纯 SSR + OG meta + JSON-LD；客户端 share-card 仅做下载。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { kind, path } = await params;
  const resolved = resolveShareLanding(kind, path);
  if (!resolved) return { robots: { index: false, follow: false } };

  return buildPageMetadata({
    locale: resolved.locale,
    title: resolved.title,
    description: resolved.description,
    path: `/share/${resolved.kind}/${resolved.path}`,
    type: "website",
  });
}

export default async function ShareLandingPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { kind, path } = await params;
  // 路由 params 的 percent 解码在 page / generateMetadata 间不一致，统一走
  // resolveShareLanding 归一化，避免落地页 404 而 OG 图正常的分裂（见 share-landing.ts）。
  const resolved = resolveShareLanding(kind, path);
  if (!resolved) notFound();

  const { kind: shareKind, path: sharePath, locale, title, description } = resolved;
  const t = getDict(locale);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <JsonLd data={siteGraph(locale)} />
      <ShareCardPreview kind={shareKind} path={sharePath} locale={locale} labels={t.share} />

      {/* 站内 CTA：把访客引导进学习入口，而非冷冰冰的离开 */}
      <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-sm font-semibold">{t.share.ctaTitle}</p>
        <p className="mt-1 text-xs text-muted leading-relaxed">{t.share.ctaBody}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ShareLandingCtas
            card={shareKind}
            locale={locale}
            pathLabel={t.share.ctaPath}
            replayLabel={t.share.ctaReplay}
          />
        </div>
      </div>

      <JsonLd
        data={webPage({
          locale,
          title,
          description,
          pageHref: `/share/${shareKind}/${sharePath}`,
        })}
      />
    </div>
  );
}
