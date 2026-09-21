import fs from "node:fs";
import path from "node:path";
import { loadAll } from "js-yaml";
import { describe, expect, it } from "vitest";

const workflowDir = ".github/workflows";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const ciWorkflowPath = path.join(workflowDir, "ci.yml");

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

const opsPath = "docs/ops.md";

/**
 * 抽取 ci.yml 里可机检的门禁标识，按作业定义顺序（ci → db-tests）：
 * `npm run X` → X；`node scripts/X.mjs` → scripts/X.mjs；
 * `npx playwright install …` → "playwright install"；`docker pull <image>` → <image>。
 * 行内 shell（echo / printf / ELAPSED 等）不产出标识，由表中具名行覆盖。
 */
function ciGateIdentifiers(workflow) {
  const ids = [];
  for (const job of Object.values(workflow.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (!step.run) continue;
      for (const raw of step.run.split("\n")) {
        const line = raw.trim();
        let match;
        if ((match = /^npm run ([\w:-]+)$/.exec(line))) ids.push(match[1]);
        else if ((match = /^node (scripts\/[\w.-]+\.mjs)/.exec(line))) ids.push(match[1]);
        else if (line.startsWith("npx playwright install")) ids.push("playwright install");
        else if ((match = /^docker pull ([\w./:@-]+)/.exec(line))) ids.push(match[1]);
      }
    }
  }
  return ids;
}

/** docs/ops.md 质量门禁表的正文行（到首个非表格行为止） */
function opsGateRows() {
  const lines = fs.readFileSync(opsPath, "utf8").split("\n");
  const header = lines.findIndex((line) => line.startsWith("| CI 步骤"));
  const rows = [];
  for (let i = header + 1; i < lines.length && lines[i].startsWith("|"); i += 1) rows.push(lines[i]);
  return rows;
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

  it("所有工作流的官方 actions 都固定到完整 commit SHA，并保持 Node.js 24 运行时", () => {
    // 各 action 切换到 node24 的第一个 major；低于它仍会在 CI 里触发 Node.js 20 弃用注记。
    const minMajor = { checkout: 5, "setup-node": 5, cache: 5, "upload-artifact": 6 };
    const problems = [];
    for (const { workflowPath, jobName, job } of allJobs()) {
      for (const step of job.steps ?? []) {
        const uses = String(step.uses ?? "");
        if (!uses.startsWith("actions/")) continue;
        const match = /^(actions\/[\w-]+)@([0-9a-f]{40})$/.exec(uses);
        if (!match) {
          problems.push(`${workflowPath} · ${jobName}: 未固定到 40 位 commit SHA：${uses}`);
          continue;
        }
        const [, action, sha] = match;
        const name = action.slice("actions/".length);
        const min = minMajor[name];
        const comments = fs
          .readFileSync(workflowPath, "utf8")
          .split("\n")
          .filter((line) => line.includes(`${action}@${sha}`));
        const major = Number(/ # v(\d+)\s*$/.exec(comments[0] ?? "")?.[1]);
        if (min !== undefined && (!Number.isInteger(major) || major < min)) {
          problems.push(`${workflowPath} · ${jobName}: ${action} 缺少 >= v${min} 的可追踪版本注释`);
        }
      }
    }
    expect(problems, `官方 action 供应链约束不满足：\n${problems.join("\n")}`).toEqual([]);
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

  it("每个工作流显式声明最小权限（contents: read），不依赖仓库默认值", () => {
    const problems = [];
    for (const workflowPath of workflowPaths) {
      const [workflow] = loadWorkflow(workflowPath);
      const permissions = workflow.permissions;
      if (permissions === undefined || permissions === null || permissions === "read-all") {
        problems.push(`${workflowPath}: 缺少显式最小权限声明（得到 ${JSON.stringify(permissions)}）`);
        continue;
      }
      if (permissions.contents !== "read") {
        problems.push(`${workflowPath}: contents 权限应为 read，实际 ${JSON.stringify(permissions.contents)}`);
      }
      // R14.4 的工作保全审计要枚举「关闭但未合并」的 PR，这是唯一被允许的额外只读 scope。
      const allowedExtra = { "pull-requests": "read" };
      for (const [key, value] of Object.entries(permissions)) {
        if (key === "contents") continue;
        if (allowedExtra[key] === value) continue;
        problems.push(`${workflowPath}: 多授予了权限 ${key}=${JSON.stringify(value)}`);
      }
    }
    expect(problems, `工作流权限未最小化：\n${problems.join("\n")}`).toEqual([]);
  });

  it("每个 job 都有超时上界，避免卡死占用 runner 数小时", () => {
    const problems = [];
    for (const { workflowPath, jobName, job } of allJobs()) {
      const timeout = job["timeout-minutes"];
      if (typeof timeout !== "number" || !Number.isFinite(timeout)) {
        problems.push(`${workflowPath} · ${jobName}: 缺少数值型 timeout-minutes`);
      } else if (timeout <= 0 || timeout > 60) {
        problems.push(`${workflowPath} · ${jobName}: timeout-minutes=${timeout} 超出合理区间 (0, 60]`);
      }
    }
    expect(problems, `存在无超时上界的 job：\n${problems.join("\n")}`).toEqual([]);
  });

  it("CI 在 PR 事件上取消被取代的运行，main 的 push 保持独立", () => {
    const [workflow] = loadWorkflow(ciWorkflowPath);
    const concurrency = workflow.concurrency;
    expect(concurrency, "ci.yml 缺少 concurrency 配置").toBeTruthy();
    expect(String(concurrency["cancel-in-progress"])).toContain("pull_request");
    const group = String(concurrency.group);
    expect(group, "PR 分组需按 head_ref 收敛到同一分支").toContain("github.head_ref");
    expect(group, "main 的 push 需用 run_id 与 PR 分组隔离").toContain("github.run_id");
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

  it("Dependabot 每周跟踪 npm 与 GitHub Actions，低风险 npm 更新分组", () => {
    const [config] = loadWorkflow(path.join(".github", "dependabot.yml"));
    expect(config.version).toBe(2);
    const updates = config.updates ?? [];
    const npm = updates.find((entry) => entry["package-ecosystem"] === "npm");
    const actions = updates.find((entry) => entry["package-ecosystem"] === "github-actions");
    expect(npm, "缺少 npm Dependabot 配置").toBeTruthy();
    expect(actions, "缺少 github-actions Dependabot 配置").toBeTruthy();
    expect(npm.schedule?.interval).toBe("weekly");
    expect(actions.schedule?.interval).toBe("weekly");
    expect(npm.directory).toBe("/");
    expect(actions.directory).toBe("/");
    const minorPatch = npm.groups?.["npm-minor-and-patch"];
    expect(minorPatch?.patterns).toContain("*");
    expect(minorPatch?.["update-types"]).toEqual(["minor", "patch"]);
  });

  it("Dependabot 忽略上游尚未支持的 eslint 10 / typescript 7（解除条件见 docs/deps.md）", () => {
    const [config] = loadWorkflow(path.join(".github", "dependabot.yml"));
    const npm = (config.updates ?? []).find((entry) => entry["package-ecosystem"] === "npm");
    const ignore = npm.ignore ?? [];
    const ignored = (name) =>
      ignore.find((entry) => entry["dependency-name"] === name)?.versions ?? [];
    // 上游 eslint-plugin-react / typescript-eslint 放宽 peer 后，先解除这里的忽略再升级。
    expect(ignored("eslint")).toContain("10.x");
    expect(ignored("typescript")).toContain("7.x");
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
    const commands = jobCommands(job);
    expect(commands).toContain("npm run ops:link-patrol");
    expect(commands, "CI 不得把零外链豁免写死，否则空集又会假绿").not.toContain(
      "LINK_PATROL_ALLOW_EMPTY",
    );
  });
});

describe("CI workflow contract", () => {
  const ciPath = ciWorkflowPath;
  const [workflow] = loadWorkflow(ciPath);

  it("keeps all post-dry-run quality gates in the workflow", () => {
    const steps = workflow.jobs.ci.steps;
    const commands = jobCommands(workflow.jobs.ci);
    const names = steps.map((step) => step.name).filter(Boolean);

    for (const command of [
      "npm run audit:prod",
      "npm run audit:all",
      "npm run check:secrets",
      "npm run test:coverage",
      "npm run check:error-report-privacy",
      "npm run check:env-docs",
      "npm run check:kb-changelog",
      "npm run check:release-tag",
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

  it("docs/ops.md 门禁表登记 ci.yml 的每一道门禁（防漏登记）", () => {
    const ops = fs.readFileSync(opsPath, "utf8");
    const missing = [...new Set(ciGateIdentifiers(workflow))].filter((id) => !ops.includes(id));
    expect(
      missing,
      `docs/ops.md 未登记以下 ci.yml 门禁（新增步骤时需同步门禁表）：\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("docs/ops.md 门禁表首列命令的相对顺序与 ci.yml 一致", () => {
    const firstCol = opsGateRows().map((row) => row.split("|")[1] ?? "");
    const escape = (value) => value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
    let last = -1;
    const outOfOrder = [];
    for (const id of [...new Set(ciGateIdentifiers(workflow))]) {
      const pattern = new RegExp(`(?<![\\w:-])${escape(id)}(?![\\w:-])`);
      const idx = firstCol.findIndex((cell) => pattern.test(cell));
      if (idx === -1) continue; // 仅在首列登记的命令参与顺序校验
      if (idx < last) outOfOrder.push(`${id}（门禁表第 ${idx + 1} 行）`);
      last = idx;
    }
    expect(
      outOfOrder,
      `docs/ops.md 门禁表顺序与 ci.yml 不一致（应按流水线实际顺序排列）：\n${outOfOrder.join("\n")}`,
    ).toEqual([]);
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

  it("覆盖度回归门禁存在：test:coverage 有预生成、阈值非零、CI 实跑", () => {
    expect(pkg.scripts?.["test:coverage"], "缺少 test:coverage 脚本").toContain("--coverage");
    expect(pkg.scripts?.["pretest:coverage"], "test:coverage 缺少 kb-titles 预生成").toBeTruthy();
    const config = fs.readFileSync("vitest.config.mts", "utf8");
    expect(config, "coverage provider 必须为 v8").toContain('provider: "v8"');
    const block = /thresholds:\s*\{([\s\S]*?)\}/.exec(config)?.[1] ?? "";
    for (const metric of ["statements", "branches", "functions", "lines"]) {
      const value = Number(new RegExp(metric + ":\\s*([0-9]+(?:\\.[0-9]+)?)").exec(block)?.[1]);
      expect(Number.isFinite(value), `覆盖度阈值缺少 ${metric}`).toBe(true);
      expect(value, `${metric} 阈值过低`).toBeGreaterThan(0);
    }
    expect(jobCommands(workflow.jobs.ci), "CI 必须实跑 test:coverage").toContain(
      "npm run test:coverage",
    );
    expect(
      fs.readFileSync("eslint.config.mjs", "utf8"),
      "coverage 产物必须对 ESLint 全局忽略，否则跑过覆盖率后 lint 会误报",
    ).toContain("coverage/**");
  });

  it("lockfile 可复现性门禁存在：devEngines 钉住 npm 主版本、CI 在 npm ci 后实跑", () => {
    const manager = pkg.devEngines?.packageManager;
    expect(manager, "缺少 devEngines.packageManager 的 npm 钉版").toBeTruthy();
    expect(manager.name, "钉版必须指向 npm").toBe("npm");
    // 钉住 CI 的 npm 主版本（Node 22 自带 npm 10），否则 npm 10/11 的 lockfile 形状漂移会漏网。
    expect(String(manager.version), "npm 钉版必须锁定 CI 的 major 10").toMatch(/^[~^]?10\./);
    expect(pkg.scripts?.["check:lockfile-repro"], "缺少 check:lockfile-repro 脚本").toBeTruthy();
    expect(
      fs.existsSync("scripts/check-lockfile-reproducibility.mjs"),
      "缺少 check-lockfile-reproducibility.mjs 门禁脚本",
    ).toBe(true);
    expect(
      fs.existsSync("scripts/lockfile-repro-lib.mjs"),
      "缺少 lockfile-repro-lib.mjs 纯函数库",
    ).toBe(true);
    const commands = jobCommands(workflow.jobs.ci).split("\n").map((line) => line.trim());
    expect(commands, "CI 必须实跑 check:lockfile-repro").toContain("npm run check:lockfile-repro");
    // 门禁要在 npm ci 之后（lockfile 已就位）且早于其余质量门禁，快速暴露漂移。
    const ciIndex = commands.indexOf("npm ci");
    const reproIndex = commands.indexOf("npm run check:lockfile-repro");
    expect(ciIndex, "缺少 npm ci").toBeGreaterThanOrEqual(0);
    expect(reproIndex, "check:lockfile-repro 必须晚于 npm ci").toBeGreaterThan(ciIndex);
  });
});
