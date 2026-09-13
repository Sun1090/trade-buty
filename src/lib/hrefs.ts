const SAFE_LOCALE = /^(?:zh|en)$/;
const SAFE_PATH_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

function isSafePathSegment(segment: string): boolean {
  return SAFE_PATH_SEGMENT.test(segment);
}

/**
 * Build a knowledge route from validated, file-backed slugs.
 *
 * Knowledge-base slugs are English identifiers, never arbitrary user input. Keeping that
 * contract here prevents a malformed chapter/doc name from becoming a URL scheme or path
 * traversal when it is rendered as an `href` by a server or client component.
 */
export function knowledgeHref(locale: string, chapter: string, doc?: string): string {
  if (!SAFE_LOCALE.test(locale)) {
    throw new Error(`Invalid locale: ${JSON.stringify(locale)}`);
  }

  const segments = doc === undefined ? [chapter] : [chapter, doc];
  for (const segment of segments) {
    if (!isSafePathSegment(segment)) {
      throw new Error(`Invalid knowledge path segment: ${JSON.stringify(segment)}`);
    }
  }

  return `/${locale}/knowledge/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}
