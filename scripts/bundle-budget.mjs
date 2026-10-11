import path from "node:path";
import fs from "node:fs";

export const BYTES_PER_KB = 1024;
export const BUDGET_METRICS = Object.freeze(["js", "css", "html", "total"]);

/**
 * Next 每次 `npm run build` 都会重新生成一个随机构建号（`.next/BUILD_ID`，默认 21 字符
 * base64url），并把它**内联进每一条页面 HTML**（RSC payload 里的 `"b":"<buildId>"`）。
 * 后果实测（2026-10-11，同一份源码连构三次）：三个 BUILD_ID 互不相同，
 * 15 个分组的 gzip 原始字节**每次都变**（±1~4 字节）。
 *
 * 这对预算门禁无所谓（余量是 KB 量级），但对「把读数逐字登记进文档、再用同一份产物重算比对」
 * 的判据是致命的：那张表抄的是**某一次**构建的读数，下一次构建就可能翻掉 0.1KB 的舍入位，
 * 于是判据随机红，而那种红不指向任何回归（本轮就撞到一次：`knowledge-chapter` 表 267.2 / 实测 267.1）。
 * 与 R16.308 那条 `/changelog`（每提交必变）同形，只是这次的变量是**每构建**变的。
 *
 * 所以量尺寸之前先把构建号换成**定长占位符**：长度不变（不掺进「字符串变短」这种假收益），
 * 内容又是固定的，于是同一份源码在任意两次构建里量出逐字节相同的结果（已实测）。
 */
export const BUILD_ID_PLACEHOLDER = "x".repeat(21);

/** 读 `.next/BUILD_ID`；缺产物就抛错——宁可响，也不要拿着 undefined 去 replace。 */
export function readBuildId(root) {
  const file = path.join(root, ".next", "BUILD_ID");
  const value = fs.readFileSync(file, "utf8").trim();
  if (!/^[^\s]{8,}$/.test(value)) {
    throw new Error(`BUILD_ID 形状不对（长度 ${value.length}）：${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * 把 HTML 里出现的构建号换成定长占位符。返回 `{ html, replaced }`，
 * 让调用方能对「到底替换了几处」说话——静默返回原串就等于这条规则没生效。
 */
export function neutralizeBuildId(html, buildId) {
  if (typeof html !== "string") throw new Error("neutralizeBuildId 需要字符串 HTML");
  if (!/^[^\s]{8,}$/.test(String(buildId ?? ""))) {
    throw new Error(`拒绝用可疑的构建号做替换：${JSON.stringify(buildId)}`);
  }
  const parts = html.split(buildId);
  const replaced = parts.length - 1;
  return { html: parts.join(BUILD_ID_PLACEHOLDER), replaced };
}

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
  const relative = assetUrl.replace(/^\/_next\//, "");
  const normalized = path.posix.normalize(relative);
  if (!assetUrl.startsWith("/_next/static/") || assetUrl.includes("\\") ||
      !normalized.startsWith("static/")) {
    throw new Error(`asset is outside /_next/static: ${assetUrl}`);
  }
  return path.join(".next", normalized);
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
