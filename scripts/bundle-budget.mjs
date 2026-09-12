import path from "node:path";

export const BYTES_PER_KB = 1024;
export const BUDGET_METRICS = Object.freeze(["js", "css", "html", "total"]);

const JS_ASSET_RE = /<script\b[^>]*\bsrc=["'](\/_next\/static\/[^"'?#]+\.js)(?:[?#][^"']*)?["'][^>]*>/gi;
const CSS_ASSET_RE = /<link\b[^>]*\bhref=["'](\/_next\/static\/[^"'?#]+\.css)(?:[?#][^"']*)?["'][^>]*>/gi;

export function validateBudgetManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["manifest must be an object"];
  }
  if (manifest.version !== 1) {
    errors.push("version must be 1");
  }
  if (!Array.isArray(manifest.budgets) || manifest.budgets.length === 0) {
    errors.push("budgets must be a non-empty array");
    return errors;
  }

  const ids = new Set();
  for (const [index, budget] of manifest.budgets.entries()) {
    const prefix = `budgets[${index}]`;
    if (!budget || typeof budget !== "object" || Array.isArray(budget)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (typeof budget.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(budget.id)) {
      errors.push(`${prefix}.id must be a lowercase slug`);
    } else if (ids.has(budget.id)) {
      errors.push(`${prefix}.id duplicates ${budget.id}`);
    } else {
      ids.add(budget.id);
    }
    if (typeof budget.description !== "string" || budget.description.trim() === "") {
      errors.push(`${prefix}.description must be non-empty`);
    }
    if (typeof budget.match !== "string" || budget.match.trim() === "") {
      errors.push(`${prefix}.match must be a non-empty regular expression`);
    } else {
      try {
        new RegExp(budget.match);
      } catch {
        errors.push(`${prefix}.match is not a valid regular expression`);
      }
    }
    if (!budget.maxGzipKB || typeof budget.maxGzipKB !== "object" || Array.isArray(budget.maxGzipKB)) {
      errors.push(`${prefix}.maxGzipKB must be an object`);
      continue;
    }
    for (const metric of BUDGET_METRICS) {
      const value = budget.maxGzipKB[metric];
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        errors.push(`${prefix}.maxGzipKB.${metric} must be a positive number`);
      }
    }
    for (const key of Object.keys(budget.maxGzipKB)) {
      if (!BUDGET_METRICS.includes(key)) {
        errors.push(`${prefix}.maxGzipKB has unknown metric ${key}`);
      }
    }
  }
  return errors;
}

export function compileBudgetManifest(manifest) {
  const errors = validateBudgetManifest(manifest);
  if (errors.length > 0) {
    throw new Error(`invalid bundle budget manifest:\n- ${errors.join("\n- ")}`);
  }
  return {
    ...manifest,
    budgets: manifest.budgets.map((budget) => ({
      ...budget,
      regex: new RegExp(budget.match),
    })),
  };
}

export function matchRouteBudget(route, budgets) {
  const matches = budgets.filter((budget) => budget.regex.test(route));
  if (matches.length === 0) {
    return { budget: null, error: `no route budget matches ${route}` };
  }
  if (matches.length > 1) {
    return {
      budget: null,
      error: `${route} matches multiple budgets: ${matches.map((budget) => budget.id).join(", ")}`,
    };
  }
  return { budget: matches[0], error: null };
}

export function collectStaticAssetUrls(html, extension) {
  if (extension !== "js" && extension !== "css") {
    throw new Error(`unsupported asset extension: ${extension}`);
  }
  const pattern = extension === "js" ? JS_ASSET_RE : CSS_ASSET_RE;
  const urls = new Set();
  for (const match of html.matchAll(pattern)) {
    urls.add(match[1]);
  }
  return [...urls];
}

export function staticAssetRepoPath(assetUrl) {
  if (!assetUrl.startsWith("/_next/static/")) {
    throw new Error(`asset is outside /_next/static: ${assetUrl}`);
  }
  return path.join(".next", assetUrl.replace(/^\/_next\//, ""));
}

export function measureRoute({ route, html, assetGzip, htmlGzip }) {
  const measureAssets = (extension) =>
    collectStaticAssetUrls(html, extension).map((url) => ({
      url,
      bytes: assetGzip(url),
    }));

  const js = measureAssets("js");
  const css = measureAssets("css");
  const metrics = {
    js: js.reduce((total, asset) => total + asset.bytes, 0),
    css: css.reduce((total, asset) => total + asset.bytes, 0),
    html: htmlGzip(html),
    total: 0,
  };
  metrics.total = metrics.js + metrics.css + metrics.html;
  return { route, metrics, assets: { js, css } };
}

export function metricFailures(measurement, budget) {
  return BUDGET_METRICS.filter(
    (metric) => measurement.metrics[metric] > budget.maxGzipKB[metric] * BYTES_PER_KB
  );
}

export function formatKB(bytes) {
  return (bytes / BYTES_PER_KB).toFixed(1);
}
