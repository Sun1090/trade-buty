import { SITE_URL } from "./site";

/**
 * Structured-data builders shared by server components and the build-time
 * regression gate. Keep entities small and factual: every node must describe
 * content that is visible on the page that emits it.
 */

const SCHEMA_CONTEXT = "https://schema.org";
const SITE_NAME = "Trade Buty";
const LOGO_URL = `${SITE_URL}/icon`;
const REPOSITORY_URL = "https://github.com/Sun1090/trade-buty";

export type StructuredDataLocale = "zh" | "en";

export interface BreadcrumbItem {
  name: string;
  href: string;
}

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

function inLanguage(locale: StructuredDataLocale): "zh-CN" | "en" {
  return locale === "zh" ? "zh-CN" : "en";
}

function absoluteUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  return `${SITE_URL}${href.startsWith("/") ? href : `/${href}`}`;
}

function organizationReference() {
  return { "@id": ORGANIZATION_ID };
}

function websiteId(locale: StructuredDataLocale): string {
  return `${SITE_URL}/${locale}#website`;
}

/**
 * Site-wide identity graph. Rendered once in the locale layout, so nested
 * nodes can refer to the Organization/WebSite by stable @id instead of
 * repeating conflicting inline entities.
 */
export function siteGraph(locale: StructuredDataLocale) {
  const homeUrl = absoluteUrl(`/${locale}`);

  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": ORGANIZATION_ID,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: LOGO_URL,
          width: 512,
          height: 512,
        },
        sameAs: [REPOSITORY_URL],
      },
      {
        "@type": "WebSite",
        "@id": websiteId(locale),
        url: homeUrl,
        name: SITE_NAME,
        inLanguage: inLanguage(locale),
        publisher: organizationReference(),
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${homeUrl}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/** BreadcrumbList：用于文档/章节页导航。 */
export function breadcrumbList(items: BreadcrumbItem[], pageHref?: string) {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    ...(pageHref ? { "@id": `${absoluteUrl(pageHref)}#breadcrumb` } : {}),
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.href),
    })),
  };
}

/** Course：用于章节页。hasPart 列出所有 lessons。 */
export function course(args: {
  locale: StructuredDataLocale;
  title: string;
  description: string;
  chapterHref: string;
  lessons: { title: string; href: string }[];
}) {
  const url = absoluteUrl(args.chapterHref);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Course",
    "@id": `${url}#course`,
    name: args.title,
    description: args.description,
    inLanguage: inLanguage(args.locale),
    isAccessibleForFree: true,
    provider: organizationReference(),
    url,
    hasPart: args.lessons.map((lesson) => ({
      "@type": "LearningResource",
      name: lesson.title,
      url: absoluteUrl(lesson.href),
      learningResourceType: "Lesson",
      isPartOf: { "@id": `${url}#course` },
    })),
  };
}

/** Quiz：用于随堂测挂载的章节。hasPart 列出所有题。 */
export function quiz(args: {
  locale: StructuredDataLocale;
  title: string;
  chapterHref: string;
  questions: { text: string }[];
}) {
  const url = absoluteUrl(args.chapterHref);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Quiz",
    "@id": `${url}#quiz`,
    name: args.title,
    inLanguage: inLanguage(args.locale),
    url,
    isPartOf: { "@id": `${url}#course` },
    hasPart: args.questions.map((question) => ({
      "@type": "Question",
      text: question.text,
    })),
  };
}

/** Article：用于课程正文页。 */
export function article(args: {
  locale: StructuredDataLocale;
  title: string;
  description: string;
  pageHref: string;
  chapterTitle?: string;
  chapterHref?: string;
}) {
  const url = absoluteUrl(args.pageHref);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Article",
    "@id": `${url}#article`,
    headline: args.title,
    description: args.description,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: organizationReference(),
    publisher: organizationReference(),
    inLanguage: inLanguage(args.locale),
    ...(args.chapterHref
      ? {
          isPartOf: {
            "@type": "Course",
            "@id": `${absoluteUrl(args.chapterHref)}#course`,
            name: args.chapterTitle,
          },
        }
      : {}),
  };
}

/** WebPage：用于分享等独立落地页。 */
export function webPage(args: {
  locale: StructuredDataLocale;
  title: string;
  description: string;
  pageHref: string;
}) {
  const url = absoluteUrl(args.pageHref);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebPage",
    "@id": url,
    url,
    name: args.title,
    description: args.description,
    inLanguage: inLanguage(args.locale),
    isPartOf: { "@id": websiteId(args.locale) },
    publisher: organizationReference(),
  };
}

/** FAQPage：问题与答案必须逐条来自页面上可见的 FAQ。 */
export function faqPage(
  locale: StructuredDataLocale,
  items: { question: string; answer: string }[],
) {
  const url = absoluteUrl(`/${locale}/faq`);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    url,
    inLanguage: inLanguage(locale),
    isPartOf: { "@id": websiteId(locale) },
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
