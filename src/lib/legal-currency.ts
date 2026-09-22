import { execSync } from "child_process";

/**
 * 构建期从 git 取「某个文件最后一次被改动的日期」。取不到就返回 null——浅克隆、
 * 没有 .git 的环境（Vercel 的构建快照深度不保证）都属正常，调用方必须选择「不说不
 * 出口的话」，而不是退回一个写死的年份。
 */
export function lastCommitDateFor(relPath: string): string | null {
  try {
    const out = execSync(
      `git log -1 --date=short --format=%cd -- "${relPath}"`,
      {
        cwd: process.cwd(),
        encoding: "utf-8",
      },
    ).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

/**
 * 隐私政策与服务条款页首行那句「更新日期」。这两个页面整页是预渲染的静态 HTML，
 * 原先写死「2026 年」：跨到下一年就自动变成一句没人来得及改的假话，而读者恰恰会拿
 * 这个日期判断条款是不是还在生效。改为构建期取本页源文件的最后提交日期，取不到就
 * 整句不出现。
 */
export function legalPageLead(locale: string, relPath: string): string | null {
  const date = lastCommitDateFor(relPath);
  if (!date) return null;
  return locale === "en"
    ? `This page's wording last changed on ${date}, together with the code.`
    : `本页文字最后更新于 ${date}，与代码一同维护。`;
}
