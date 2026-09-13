import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * R13.17：知识库内容的真实修改时间。
 *
 * sitemap 的 `lastmod` 只有在「确实反映内容变化」时才有意义。此前每次部署都
 * 把全部页面标成构建时间，等于告诉搜索引擎所有页面天天在变——Google 会直接
 * 忽略这种信号。这里改用知识库子模块的 HEAD 提交时间：内容没动，lastmod
 * 就不动；内容更新，lastmod 跟着更新。
 *
 * 拿不到 git 信息时（打包部署、无 .git、浅克隆）退回构建时间，保证 sitemap
 * 永远可生成，绝不因为环境差异让构建失败。
 */

const KB_RELATIVE_DIR = path.join("content", "kline-buty");

/** 可注入的副作用，让「拿不到 git 信息」的每条分支都能被单测覆盖。 */
export interface KbFreshnessDeps {
  /** 目录是否存在，默认 node:fs 的 existsSync */
  exists?: (target: string) => boolean;
  /** 在 dir 里跑 git 并返回 stdout，失败时抛错（默认 execFileSync 封装） */
  execGit?: (dir: string, args: string[]) => string;
}

function defaultExecGit(dir: string, args: string[]): string {
  return execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/** 解析 `git log -1 --format=%cI` 的输出；非法输入返回 null。 */
export function parseKbCommitDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * 读取目录所属 git 仓库的 HEAD 提交时间。
 *
 * 必须是「知识库自己的」git 仓库：父仓库根目录不等于子模块目录时视为不可信，
 * 否则会把站点仓库的提交时间误当成内容更新。任何异常都收敛成 null。
 */
export function readKbCommitDate(dir: string, deps: KbFreshnessDeps = {}): Date | null {
  const exists = deps.exists ?? existsSync;
  const execGit = deps.execGit ?? defaultExecGit;
  if (!exists(dir)) return null;
  try {
    const toplevel = execGit(dir, ["rev-parse", "--show-toplevel"]).trim();
    if (path.resolve(toplevel) !== path.resolve(dir)) return null;
    return parseKbCommitDate(execGit(dir, ["log", "-1", "--format=%cI"]));
  } catch {
    return null;
  }
}

/**
 * 带进程内缓存的读取器。生产直接用下面的 `kbLastModified`；
 * 测试可注入目录与副作用，不必依赖真实 git 仓库或模块级缓存重置钩子。
 */
export function createKbLastModifiedReader(
  resolveDir: () => string = () => path.join(process.cwd(), KB_RELATIVE_DIR),
  deps: KbFreshnessDeps = {},
): () => Date | null {
  let cached: Date | null | undefined;
  return () => {
    if (cached === undefined) cached = readKbCommitDate(resolveDir(), deps);
    return cached;
  };
}

/** 知识库最近一次提交时间；不可用时返回 null。结果在进程内缓存。 */
export const kbLastModified = createKbLastModifiedReader();
