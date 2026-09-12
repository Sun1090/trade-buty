import fs from "node:fs";
import path from "node:path";
import { loadAll } from "js-yaml";
import { describe, expect, it } from "vitest";

const workflowDir = ".github/workflows";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

/** 仓库里所有 GitHub Actions 工作流文件（相对路径，稳定排序） */
const workflowPaths = fs
  .readdirSync(workflowDir)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .sort()
  .map((file) => path.join(workflowDir, file));

function loadWorkflow(workflowPath) {
  return loadAll(fs.readFileSync(workflowPath, "utf8"));
}

/** 收集单个 job 里所有 run 步骤拼成的 shell 文本 */
function jobCommands(job) {
  return (job.steps ?? [])
    .map((step) => step.run)
    .filter(Boolean)
    .join("\n");
}

/** 遍历所有工作流的所有 job，产出 [文件, job 名, job] */
function allJobs() {
  const jobs = [];
  for (const workflowPath of workflowPaths) {
    const [workflow] = loadWorkflow(workflowPath);
    for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
      jobs.push({ workflowPath, jobName, job });
    }
  }
  return jobs;
}

describe("GitHub Actions workflow contract", () => {
  it("discovers every workflow file", () => {
    expect(workflowPaths.length).toBeGreaterThan(0);
    expect(workflowPaths.map((file) => path.basename(file))).toContain("ci.yml");
    expect(workflowPaths.map((file) => path.basename(file))).toContain("link-patrol.yml");
  });

  it("keeps every workflow in one YAML document", () => {
    for (const workflowPath of workflowPaths) {
      expect(loadWorkflow(workflowPath), `${workflowPath} 必须是单文档 YAML`).toHaveLength(1);
    }
  });

  it("所有工作流的官方 actions 都使用 Node.js 24 运行时（不残留 Node.js 20 弃用版本）", () => {
    // 各 action 切换到 node24 的第一个 major；低于它仍会在 CI 里触发 Node.js 20 弃用注记。
    const minMajor = { checkout: 5, "setup-node": 5, cache: 5, "upload-artifact": 6 };
    const stale = [];
    for (const { workflowPath, jobName, job } of allJobs()) {
      for (const step of job.steps ?? []) {
        const match = /^actions\/([\w-]+)@v(\d+)$/.exec(step.uses ?? "");
        if (!match) continue;
        const [, name, major] = match;
        const min = minMajor[name];
        if (min !== undefined && Number(major) < min) {
          stale.push(`${workflowPath} · ${jobName}: ${step.uses}`);
        }
      }
    }
    expect(stale, `以下 action 仍跑在 Node.js 20 上，需升级 major：\n${stale.join("\n")}`).toEqual([]);
  });

  it("使用 setup-node 的工作流统一 Node 22；跑 npm ci 的 job 必须缓存 npm", () => {
    const drift = [];
    for (const { workflowPath, jobName, job } of allJobs()) {
      const runsNpmCi = jobCommands(job)
        .split("\n")
        .some((command) => command.trim() === "npm ci");
      for (const step of job.steps ?? []) {
        if (!String(step.uses ?? "").startsWith("actions/setup-node@")) continue;
        const withBlock = step.with ?? {};
        if (String(withBlock["node-version"]) !== "22") {
          drift.push(`${workflowPath} · ${jobName}: node-version=${withBlock["node-version"]}`);
        }
        if (runsNpmCi && withBlock.cache !== "npm") {
          drift.push(`${workflowPath} · ${jobName}: 跑 npm ci 但 cache=${withBlock.cache}`);
        }
      }
    }
    expect(drift, `setup-node 配置与 CI 运行时不一致：\n${drift.join("\n")}`).toEqual([]);
  });

  it("每个 run 步骤引用的 npm 脚本都真实存在（防重命名后静默失配）", () => {
    const missing = [];
    for (const { workflowPath, jobName, job } of allJobs()) {
      const commands = jobCommands(job);
      for (const match of commands.matchAll(/npm run ([\w:-]+)/g)) {
        const script = match[1];
        if (!pkg.scripts?.[script]) missing.push(`${workflowPath} · ${jobName}: npm run ${script}`);
      }
    }
    expect(missing, `工作流引用了不存在的 npm 脚本：\n${missing.join("\n")}`).toEqual([]);
  });

  it("每个 run 步骤引用的 node scripts/*.mjs 文件都存在", () => {
    const missing = [];
    for (const { workflowPath, jobName, job } of allJobs()) {
      const commands = jobCommands(job);
      for (const match of commands.matchAll(/node (scripts\/[\w.-]+\.mjs)/g)) {
        const file = match[1];
        if (!fs.existsSync(file)) missing.push(`${workflowPath} · ${jobName}: node ${file}`);
      }
    }
    expect(missing, `工作流引用了不存在的脚本文件：\n${missing.join("\n")}`).toEqual([]);
  });

  it("外链巡检保留月度定时与手动触发，并递归拉取子模块", () => {
    const [workflow] = loadWorkflow(path.join(workflowDir, "link-patrol.yml"));
    const trigger = workflow.on ?? {};
    expect(trigger.schedule?.[0]?.cron, "缺少每月定时触发").toBe("0 3 1 * *");
    expect(Object.keys(trigger), "缺少 workflow_dispatch 手动触发").toContain("workflow_dispatch");
    const job = workflow.jobs.patrol;
    expect(job, "缺少 patrol 作业").toBeTruthy();
    const checkout = (job.steps ?? []).find((step) => String(step.uses ?? "").startsWith("actions/checkout@"));
    expect(checkout?.with?.submodules, "checkout 必须递归拉取知识库子模块").toBe("recursive");
    expect(jobCommands(job)).toContain("npm run ops:link-patrol");
  });
});

describe("CI workflow contract", () => {
  const ciPath = path.join(workflowDir, "ci.yml");
  const [workflow] = loadWorkflow(ciPath);

  it("keeps all post-dry-run quality gates in the workflow", () => {
    const steps = workflow.jobs.ci.steps;
    const commands = jobCommands(workflow.jobs.ci);
    const names = steps.map((step) => step.name).filter(Boolean);

    for (const command of [
      "npm run audit:prod",
      "npm run audit:all",
      "npm run check:secrets",
      "npm run check:error-report-privacy",
      "npm run check:env-docs",
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
    const job = workflow.jobs["db-tests"];
    expect(job, "缺少 db-tests 作业").toBeTruthy();
    const commands = jobCommands(job);
    expect(commands).toContain("node scripts/db-test.mjs");
    expect(commands).toContain("npm run backup:drill");
    expect(commands).toContain("docker pull supabase/postgres:17.6.1.155");
  });

  it("Playwright Chromium 在移动端门禁和 E2E 之前安装", () => {
    const commands = (workflow.jobs.ci.steps ?? []).map((step) => step.run).filter(Boolean);
    const installIndex = commands.findIndex((command) => command.includes("playwright install"));
    const mobileIndex = commands.findIndex((command) => command.includes("npm run check:mobile"));
    const e2eIndex = commands.findIndex((command) => command.includes("npm run e2e"));

    expect(installIndex, "缺少 Playwright 浏览器安装步骤").toBeGreaterThanOrEqual(0);
    expect(installIndex, "浏览器安装必须早于移动端门禁").toBeLessThan(mobileIndex);
    expect(installIndex, "浏览器安装必须早于 E2E").toBeLessThan(e2eIndex);
  });
});
