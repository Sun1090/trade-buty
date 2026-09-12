/** Pure helpers for the R13.16 JSON-LD build regression gate. */

const SCRIPT_RE =
  /<script\b[^>]*\btype=(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;
const SCHEMA_CONTEXT = "https://schema.org";
const URL_FIELDS = new Set(["@id", "url", "item", "urlTemplate"]);

export const REQUIRED_SITE_TYPES = ["WebSite", "EducationalOrganization"];

export function extractJsonLd(html) {
  const scripts = [];
  let match;
  while ((match = SCRIPT_RE.exec(html)) !== null) {
    const raw = match[2].trim();
    try {
      scripts.push({ raw, document: JSON.parse(raw), error: null });
    } catch (error) {
      scripts.push({
        raw,
        document: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return scripts;
}

export function collectNodes(document) {
  const nodes = [];
  const seen = new Set();

  function visit(value) {
    if (value === null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value["@type"] !== undefined) nodes.push(value);
    for (const child of Object.values(value)) visit(child);
  }

  visit(document);
  return nodes;
}

export function nodeTypes(node) {
  const type = node?.["@type"];
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) return type.filter((item) => typeof item === "string");
  return [];
}

export function allNodes(scripts) {
  return scripts.flatMap((script) =>
    script.document ? collectNodes(script.document) : [],
  );
}

export function nodesByType(scripts, type) {
  return allNodes(scripts).filter((node) => nodeTypes(node).includes(type));
}

function absoluteUrlError(value) {
  const normalized = value.replace(/\{[^}]+\}/g, "placeholder");
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? null
      : `non-http URL ${JSON.stringify(value)}`;
  } catch {
    return `relative or invalid URL ${JSON.stringify(value)}`;
  }
}

function validateUrls(value, path, errors) {
  if (value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateUrls(item, `${path}[${index}]`, errors));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (key === "sameAs") {
      const values = Array.isArray(child) ? child : [child];
      values.forEach((candidate, index) => {
        if (typeof candidate !== "string") return;
        const error = absoluteUrlError(candidate);
        if (error) errors.push(`${childPath}[${index}]: ${error}`);
      });
      continue;
    }
    if (typeof child === "string") {
      if (URL_FIELDS.has(key)) {
        const error = absoluteUrlError(child);
        if (error) errors.push(`${childPath}: ${error}`);
      }
      continue;
    }
    validateUrls(child, childPath, errors);
  }
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function expectedLanguage(locale) {
  return locale === "zh" ? "zh-CN" : "en";
}

export function expectedTypesForRoute(route) {
  const types = [...REQUIRED_SITE_TYPES];
  const segments = route.split("/").filter(Boolean);
  const locale = segments[0];
  if (locale === "share") {
    types.push("WebPage");
    return types;
  }
  if (locale !== "zh" && locale !== "en") return types;

  if (segments[1] === "faq") types.push("FAQPage");
  if (segments[1] === "knowledge" && segments.length === 3) {
    types.push("Course", "BreadcrumbList");
  }
  if (segments[1] === "knowledge" && segments.length >= 4) {
    types.push("Article", "BreadcrumbList");
  }
  return types;
}

export function hasPageIdentity(scripts, pageUrl) {
  let found = false;

  function visit(value, key = "") {
    if (found || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
      return;
    }
    for (const [childKey, child] of Object.entries(value)) {
      if (
        typeof child === "string" &&
        (childKey === "url" || childKey === "@id" || childKey === "mainEntityOfPage") &&
        (child === pageUrl || child.startsWith(`${pageUrl}#`))
      ) {
        found = true;
        return;
      }
      visit(child, childKey);
    }
  }

  for (const script of scripts) {
    if (script.document) visit(script.document);
  }
  return found;
}

export function validateStructuredData({
  scripts,
  expectedTypes,
  locale,
  pageUrl,
  requirePageIdentity = true,
}) {
  const errors = [];
  const nodes = allNodes(scripts);

  if (scripts.length === 0) errors.push("no application/ld+json script found");
  for (const [index, script] of scripts.entries()) {
    if (script.error) errors.push(`script[${index}] is not valid JSON: ${script.error}`);
    if (!script.document || typeof script.document !== "object") {
      errors.push(`script[${index}] must contain a JSON object`);
      continue;
    }
    if (script.document["@context"] !== SCHEMA_CONTEXT) {
      errors.push(`script[${index}] @context must be ${SCHEMA_CONTEXT}`);
    }
    validateUrls(script.document, `script[${index}]`, errors);
  }

  const presentTypes = new Set(nodes.flatMap(nodeTypes));
  for (const type of expectedTypes) {
    if (!presentTypes.has(type)) errors.push(`missing required @type ${type}`);
  }

  const language = expectedLanguage(locale);
  for (const node of nodes) {
    if (node.inLanguage !== undefined && node.inLanguage !== language) {
      errors.push(
        `${nodeTypes(node).join("+") || "node"} inLanguage must be ${language}, got ${JSON.stringify(node.inLanguage)}`,
      );
    }
  }

  if (requirePageIdentity && pageUrl && !hasPageIdentity(scripts, pageUrl)) {
    errors.push(`no structured-data node identifies the canonical page ${pageUrl}`);
  }

  return { errors, nodes, types: [...presentTypes].sort() };
}

export function validateFaqPage(scripts) {
  const errors = [];
  const pages = nodesByType(scripts, "FAQPage");
  if (pages.length !== 1) {
    errors.push(`expected exactly one FAQPage node, got ${pages.length}`);
    return errors;
  }

  const questions = pages[0].mainEntity;
  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push("FAQPage mainEntity must be a non-empty array");
    return errors;
  }

  questions.forEach((question, index) => {
    if (!hasNonEmptyString(question?.name)) {
      errors.push(`FAQPage question[${index}] has an empty name`);
    }
    if (!hasNonEmptyString(question?.acceptedAnswer?.text)) {
      errors.push(`FAQPage question[${index}] has an empty acceptedAnswer.text`);
    }
  });
  return errors;
}

export function validateBreadcrumb(scripts, pageUrl) {
  const errors = [];
  const breadcrumbs = nodesByType(scripts, "BreadcrumbList");
  if (breadcrumbs.length !== 1) {
    errors.push(`expected exactly one BreadcrumbList node, got ${breadcrumbs.length}`);
    return errors;
  }
  const items = breadcrumbs[0].itemListElement;
  if (!Array.isArray(items) || items.length < 2) {
    errors.push("BreadcrumbList itemListElement must contain at least two items");
    return errors;
  }
  items.forEach((item, index) => {
    if (item?.position !== index + 1) {
      errors.push(`BreadcrumbList item[${index}] position must be ${index + 1}`);
    }
    if (!hasNonEmptyString(item?.name) || !hasNonEmptyString(item?.item)) {
      errors.push(`BreadcrumbList item[${index}] must have a name and item URL`);
    }
  });
  if (items.at(-1)?.item !== pageUrl) {
    errors.push(`BreadcrumbList last item must be ${pageUrl}`);
  }
  return errors;
}
