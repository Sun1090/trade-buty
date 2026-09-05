import type { Metadata } from "next";
import { SITE_URL } from "./site";

/**
 * R8.9：社交元标签工厂。
 *
 * 现状问题：根 layout 有默认 OG/Twitter，但子页 generateMetadata 只设了
 * title/description/alternates——子页的 OG/Twitter 字段全部继承根默认，
 * 而根默认是中文版固定文案，en 页 OG/Twitter 描述仍是中文。
 *
 * 解法：所有子页统一通过 buildPageMetadata 构造完整 Metadata，
 * 让 OG/Twitter 文案跟 locale 走。
 */

const OG_LOCALES: Record<string, string> = {
  zh: "zh_CN",
  en: "en_US",
};

type LocaleArg = "zh" | "en";
interface BuildArgs {
  locale: LocaleArg;
  /** 已剥掉站点后缀的 title（不带「 · Trade Buty」后缀） */
  title: string;
  description: string;
  /** 站点内路径（含 locale 前缀），如 `/zh/path`。用于 canonical + og:url */
  path: string;
  /** og:type 默认 website；课程/文档页用 article */
  type?: "website" | "article";
  /** 是否禁止收录（noindex）。默认 false。 */
  noindex?: boolean;
  /** 文章发布时间（ISO 字符串）。仅 article 类型有意义 */
  publishedTime?: string;
  /** 文章修改时间（ISO 字符串） */
  modifiedTime?: string;
}

export function buildPageMetadata({
  locale,
  title,
  description,
  path,
  type = "website",
  noindex = false,
  publishedTime,
  modifiedTime,
}: BuildArgs): Metadata {
  const ogLocale = OG_LOCALES[locale] ?? "en_US";
  const altLocale = locale === "zh" ? "en_US" : "zh_CN";
  // canonical 始终指向传入的 path（不切换 alternate hreflang——双语切换由前端 LanguageToggle 完成）
  const fullUrl = `${SITE_URL}${path}`;
  const base: Metadata = {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type,
      siteName: "Trade Buty",
      title,
      description,
      url: fullUrl,
      locale: ogLocale,
      alternateLocale: [altLocale],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
  if (noindex) {
    base.robots = { index: false, follow: false };
  }
  // 仅 article 类型挂载时间字段
  if (type === "article") {
    base.openGraph = {
      ...base.openGraph,
      type: "article",
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
    };
  }
  return base;
}

/** 把 `zh` / `en` 收敛成字面量，避免传任意字符串。 */
export function isOgLocale(v: string): v is "zh" | "en" {
  return v === "zh" || v === "en";
}
