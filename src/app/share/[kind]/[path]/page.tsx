import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { classifyShareLanding } from "@/lib/share-landing";
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
  const resolved = classifyShareLanding(kind, path);
  // 两种失败都要 noindex，但只有「真·错路由」才不带标题——它没有内容可标题化。
  if (resolved.status === "unknown-kind") return { robots: { index: false, follow: false } };
  if (resolved.status === "broken-payload") {
    // 口径照 `buildSoftNotFoundMetadata`（R13.17）：**不产出 canonical**——载荷坏了就没有
    // 「这条链接指向什么」可声明，指向 `/share/{kind}/` 那种不存在的地址只会制造重复信号。
    // `follow` 保留，让爬虫继续沿这一页的出口抓到有效课程。
    return {
      title: resolved.title,
      description: resolved.description,
      robots: { index: false, follow: true },
    };
  }

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
  const resolved = classifyShareLanding(kind, path);
  if (resolved.status === "unknown-kind") notFound();

  const t = getDict(resolved.locale);

  /**
   * R16.332：kind 合法但载荷解不开——过去这里也 `notFound()`，用户看到的是通用
   * 「Page not found」，而字典里那句「链接无效——分享链接已损坏或版本不匹配」
   * （中英齐全）连同 `ShareCardPreview` 的三处 invalid 分支一起成了不可达代码。
   * 这里**不渲染卡片预览**：载荷解不开时 canvas 永远画不出来，留着只会一直显示
   * 「正在生成预览…」这个假状态。给的是成因、站内出口与风险提示。
   */
  if (resolved.status === "broken-payload") {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <JsonLd data={siteGraph(resolved.locale)} />
        <h1 className="text-2xl font-bold sm:text-3xl">{resolved.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{resolved.description}</p>
        <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold">{t.share.ctaTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t.share.ctaBody}</p>
          <div className="mt-4 flex flex-wrap gap-3" data-testid="share-invalid-cta">
            <ShareLandingCtas
              card={resolved.kind}
              locale={resolved.locale}
              pathLabel={t.share.ctaPath}
              replayLabel={t.share.ctaReplay}
            />
          </div>
        </div>
        {/* 内容红线：这一页同样是公开可访问的落地页，风险提示不许因为「它是个错误页」而缺席。 */}
        <p className="mt-6 text-xs leading-relaxed text-faint">{t.footer.disclaimer}</p>
      </main>
    );
  }

  const { kind: shareKind, path: sharePath, locale, title, description } = resolved;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
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

      {/* 内容红线：分享落地页在 `[locale]` 布局之外，全站页脚的风险提示覆盖不到这里。 */}
      <p className="mt-6 text-xs leading-relaxed text-faint">{t.footer.disclaimer}</p>

      <JsonLd
        data={webPage({
          locale,
          title,
          description,
          pageHref: `/share/${shareKind}/${sharePath}`,
        })}
      />
    </main>
  );
}
