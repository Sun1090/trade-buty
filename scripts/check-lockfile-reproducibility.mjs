#!/usr/bin/env node
/**
 * lockfile 可复现性门禁（CI + 本地共用）。
 *
 * 背景：`package-lock.json` 的形状由生成它的 npm 主版本决定。CI 用 Node 22 自带的
 * npm 10，而本地 / Dependabot 可能是 npm 11；两者生成的 lockfile 不兼容，npm 10 的
 * `npm ci` 会报 `Missing: <pkg> from lock file`（2026-09-13 的 TS 6 PR 就是这样红的）。
 *
 * 做法：用 `devEngines.packageManager` 钉住的 npm 版本重新生成一份 lockfile，与仓库里
 * 已提交的那份逐条目比较：
 *   - 有差异 → 说明提交的 lockfile 不是 CI 的 npm 主版本生成的，失败并给出修复命令；
 *   - 无差异 → 通过。
 * 无论成功失败都从备份恢复 `package-lock.json`，绝不把文件留在被改写状态。
 *
 * 只读仓库、只在临时目录写文件。用法：npm run check:lockfile-repro
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { diffLockPackages, formatDriftReport, parseNpmPin } from "./lockfile-repro-lib.mjs";

const root = process.cwd();
const lockPath = path.join(root, "package-lock.json");
const pkgPath = path.join(root, "package.json");
const registry = process.env.NPM_CONFIG_REGISTRY ?? "https://registry.npmjs.org";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const pin = parseNpmPin(pkg);
if (!pin) {
  fail(
    [
      "❌ package.json 缺少 devEngines.packageManager 的 npm 钉版，无法核验 lockfile 可复现性。",
      "   请在 package.json 里声明（版本与 CI 的 Node 22 自带 npm 同 major）：",
      '   "devEngines": { "packageManager": { "name": "npm", "version": "^10.9.4", "onFail": "warn" } }',
    ].join("\n"),
  );
}

/** 调用方的 npm 版本：优先用 npm 注入的 user-agent，其次回退到 `npm --version`。 */
function detectRunningNpm() {
  const fromAgent = process.env.npm_config_user_agent?.match(/\bnpm\/[\d.]+/)?.[0];
  if (fromAgent) return fromAgent.replace(/^npm\//, "");
  try {
    return execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

const npmSpec = pin.exact ?? String(pin.major);
const runningNpm = detectRunningNpm();

const before = fs.readFileSync(lockPath, "utf8");
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "trade-buty-lockfile-"));
const backupPath = path.join(backupDir, "package-lock.json");
fs.writeFileSync(backupPath, before);

let after = before;
try {
  try {
    execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      [
        "--yes",
        `npm@${npmSpec}`,
        "install",
        "--package-lock-only",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
      ],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
    );
  } catch (error) {
    const detail = [error?.stdout, error?.stderr].filter(Boolean).join("\n").trim();
    fail(
      [
        `❌ 无法用锁定的 npm ${npmSpec} 重新生成 lockfile（npx 调用失败）。`,
        "   门禁在无法验证时选择失败，请检查网络 / registry 后重试。",
        detail ? `\n--- npx 输出 ---\n${detail}` : "",
      ].join("\n"),
    );
  }
  after = fs.readFileSync(lockPath, "utf8");
} finally {
  // 无论成功失败，都把仓库里的 lockfile 还原成提交时的内容。
  fs.writeFileSync(lockPath, before);
  fs.rmSync(backupDir, { recursive: true, force: true });
}

let beforeLock;
let afterLock;
try {
  beforeLock = JSON.parse(before);
  afterLock = JSON.parse(after);
} catch {
  fail("❌ package-lock.json（或重新生成的版本）不是合法 JSON，无法比较。");
}

const { added, removed } = diffLockPackages(beforeLock, afterLock);
const unchanged = before === after;

if (!unchanged || added.length > 0 || removed.length > 0) {
  fail(
    formatDriftReport({
      runningNpm: runningNpm ?? `未知（生成方 npm ${npmSpec}）`,
      pin,
      added,
      removed,
      registry,
    }),
  );
}

console.log(
  `✅ package-lock.json 可用 npm ${npmSpec} 逐条目复现（${Object.keys(beforeLock.packages ?? {}).length} 个包条目，无差异）。`,
);
