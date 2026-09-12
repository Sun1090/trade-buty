import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/**
 * R7.6：错误上报隐私审计。
 *
 * 与 `growth-event-privacy.mjs` 同构：把「诊断载荷只能是无身份白名单字段」这条
 * 约定固化成可执行门禁，防止未来重构把错误正文 / URL / 账号塞进上报载荷或服务端日志。
 */

/** 去掉注释，避免注释里描述「禁止发送 message」反而触发扫描。 */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** 截取两个顶层标记之间的源码（用于把审计范围限定到某个函数）。 */
function regionBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return null;
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) return null;
  return source.slice(start, end);
}

const PAYLOAD_FIELDS = ["level", "scope", "kind", "digest"];

/** 绝不允许出现在上传载荷构造区的敏感标识符。 */
const FORBIDDEN_PAYLOAD_IDENTIFIERS = [
  ["error message", /\.\s*message\b/],
  ["error stack", /\.\s*stack\b/],
  ["page URL", /\b(location|href|referrer)\b/],
  ["user agent", /\buserAgent\b/],
  ["cookie", /\bcookie\b/],
  ["account identity", /\b(userId|user_id|email|accountId)\b/],
];

export function auditErrorReportPrivacy({ clientSource, routeSource, docs, privacyPage }) {
  const errors = [];
  const client = stripComments(clientSource);
  const route = stripComments(routeSource);

  // 1) 载荷构造必须与 console 通道隔离，且不得引用任何敏感标识符。
  const builder = regionBetween(client, "export function buildErrorReportPayload(", "export function sendErrorReport(");
  if (!builder) {
    errors.push("could not locate buildErrorReportPayload in the client module");
  } else {
    for (const [label, pattern] of FORBIDDEN_PAYLOAD_IDENTIFIERS) {
      if (pattern.test(builder)) errors.push(`error-report payload builder references ${label}`);
    }
  }

  // 2) 载荷类型只能声明白名单字段。
  const interfaceBlock = client.match(/interface\s+ErrorReportPayload\s*\{([\s\S]*?)\}/);
  if (!interfaceBlock) {
    errors.push("could not read the ErrorReportPayload interface");
  } else {
    const fields = [...interfaceBlock[1].matchAll(/^\s*(?:readonly\s+)?([A-Za-z_][\w]*)\??\s*:/gm)].map((m) => m[1]);
    const unexpected = fields.filter((field) => !PAYLOAD_FIELDS.includes(field));
    const missing = PAYLOAD_FIELDS.filter((field) => !fields.includes(field));
    if (unexpected.length > 0) errors.push(`payload declares non-allowlisted fields: ${unexpected.join(", ")}`);
    if (missing.length > 0) errors.push(`payload is missing allowlisted fields: ${missing.join(", ")}`);
  }

  // 3) 客户端端点常量必须与真实的 Route Handler 目录一致。
  const endpoint = client.match(/ERROR_REPORT_ENDPOINT\s*=\s*"([^"]+)"/)?.[1];
  if (!endpoint) {
    errors.push("could not read ERROR_REPORT_ENDPOINT");
  } else if (!fs.existsSync(path.join(ROOT, "src/app", `${endpoint}/route.ts`))) {
    errors.push(`no Route Handler file for ${endpoint}`);
  }

  // 4) 服务端必须拒绝未知字段、有界读取、且只写 sanitized 日志。
  if (!/ERROR_REPORT_ALLOWED_KEYS/.test(route)) {
    errors.push("route must reject unknown payload keys via ERROR_REPORT_ALLOWED_KEYS");
  }
  if (/req\s*\.\s*json\s*\(/.test(route)) {
    errors.push("route must not call req.json() (unbounded body); use the bounded reader");
  }
  if (!/readBoundedBody\s*\(/.test(route) || !/MAX_ERROR_REPORT_BYTES/.test(route)) {
    errors.push("route must read the body through readBoundedBody() with MAX_ERROR_REPORT_BYTES");
  }
  if (!/parseErrorReportPayload\s*\(/.test(route)) {
    errors.push("route must validate the payload through parseErrorReportPayload()");
  }
  for (const [label, pattern] of FORBIDDEN_PAYLOAD_IDENTIFIERS) {
    if (pattern.test(route)) errors.push(`route references ${label}`);
  }
  if (/return\s+NextResponse[\s\S]{0,200}payload\s*\.\s*(scope|kind)\s*\+\s*payload/.test(route)) {
    errors.push("route must not echo the raw payload back in responses");
  }

  // 5) 文档与隐私政策必须披露端点和「绝不发送」清单。
  for (const field of PAYLOAD_FIELDS) {
    if (!docs.includes(field)) errors.push(`docs/error-reporting.md is missing field ${field}`);
  }
  if (!/绝不发送|never sends|Never sends/i.test(docs)) {
    errors.push("docs/error-reporting.md must document the never-sent fields");
  }
  if (!privacyPage.includes("/api/error-reports")) {
    errors.push("privacy policy must name the /api/error-reports endpoint");
  }
  if (!/不写入数据库|not stored in our database/.test(privacyPage)) {
    errors.push("privacy policy must disclose that diagnostics are not persisted");
  }

  return { errors, endpoint };
}

function run() {
  const result = auditErrorReportPrivacy({
    clientSource: fs.readFileSync(path.join(ROOT, "src/lib/error-report.ts"), "utf8"),
    routeSource: fs.readFileSync(path.join(ROOT, "src/app/api/error-reports/route.ts"), "utf8"),
    docs: fs.readFileSync(path.join(ROOT, "docs/error-reporting.md"), "utf8"),
    privacyPage: fs.readFileSync(path.join(ROOT, "src/app/[locale]/privacy/page.tsx"), "utf8"),
  });

  if (result.errors.length > 0) {
    console.error("error report privacy audit failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(
    `error report privacy audit passed: endpoint ${result.endpoint}, allowlisted fields only, sanitized server log, disclosed in privacy policy`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
