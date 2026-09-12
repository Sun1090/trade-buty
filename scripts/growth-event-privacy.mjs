import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const FORBIDDEN_SINKS = [
  ["network fetch", /\bfetch\s*\(/],
  ["network sendBeacon", /\.sendBeacon\s*\(/],
  ["network XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["persistent storage", /\b(localStorage|sessionStorage|indexedDB)\b/],
  ["cookie write/read", /\bdocument\s*\.\s*cookie\b/],
  ["clipboard access", /\bnavigator\s*\.\s*clipboard\b/],
];

/** 去掉注释，避免注释中说明“禁止 localStorage”反而触发扫描。 */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

export function auditGrowthEventPrivacy({ source, docs, privacyPage }) {
  const errors = [];
  const code = stripComments(source);

  for (const [label, pattern] of FORBIDDEN_SINKS) {
    if (pattern.test(code)) errors.push(`growth event source contains forbidden ${label}`);
  }

  const loggerCalls = code.match(/console\s*\.\s*info\s*\(/g) ?? [];
  if (loggerCalls.length !== 1) {
    errors.push(`expected exactly one console.info sink, found ${loggerCalls.length}`);
  }
  if (!/console\s*\.\s*info\s*\(\s*"\[growth-event\]"\s*,\s*safe\.name\s*,\s*safe\s*\)/.test(code)) {
    errors.push("console.info must receive only the normalized safe event");
  }
  if (!/normalizeGrowthEvent\s*\(/.test(code)) {
    errors.push("growth event sink must pass through normalizeGrowthEvent");
  }

  const block = source.match(/GROWTH_EVENT_NAMES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  const eventNames = block ? [...block[1].matchAll(/"([a-z_]+)"/g)].map((match) => match[1]) : [];
  if (eventNames.length === 0) errors.push("could not read GROWTH_EVENT_NAMES");
  for (const name of eventNames) {
    if (!docs.includes(name)) errors.push(`event catalog is missing ${name}`);
  }

  if (!/明确禁止|禁止字段|prohibited|forbidden/i.test(docs)) {
    errors.push("event catalog must document prohibited fields");
  }
  if (!/console/i.test(privacyPage) || !/控制台/.test(privacyPage)) {
    errors.push("privacy policy must disclose the local console-only debug channel in both locales");
  }

  return { errors, eventNames };
}

function run() {
  const result = auditGrowthEventPrivacy({
    source: fs.readFileSync(path.join(ROOT, "src/lib/growth-events.ts"), "utf8"),
    docs: fs.readFileSync(path.join(ROOT, "docs/growth-events.md"), "utf8"),
    privacyPage: fs.readFileSync(path.join(ROOT, "src/app/[locale]/privacy/page.tsx"), "utf8"),
  });

  if (result.errors.length > 0) {
    console.error("growth event privacy audit failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(
    `growth event privacy audit passed: ${result.eventNames.length} events, console-only sink, no network/persistence APIs`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
