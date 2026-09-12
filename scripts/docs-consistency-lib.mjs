/**
 * Q5.1/Q5.2：文档与当前实现一致性纯检查。
 *
 * 这些断言只覆盖可机器验证、曾真实漂移过的契约，避免把普通文案评审误报为
 * 回归：双语 README 的课程数、AGENTS 的 locale/slug 结构、plan 的当前技术栈，
 * 以及 README 与 About 页的中立/不接受捐赠承诺。
 */

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
