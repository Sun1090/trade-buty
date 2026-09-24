import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./error-report-privacy.mjs";
import { scanFloorViolation } from "./scan-floor-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/** 实测（2026-09-24）src/app/api 下 12 个 route.ts。扫不到路由＝这道门禁整段没在跑。 */
export const MIN_ROUTE_FILES = 11;

/**
 * R15.4①：所有接收 JSON 请求体的端点都必须在**读流阶段**设字节上限。
 *
 * 为什么单独成门禁：字段级校验（各路由的 `parse*Body`）是在整包已经缓冲并解析成
 * 对象之后才跑的，所以「单条消息 8000 字符」这类上限挡不住一个几百 MB 的请求体。
 * 站内曾只有 `/api/error-reports` 做了有界读取，其余端点靠平台体积上限兜着。
 * 新增一个 `await req.json()` 只需一行，回归这条约定也只需一行，所以把它钉成检查。
 *
 * R16.83：`src/app/api` 被改名或整目录没读到时，这里原先打印
 * 「passed: 0 个 POST 端点里没有一个绕过有界读取」——一次没跑的扫描长得和通过一样。
 * 现在目录缺失、路由数不过下限都直接失败，通过的那行也把分母写出来。
 */

/** 直接从请求对象上解析 JSON 的写法（绕过了有界读取）。 */
const RAW_JSON_PARSE = /\b\w*[Rr]eq(?:uest)?\s*\.\s*json\s*\(/;
/** 通过 request-body 工具读体：第二个实参必须是具名上限常量，不能是行内魔法数字。 */
const BOUNDED_READ = /\bread(?:BoundedBody|JsonBody)\s*\(\s*\w+\s*,\s*([^,)]+?)\s*\)/g;

/**
 * @param {Record<string, string>} sources 路由源码，键为仓库相对路径
 * @returns {string[]} 违规说明；空数组表示通过
 */
export function auditRequestBodyBounds(sources) {
  const errors = [];
  for (const [file, rawSource] of Object.entries(sources)) {
    const source = stripComments(rawSource);
    if (!source.includes("export async function POST")) {
      // 没有写方法的端点不接收请求体（GET 用 query），跳过。
      continue;
    }
    if (RAW_JSON_PARSE.test(source)) {
      errors.push(`${file} 直接 req.json() 解析请求体，未经有界读取（改用 readJsonBody）`);
      continue;
    }
    // 不解析 JSON 的 POST（例如只看 query/cookie 的登出端点）没有可设闸的请求体。
    for (const read of [...source.matchAll(BOUNDED_READ)]) {
      const cap = read[1];
      if (!/^[A-Za-z_$][\w$]*$/.test(cap)) {
        errors.push(`${file} 的有界读取上限必须是具名常量，实际是「${cap}」`);
      }
    }
  }
  return errors;
}

/** 递归收集 src/app 下所有 route.ts 的相对路径。 */
export function collectRouteFiles(apiDir) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts") out.push(full);
    }
  };
  if (fs.existsSync(apiDir)) walk(apiDir);
  return out.sort();
}

export function run({
  rootDir = ROOT,
  minRouteFiles = MIN_ROUTE_FILES,
  log = console.log.bind(console),
  error = console.error.bind(console),
  exit = process.exit,
} = {}) {
  const apiDir = path.join(rootDir, "src/app/api");
  if (!fs.existsSync(apiDir)) {
    error(`request body bound audit failed: 找不到接口目录 ${apiDir}`);
    error("- 一个路由都没扫到和所有路由都合规，过去打印的是同一句话。现在按失败处理。");
    exit(1);
    return;
  }
  const files = collectRouteFiles(apiDir);
  const shrunk = scanFloorViolation({ count: files.length, floor: minRouteFiles, what: "route.ts 接口文件" });
  if (shrunk) {
    error(`request body bound audit failed: ${shrunk}`);
    exit(1);
    return;
  }
  const sources = Object.fromEntries(
    files.map((full) => [path.relative(rootDir, full), fs.readFileSync(full, "utf8")]),
  );
  const errors = auditRequestBodyBounds(sources);

  if (errors.length > 0) {
    error("request body bound audit failed:");
    for (const line of errors) error(`- ${line}`);
    exit(1);
    return;
  }

  const postRoutes = Object.entries(sources).filter(
    ([, src]) => src.includes("export async function POST"),
  ).length;
  log(
    `request body bound audit passed: ${files.length} 个 route.ts 里的 ${postRoutes} 个 POST 端点没有一个绕过有界读取解析请求体`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
