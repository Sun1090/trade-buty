import { SITE_URL } from "./site";

/**
 * R8.10：结构化数据 builder。
 * - 不依赖 React，可在 server 组件 / API route 复用
 * - 输出严格遵循 schema.org JSON-LD 字段（保留最小必要字段）
 * - 所有 URL 用 SITE_URL 拼全，避免搜索引擎识别错误
 */

export interface BreadcrumbItem {
  name: string;
  href: string;
}

/** BreadcrumbList：用于文档/章节页导航。 */
export function breadcrumbList(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.href}`,
    })),
  };
}

/** Course：用于章节页。hasPart 列出所有 lessons。 */
export function course(args: {
  locale: "zh" | "en";
  title: string;
  description: string;
  chapterHref: string;
  lessons: { title: string; href: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: args.title,
    description: args.description,
    inLanguage: args.locale === "zh" ? "zh-CN" : "en",
    provider: {
      "@type": "Organization",
      name: "Trade Buty",
      url: SITE_URL,
    },
    url: `${SITE_URL}${args.chapterHref}`,
    hasPart: args.lessons.map((l) => ({
      "@type": "LearningResource",
      name: l.title,
      url: `${SITE_URL}${l.href}`,
      learningResourceType: "Lesson",
    })),
  };
}

/** Quiz：用于随堂测挂载的章节。hasQuestion 列出所有题。 */
export function quiz(args: {
  locale: "zh" | "en";
  title: string;
  chapterHref: string;
  questions: { text: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Quiz",
    name: args.title,
    inLanguage: args.locale === "zh" ? "zh-CN" : "en",
    url: `${SITE_URL}${args.chapterHref}`,
    hasPart: args.questions.map((q) => ({
      "@type": "Question",
      text: q.text,
    })),
  };
}
