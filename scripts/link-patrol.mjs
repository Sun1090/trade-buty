#!/usr/bin/env node
/**
 * R6.12：知识库外链健康巡检（月度 CI 定时）。
 * - 扫描全部 kb md 的 http(s) 外链
 * - HEAD（失败降级 GET）+ 10s 超时，网络错误重试一次
 * - 4xx/5xx → exit 1（巡检可见）
 * - 目录缺失、无 Markdown、零外链默认视为异常，防止空集假绿
 *
 * 用法：npm run ops:link-patrol
 * 确知知识库没有外链时可显式放行：LINK_PATROL_ALLOW_EMPTY=1 npm run ops:link-patrol
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_KB_DIR = path.join("content", "kline-buty", "docs", "knowledge");
const USER_AGENT = "trade-buty-link-patrol";

/** 递归列出目录里的 Markdown 文件；目录不存在时返回空数组。 */
export function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdownFiles(full));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/** 从内存中的 Markdown 来源抽取去重外链；Map 保留首次出现文件。 */
export function extractExternalLinks(sources) {
  const links = new Map();
  const re = /\]\((https?:\/\/[^)\s]+)\)/g;
  for (const { file, source } of sources) {
    let match;
    while ((match = re.exec(source)) !== null) {
      const url = match[1].replace(/[).,]+$/, "");
      if (!links.has(url)) links.set(url, file);
    }
  }
  return links;
}

/** 读取知识库 Markdown 与其中的外链；调用方可据此区分目录/文件/链接三层空集。 */
export function collectExternalLinks({ kbDir, root = process.cwd() }) {
  const files = listMarkdownFiles(kbDir);
  const sources = files.map((file) => ({
    file: path.relative(root, file),
    source: fs.readFileSync(file, "utf8"),
  }));
  return { files, links: extractExternalLinks(sources) };
}

function timeoutLabel(timeoutMs) {
  return `timeout(${Math.round(timeoutMs / 1000)}s)`;
}

/** 巡检参数：单个链接的墙钟预算与总尝试次数（1 次 + 重试 1 次）。 */
export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_ATTEMPTS = 2;

/**
 * 检查单个 URL。网络层错误重试一次；HTTP 状态失败立即返回，避免无意义重试。
 * 返回 null 表示可达，否则返回可操作的短错误字符串。
 */
export async function checkExternalLink(
  url,
  { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_ATTEMPTS } = {},
) {
  let lastError = "unknown";
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const head = await fetchImpl(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT },
      });
      if (head.status < 400) return null;
      if (head.status === 405 || head.status === 403) {
        const get = await fetchImpl(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "user-agent": USER_AGENT },
        });
        if (get.status < 400) return null;
        return `GET ${get.status}`;
      }
      return `HEAD ${head.status}`;
    } catch (error) {
      lastError = error?.name === "AbortError" ? timeoutLabel(timeoutMs) : error?.message ?? String(error);
    } finally {
      clearTimeout(timer);
    }
  }
  return lastError;
}

/**
 * 执行巡检，但不直接退出。`errors` 是不可巡检的输入/配置错误，`broken` 是超时或坏状态。
 */
export async function patrolExternalLinks({
  root = process.cwd(),
  kbDir = path.join(root, DEFAULT_KB_DIR),
  allowEmpty = false,
  check = (url) => checkExternalLink(url),
} = {}) {
  const result = { kbDir, files: [], links: new Map(), broken: [], errors: [] };
  const display = path.relative(root, kbDir) || kbDir;

  if (!fs.existsSync(kbDir)) {
    result.errors.push(
      `知识库目录不存在：${display}。知识库未初始化？先运行 git submodule update --init --recursive。`,
    );
    return result;
  }
  if (!fs.statSync(kbDir).isDirectory()) {
    result.errors.push(`知识库路径不是目录：${display}。请检查 submodule 检出的目录结构。`);
    return result;
  }

  const { files, links } = collectExternalLinks({ kbDir, root });
  result.files = files;
  result.links = links;
  if (files.length === 0) {
    result.errors.push(`知识库目录没有 Markdown 文件：${display}。请检查 submodule 是否完整检出。`);
    return result;
  }
  if (links.size === 0) {
    if (!allowEmpty) {
      result.errors.push(
        `扫描了 ${files.length} 个 Markdown，但没有发现任何 http(s) 外链。` +
          `若确认知识库确实无外链，显式设置 LINK_PATROL_ALLOW_EMPTY=1 重跑。`,
      );
    }
    return result;
  }

  const results = await Promise.all(
    [...links.entries()].map(async ([url, where]) => {
      const error = await check(url);
      return error ? `${where}  ${String(error).toUpperCase()}  ${url}` : null;
    }),
  );
  result.broken = results.filter(Boolean);
  return result;
}

/** CLI 入口：返回退出码，便于测试；直接执行时由底部写入 process.exitCode。 */
export async function run({
  root = process.cwd(),
  env = process.env,
  stdout = console.log,
  stderr = console.error,
  ...patrolOptions
} = {}) {
  const kbDir = patrolOptions.kbDir ?? path.join(root, DEFAULT_KB_DIR);
  const allowEmpty = env.LINK_PATROL_ALLOW_EMPTY === "1";
  const result = await patrolExternalLinks({ ...patrolOptions, kbDir, root, allowEmpty });

  if (result.errors.length > 0) {
    stderr("❌ 外链巡检无法形成有效结论：");
    for (const error of result.errors) stderr(`  - ${error}`);
    return 1;
  }

  stdout(`🔗 共 ${result.links.size} 个外链，开始巡检…`);
  if (result.broken.length > 0) {
    stderr(`❌ 失效外链 ${result.broken.length}/${result.links.size}：`);
    stderr(result.broken.join("\n"));
    return 1;
  }

  if (result.links.size === 0) {
    stdout(`✅ 外链巡检显式放行空集（扫描 ${result.files.length} 个 Markdown，0 个外链）`);
  } else {
    stdout(`✅ 外链巡检通过（${result.links.size} 个全部健康）`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run();
}
