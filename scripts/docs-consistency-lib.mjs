/**
 * Q5.1/Q5.2：文档与当前实现一致性纯检查。
 *
 * 这些断言只覆盖可机器验证、曾真实漂移过的契约，避免把普通文案评审误报为
 * 回归：双语 README 的课程数、AGENTS 的 locale/slug 结构、plan 的当前技术栈，
 * README 与 About 页的中立/不接受捐赠承诺，以及 package.json 与发布记录的版本号。
 */

import { newestReleaseVersion } from "./release-tag-lib.mjs";

export function extractReadmeCounts(markdown) {
  const text = String(markdown);
  const en = text.match(/\*\*Learn\*\*:\s*(\d+)\s+chapters?\s*\/\s*(\d+)\s+lessons?/i);
  const zh = text.match(/\*\*学\*\*：\s*(\d+)\s*篇章\s*\/\s*(\d+)\s*篇课程/);
  const toCounts = (match) =>
    match ? { chapters: Number(match[1]), lessons: Number(match[2]) } : null;
  return { en: toCounts(en), zh: toCounts(zh) };
}

export function auditReadmeCounts(readmes, expected) {
  const issues = [];
  const parsed = extractReadmeCounts(readmes.en ?? "");
  const parsedZh = extractReadmeCounts(readmes.zh ?? "");
  for (const [locale, counts] of [
    ["README.md", parsed.en],
    ["README.zh-CN.md", parsedZh.zh],
  ]) {
    if (!counts) {
      issues.push(`${locale}: 找不到可校验的章节/课程数量`);
      continue;
    }
    if (counts.chapters !== expected.chapters || counts.lessons !== expected.lessons) {
      issues.push(
        `${locale}: 写为 ${counts.chapters} 章 / ${counts.lessons} 篇，实际为 ${expected.chapters} 章 / ${expected.lessons} 篇`
      );
    }
  }
  return issues;
}

export function auditAgentsContract(markdown) {
  const text = String(markdown);
  const issues = [];
  for (const required of [
    "docs/knowledge/{zh,en}/",
    "English-slug directory",
    "Lesson filenames are English slugs",
  ]) {
    if (!text.includes(required)) issues.push(`AGENTS.md: 缺少当前知识库契约「${required}」`);
  }
  if (/docs\/knowledge\/NN-\*/.test(text)) {
    issues.push("AGENTS.md: 仍残留旧式 docs/knowledge/NN-* 目录契约");
  }
  return issues;
}

export function auditPlanContract(markdown, expectedLessons) {
  const text = String(markdown);
  const issues = [];
  for (const required of [
    `${expectedLessons} 篇`,
    "构建时 JSON 索引",
    "Supabase Auth",
    "任何 OpenAI 格式端点",
  ]) {
    if (!text.includes(required)) issues.push(`docs/plan.md: 缺少当前实现事实「${required}」`);
  }
  for (const stale of ["Pagefind", "shadcn/ui", "lucide-react", "Claude API + pgvector"]) {
    if (text.includes(stale)) issues.push(`docs/plan.md: 仍把历史选型当作当前方案「${stale}」`);
  }
  return issues;
}

export function auditReadmeImplementationReferences(readmes) {
  const issues = [];
  const required = ["proxy.ts", "CONTRIBUTING.md", "docs/architecture.md", "Vitest", "Playwright"];
  for (const [file, markdown] of Object.entries(readmes)) {
    const text = String(markdown);
    for (const marker of required) {
      if (!text.includes(marker)) issues.push(`${file}: 缺少当前实现/文档引用「${marker}」`);
    }
    for (const stale of ["middleware.ts", "Vitest-ready"]) {
      if (text.includes(stale)) issues.push(`${file}: 仍残留历史实现描述「${stale}」`);
    }
  }
  return issues;
}

export function auditContributingContract(markdown) {
  const text = String(markdown);
  const issues = [];
  for (const required of [
    "Node.js 22",
    "git submodule update --init",
    "npm ci",
    "npm run dev",
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run build",
    "npm run e2e",
    "npm run db:test",
    "npm run check:docs",
    "npm run check:secrets",
    "npm run kb:update",
    "Angular Convention",
    "Co-Authored-By",
    "禁止直接向 `main` 推送",
    "docs/release-checklist.md",
    "codex/",
    "content/kline-buty",
    "只读 git submodule",
    "⚠️ 风险提示",
    "不承诺收益",
    "不荐股荐基",
    "不做券商开户导流",
    "不接受广告或捐赠",
  ]) {
    if (!text.includes(required)) issues.push(`CONTRIBUTING.md: 缺少贡献契约「${required}」`);
  }
  return issues;
}

export function auditArchitectureContract(markdown) {
  const text = String(markdown);
  const issues = [];
  for (const required of [
    "Next.js 16",
    "App Router",
    "src/proxy.ts",
    "content/kline-buty",
    "npm run kb:update",
    "构建时 JSON 索引",
    "Supabase Auth",
    "RLS",
    "pgvector",
    "任意 OpenAI",
    "POST /api/error-reports",
    "/share/[kind]/[path]",
    "Playwright",
    "Lighthouse CI",
    "db-tests",
  ]) {
    if (!text.includes(required)) issues.push(`docs/architecture.md: 缺少当前架构事实「${required}」`);
  }
  for (const stale of ["Vitest-ready", "Pagefind", "Clerk 注册登录"]) {
    if (text.includes(stale)) issues.push(`docs/architecture.md: 仍残留历史架构描述「${stale}」`);
  }
  return issues;
}

export function auditNeutrality(readmes, aboutPage) {
  const issues = [];
  const about = String(aboutPage);
  if (!/(don't run ads|doesn't run ads|不接受广告)/.test(about) || !/(no donations|不接受任何形式的捐赠)/.test(about)) {
    issues.push("About 页未同时声明不接受广告与捐赠，无法校验 README 中立承诺");
  }
  for (const [file, markdown] of Object.entries(readmes)) {
    if (/(^##\s+(Sponsor|赞助)|\bdonate-|buying the author a coffee|请作者喝杯咖啡)/im.test(String(markdown))) {
      issues.push(`${file}: 存在与“不接受捐赠”承诺冲突的赞助入口`);
    }
  }
  return issues;
}

/** package.json 的 version 必须等于发布记录里的最新已发布版本。 */
export function auditReleaseVersion({ packageVersion, releases }) {
  const newest = newestReleaseVersion(releases);
  if (!newest) {
    return ["src/data/release-notes.json: 没有 x.y.z 形式的已发布版本"];
  }
  if (packageVersion !== newest) {
    return [
      `package.json: version 为 ${String(packageVersion)}，最新发布版本为 ${newest}；发布时必须同步 bump package.json`
    ];
  }
  return [];
}

/**
 * R14.8：发布检查单必须存在且关键步骤不缺。
 *
 * 发布是本项目最容易「记得做」的环节：tag 只能在 rebase 合并后打、e2e 会污染构建产物门禁、
 * 版本号与 release-notes 必须同步——漏掉任何一步都要靠事后盘点才发现。这里把步骤钉成断言。
 */
export const RELEASE_CHECKLIST_STEPS = Object.freeze([
  "判级",
  "RELEASE_FREEZE",
  "src/data/release-notes.json",
  "npm run changelog:generate",
  "npm run check:lockfile-repro",
  "npm run test:coverage",
  "npm run build",
  "npm run check:release-tag",
  "git tag -a vX.Y.Z",
  "gh pr merge",
  "trade-buty.vercel.app",
  "docs/progress.md",
  "## 7. 回滚",
]);

export function auditReleaseChecklist(markdown) {
  const text = String(markdown ?? "");
  const issues = [];
  for (const required of RELEASE_CHECKLIST_STEPS) {
    if (!text.includes(required)) {
      issues.push(`docs/release-checklist.md: 缺少发布步骤「${required}」`);
    }
  }
  return issues;
}

