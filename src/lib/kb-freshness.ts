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

/** 解析 `git log -1 --format=%cI` 的输出；非法输入返回 null。 */
export function parseKbCommitDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function readKbCommitDate(dir: string): Date | null {
  if (!existsSync(dir)) return null;
  try {
    // 必须是「知识库自己的」git 仓库：父仓库根目录不等于子模块目录时视为不可信，
    // 否则会把站点仓库的提交时间误当成内容更新。
    const toplevel = execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (path.resolve(toplevel) !== path.resolve(dir)) return null;
    const raw = execFileSync("git", ["-C", dir, "log", "-1", "--format=%cI"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseKbCommitDate(raw);
  } catch {
    return null;
  }
}

let cached: Date | null | undefined;

/** 知识库最近一次提交时间；不可用时返回 null。结果在进程内缓存。 */
export function kbLastModified(): Date | null {
  if (cached === undefined) {
    cached = readKbCommitDate(path.join(process.cwd(), KB_RELATIVE_DIR));
  }
  return cached;
}
