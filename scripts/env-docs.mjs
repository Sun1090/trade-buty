import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/**
 * Q5.x：环境变量文档契约。
 *
 * `docs/env.md` 自称「唯一受版本控制的环境变量说明」，但此前没有任何门禁保证它
 * 与 `process.env.*` 的真实用法一致 —— 新增变量忘了写文档、变量删除后文档留下
 * 幽灵行都不会被发现。这里把「代码里读的变量必须写进 docs/env.md，文档里的
 * 变量必须真的被读」这条对账关系固化成可执行检查，顺带守住一条安全边界：
 * 服务端密钥绝不允许出现在 `"use client"` 模块里。
 */

/** 平台/框架注入、不属于本项目管理面的变量。 */
const FRAMEWORK_VARS = new Set(["NODE_ENV"]);

/** 只在开发/运维脚本里出现的变量，由 docs/database-testing.md 等专门文档负责。 */
const TOOLING_PATTERN = /^(DB_TEST_|BACKUP_DRILL_)/;

/** 只能出现在服务端代码里的密钥；一旦被客户端模块读到就会进浏览器 bundle。 */
const SERVER_ONLY_SECRETS = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_TOKEN",
  "AI_API_KEY",
  "AI_EMBEDDING_KEY",
]);

/** 抽取 `process.env.NAME` 与 `process.env["NAME"]` / `process.env['NAME']` 两类写法。 */
export function extractEnvRefs(source) {
  const names = new Set();
  for (const match of source.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/process\.env\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g)) {
    names.add(match[1]);
  }
  return names;
}

/** 抽取 docs/env.md 表格里用代码片段登记的环境变量名（必须含下划线，避开 R3.10 之类的编号）。 */
export function extractDocumentedVars(docs) {
  const names = new Set();
  for (const match of docs.matchAll(/`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g)) {
    names.add(match[1]);
  }
  return names;
}

function isClientModule(source) {
  return /^\s*(?:\/\/.*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(source);
}

/**
 * @param {object} input
 * @param {string} input.docs                docs/env.md 内容
 * @param {Array<{file:string, source:string, isTest?:boolean}>} input.sources
 * @returns {{errors: string[], required: string[], documented: string[]}}
 */
export function auditEnvDocs({ docs, sources }) {
  const errors = [];

  const appRefs = new Map(); // name -> first file that reads it (非测试)
  const allRefs = new Map();
  for (const { file, source, isTest } of sources) {
    const refs = extractEnvRefs(source);
    for (const name of refs) {
      if (!allRefs.has(name)) allRefs.set(name, file);
    }
    if (!isTest) {
      for (const name of refs) {
        if (!appRefs.has(name)) appRefs.set(name, file);
      }
    }
    if (!isTest && isClientModule(source)) {
      for (const name of refs) {
        if (SERVER_ONLY_SECRETS.has(name)) {
          errors.push(`"use client" 模块 ${file} 读取了服务端密钥 ${name}（会进浏览器 bundle）`);
        }
      }
    }
  }

  const documented = extractDocumentedVars(docs);

  // 1) 代码里读的运行时变量必须登记。
  const required = [...appRefs.keys()]
    .filter((name) => !FRAMEWORK_VARS.has(name) && !TOOLING_PATTERN.test(name))
    .sort();
  for (const name of required) {
    if (!documented.has(name)) {
      errors.push(`docs/env.md 未登记 ${name}（用于 ${appRefs.get(name)}）`);
    }
  }

  // 2) 文档里登记的变量必须真的被读，避免删除代码后留下幽灵行。
  for (const name of [...documented].sort()) {
    if (!allRefs.has(name)) {
      errors.push(`docs/env.md 登记了 ${name}，但代码中没有读取它（幽灵条目）`);
    }
  }

  // 3) 文档必须说明 NEXT_PUBLIC_ 前缀的暴露语义。
  if (!/NEXT_PUBLIC_/.test(docs)) {
    errors.push("docs/env.md 必须说明 NEXT_PUBLIC_ 前缀的暴露语义");
  }

  return { errors, required, documented: [...documented].sort() };
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

export function loadSources(root = ROOT) {
  const files = walk(path.join(root, "src"), []);
  const configPath = path.join(root, "next.config.ts");
  if (fs.existsSync(configPath)) files.push(configPath);
  return files.map((file) => ({
    file: path.relative(root, file),
    source: fs.readFileSync(file, "utf8"),
    isTest: /\.test\.(ts|tsx)$/.test(file),
  }));
}

function run() {
  const { errors, required } = auditEnvDocs({
    docs: fs.readFileSync(path.join(ROOT, "docs/env.md"), "utf8"),
    sources: loadSources(),
  });

  if (errors.length > 0) {
    console.error("[env-docs] ❌ 环境变量文档与代码不一致：");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log(`[env-docs] ✅ docs/env.md 与代码一致（${required.length} 个运行时变量全部登记，无幽灵条目，无客户端密钥泄漏）`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
