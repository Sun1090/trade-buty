import fs from "node:fs";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/ci.yml";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function loadWorkflow() {
  return yaml.loadAll(fs.readFileSync(workflowPath, "utf8"));
}

/** 收集单个 job 里所有 run 步骤拼成的 shell 文本 */
function jobCommands(job) {
  return (job.steps ?? [])
    .map((step) => step.run)
    .filter(Boolean)
    .join("\n");
}

describe("CI workflow contract", () => {
  it("keeps the workflow in one YAML document", () => {
    expect(loadWorkflow()).toHaveLength(1);
  });

  it("keeps all post-dry-run quality gates in the workflow", () => {
    const [workflow] = loadWorkflow();
    const steps = workflow.jobs.ci.steps;
    const commands = jobCommands(workflow.jobs.ci);
    const names = steps.map((step) => step.name).filter(Boolean);

    for (const command of [
      "npm run audit:prod",
      "npm run audit:all",
      "npm run check:secrets",
      "npm run check:mobile",
      "npm run check:quiz-mounts",
      "npm run check:quiz-coverage",
      "npm run check:links",
      "npm run check:sitemap",
      "npm run check:bundle",
      "npm run e2e",
      "npm run lhci",
      "npm run kb:inventory",
      "npm run kb:gap-priority",
      "npm run kb:accept",
      "npm run kb:translation-status",
      "npm run check:title-terminology",
      "npm run check:description-quality",
      "npm run check:risk-warning",
    ]) {
      expect(commands).toContain(command);
    }
    expect(names).toContain("生成内容质量报告（R10.1–R10.6 / R10.17）");
    expect(names).toContain("内容质量报告归档（R10.17）");
  });

  it("db-tests 作业覆盖迁移门禁与备份恢复演练（Q2.8 / Q5.4）", () => {
    const [workflow] = loadWorkflow();
    const job = workflow.jobs["db-tests"];
    expect(job, "缺少 db-tests 作业").toBeTruthy();
    const commands = jobCommands(job);
    expect(commands).toContain("node scripts/db-test.mjs");
    expect(commands).toContain("npm run backup:drill");
    expect(commands).toContain("docker pull supabase/postgres:17.6.1.155");
  });

  it("每个 run 步骤引用的 npm 脚本都真实存在（防重命名后静默失配）", () => {
    const [workflow] = loadWorkflow();
    const missing = [];
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const commands = jobCommands(job);
      for (const match of commands.matchAll(/npm run ([\w:-]+)/g)) {
        const script = match[1];
        if (!pkg.scripts?.[script]) missing.push(`${jobName}: npm run ${script}`);
      }
    }
    expect(missing, `工作流引用了不存在的 npm 脚本：\n${missing.join("\n")}`).toEqual([]);
  });

  it("每个 run 步骤引用的 node scripts/*.mjs 文件都存在", () => {
    const [workflow] = loadWorkflow();
    const missing = [];
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const commands = jobCommands(job);
      for (const match of commands.matchAll(/node (scripts\/[\w.-]+\.mjs)/g)) {
        const file = match[1];
        if (!fs.existsSync(file)) missing.push(`${jobName}: node ${file}`);
      }
    }
    expect(missing, `工作流引用了不存在的脚本文件：\n${missing.join("\n")}`).toEqual([]);
  });

  it("Playwright Chromium 在移动端门禁和 E2E 之前安装", () => {
    const [workflow] = loadWorkflow();
    const commands = (workflow.jobs.ci.steps ?? []).map((step) => step.run).filter(Boolean);
    const installIndex = commands.findIndex((command) => command.includes("playwright install"));
    const mobileIndex = commands.findIndex((command) => command.includes("npm run check:mobile"));
    const e2eIndex = commands.findIndex((command) => command.includes("npm run e2e"));

    expect(installIndex, "缺少 Playwright 浏览器安装步骤").toBeGreaterThanOrEqual(0);
    expect(installIndex, "浏览器安装必须早于移动端门禁").toBeLessThan(mobileIndex);
    expect(installIndex, "浏览器安装必须早于 E2E").toBeLessThan(e2eIndex);
  });
});
