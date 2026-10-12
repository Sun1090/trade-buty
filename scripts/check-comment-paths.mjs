#!/usr/bin/env node
/**
 * R16.317：注释里点名的仓库路径必须真的存在（阻断式门禁）。
 *
 * 用法：npm run check:comment-paths
 *
 * 两个地板（文件数 / 引用数）都做成 `run()` 的入参：CLI 用例跑的是临时小仓，
 * 天然过不了真实下限——与 `check:secrets` 的 `--min-files` 同一先例。
 * CI 与 `npm run check:comment-paths` 都不带参数，跑的就是真下限。
 * 退出码：有失效引用 / 豁免失效 / 扫描面跌破地板 → 1。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MIN_REFS_FLOOR, auditCommentPathClaims } from "./comment-path-lib.mjs";
import { scanFloorViolation, recordScanCount } from "./scan-floor-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/**
 * 实测（2026-10-13）：`git ls-files` 下非测试的 ts/tsx/mjs 共 379 份。
 * 地板取 300：目录改名、扩展名漏配、或 `git ls-files` 拿空都会立刻跌破。
 */
export const MIN_SOURCE_FILES = 300;

function gitList(root, args) {
  return execFileSync("git", args, { cwd: root })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

/**
 * @param {{rootDir?: string, minSourceFiles?: number, minRefsFloor?: number,
 *   log?: (msg: string) => void, error?: (msg: string) => void,
 *   exit?: (code: number) => void}} options
 */
export function run({
  rootDir = ROOT,
  minSourceFiles = MIN_SOURCE_FILES,
  minRefsFloor = MIN_REFS_FLOOR,
  log = console.log.bind(console),
  error = console.error.bind(console),
  exit = process.exit,
} = {}) {
  const tracked = new Set(gitList(rootDir, ["ls-files", "-z"]));
  const files = [...tracked].filter(
    (file) => /\.(ts|tsx|mjs)$/.test(file) && !file.includes(".test."),
  );

  const shrunk = scanFloorViolation({
    count: files.length,
    floor: minSourceFiles,
    what: "非测试源码文件",
  });
  recordScanCount({
    key: "comment-path-source-files",
    count: files.length,
    floor: minSourceFiles,
    what: "非测试源码文件",
  });
  if (shrunk) {
    error(`[comment-paths] ❌ ${shrunk}`);
    return exit(1);
  }

  /** `.gitignore` 掉的路径（构建产物）在干净检出上本来就不存在，指向它是正确用法。 */
  const isIgnored = (rel) => {
    try {
      execFileSync("git", ["check-ignore", "-q", rel], { cwd: rootDir, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  };

  const sources = Object.fromEntries(
    files.map((file) => [file, fs.readFileSync(path.join(rootDir, file), "utf8")]),
  );

  const { issues, refs } = auditCommentPathClaims({
    sources,
    trackedFiles: tracked,
    existsSync: (rel) => fs.existsSync(path.join(rootDir, rel)),
    isIgnored,
  });

  const refsShrunk = scanFloorViolation({
    count: refs,
    floor: minRefsFloor,
    what: "注释里的仓库路径引用",
  });
  recordScanCount({
    key: "comment-path-refs",
    count: refs,
    floor: minRefsFloor,
    what: "注释里的仓库路径引用",
  });
  if (refsShrunk) {
    error(`[comment-paths] ❌ ${refsShrunk}`);
    error("  认不出引用和全部合规长得一模一样：先查正则与注释识别有没有被改坏。");
    return exit(1);
  }

  if (issues.length > 0) {
    error(`[comment-paths] ❌ ${issues.length} 处注释指向不存在的路径：`);
    for (const line of issues) error(`  - ${line}`);
    error(
      "注释是下一个人找主人的第一手依据：要么把路径改对，要么删掉这半句。" +
        "确实该豁免（占位反例、成批生成的文件名）就加进 scripts/comment-path-lib.mjs 的 COMMENT_PATH_EXCUSED 并写理由。",
    );
    return exit(1);
  }

  log(
    `[comment-paths] ✓ ${files.length} 份非测试源码里的 ${refs} 条路径引用全部指向真实存在的文件（含 node_modules 与 kline-buty 两处根）`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
