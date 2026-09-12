import type { Metadata } from "next";
import { getDict } from "./i18n";
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
  /**
   * 双语对应页（R10.23 hreflang）。key 为 locale（zh/en），value 为对应页
   * 站点内路径。只传「确实存在」的对应页——知识库翻译缺口时缺哪侧传哪侧；
   * 未传 = 页面不声明 alternate（维持单语 canonical）。
   * x-default 自动取 en（站内默认语言），en 缺失时回退 zh。
   */
  languages?: Partial<Record<"zh" | "en", string>>;
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
  languages,
}: BuildArgs): Metadata {
  const ogLocale = OG_LOCALES[locale] ?? "en_US";
  const altLocale = locale === "zh" ? "en_US" : "zh_CN";
  // canonical 始终指向本页 path（zh/en 是两份翻译正文，各自 canonical 到自身，
  // 用 hreflang languages 声明翻译配对，不交叉 canonical）
  const fullUrl = `${SITE_URL}${path}`;
  const alternates: Metadata["alternates"] = { canonical: path };
  if (languages && Object.keys(languages).length > 0) {
    alternates.languages = {
      ...languages,
      "x-default": languages.en ?? languages.zh ?? path,
    };
  }
  const base: Metadata = {
    title,
    description,
    alternates,
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

/**
 * R13.17：软 404（HTTP 200 + 404 文案）的 metadata。
 *
 * 章节/课程 slug 不存在时页面仍会渲染带推荐的 404 文案，但状态码是 200。
 * 这类页面必须自报 `noindex`，否则搜索引擎会当成真实页面收录；
 * 同时保留 `follow`，让爬虫继续沿推荐位抓到有效课程。
 * 不产出 canonical——指向一个不存在的 URL 只会制造重复信号。
 */
export function buildSoftNotFoundMetadata(locale: LocaleArg): Metadata {
  const t = getDict(locale);
  return {
    title: t.notFound.metaTitle,
    description: t.notFound.metaDescription,
    robots: { index: false, follow: true },
  };
}
