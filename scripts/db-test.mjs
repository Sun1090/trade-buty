#!/usr/bin/env node
/**
 * Q2.8 / 数据层门禁：在真实的 Supabase Postgres 镜像上跑迁移、RLS 越权测试与回滚演练。
 *
 * 为什么要用真实镜像：RLS 的 `auth.uid()`、anon/authenticated/service_role 角色、
 * public schema 默认授权都来自 Supabase 自身，用普通 postgres 容器跑会得到假阳性。
 *
 * 流程（每次都在全新的容器里跑，保证可重复）：
 *   1. 起一个干净的 supabase/postgres 容器并等它 healthy
 *   2. 按字典序应用 supabase/migrations/*.sql
 *   3. 安装 pgTAP，逐个执行 supabase/tests/*.sql
 *   4. 回滚演练：验证 0008 约束存在 → 执行真实 rollback 脚本 → 验证约束消失且脏数据可写入
 *      → 重新应用 0008 → 验证历史脏值被归一化、约束恢复、非法值再次被拒绝
 *   5. 销毁容器（除非 --keep）
 *
 * 用法：
 *   npm run db:test             # 全流程，结束销毁容器
 *   npm run db:test -- --keep   # 保留容器用于人工排查
 *   环境变量 DB_TEST_IMAGE 可覆盖镜像，DB_TEST_CONTAINER 可覆盖容器名。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const IMAGE = process.env.DB_TEST_IMAGE ?? "supabase/postgres:17.6.1.155";
const CONTAINER = process.env.DB_TEST_CONTAINER ?? "trade-buty-db-test";
const KEEP = process.argv.includes("--keep");

const MIGRATIONS_DIR = path.join(root, "supabase", "migrations");
const TESTS_DIR = path.join(root, "supabase", "tests");
const ROLLBACK_0008 = path.join(root, "supabase", "rollback", "0008_goal_tier_constraints.sql");
const FORWARD_0008 = path.join(MIGRATIONS_DIR, "0008_goal_tier_constraints.sql");

const failures = [];

function log(step, message) {
  console.log(`[db:test] ${step} ${message}`);
}

function fail(step, message) {
  failures.push(`${step}: ${message}`);
  console.error(`[db:test] ❌ ${step} ${message}`);
}

/** 在容器里跑 psql；input 为 SQL 文本时走 stdin。 */
function psql(sql, { flags = ["-q", "-v", "ON_ERROR_STOP=1"] } = {}) {
  const args = ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-X", ...flags];
  const res = spawnSync("docker", args, {
    input: sql,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    error: res.error,
  };
}

/** 返回单行查询结果（-tA），失败时返回 null。 */
function queryOne(sql) {
  const res = psql(sql, { flags: ["-tA", "-v", "ON_ERROR_STOP=1"] });
  if (res.status !== 0) return null;
  return res.stdout.trim();
}

function dockerAvailable() {
  const res = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
  });
  return res.status === 0 && !res.error;
}

function waitForHealthy(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let last = "(unknown)";
  while (Date.now() < deadline) {
    const res = spawnSync(
      "docker",
      ["inspect", "-f", "{{.State.Health.Status}}", CONTAINER],
      { encoding: "utf8" },
    );
    last = (res.stdout ?? "").trim() || "(no health status)";
    if (last === "healthy") return true;
    if (last === "unhealthy") return false;
    spawnSync("sleep", ["1"]);
  }
  console.error(`[db:test] 容器健康检查超时，最后状态=${last}`);
  return false;
}

function teardown() {
  if (KEEP) {
    log("keep", `保留容器 ${CONTAINER}（排查完请 docker rm -f ${CONTAINER}）`);
    return;
  }
  spawnSync("docker", ["rm", "-f", CONTAINER], { encoding: "utf8" });
}

function main() {
  if (!dockerAvailable()) {
    console.error(
      "[db:test] ❌ 找不到可用的 Docker daemon。\n" +
        "  本门禁需要在真实 Supabase Postgres 上验证 RLS，无法在无 Docker 环境降级运行。\n" +
        "  安装/启动 Docker Desktop 后重试，或设置 DB_TEST_IMAGE 指向可达镜像。",
    );
    process.exit(1);
  }

  if (!fs.existsSync(MIGRATIONS_DIR) || !fs.existsSync(TESTS_DIR)) {
    console.error("[db:test] ❌ 缺少 supabase/migrations 或 supabase/tests 目录");
    process.exit(1);
  }

  // ---- 1. 全新容器 ----
  spawnSync("docker", ["rm", "-f", CONTAINER], { encoding: "utf8" });
  log("1/5", `启动干净容器 ${CONTAINER}（镜像 ${IMAGE}）…`);
  const run = spawnSync(
    "docker",
    [
      "run", "-d", "--name", CONTAINER,
      "-e", "POSTGRES_PASSWORD=postgres",
      "-e", "POSTGRES_DB=postgres",
      IMAGE,
    ],
    { encoding: "utf8" },
  );
  if (run.status !== 0) {
    console.error(`[db:test] ❌ 启动容器失败：${run.stderr?.trim() || run.error}`);
    process.exit(1);
  }
  if (!waitForHealthy()) {
    fail("provision", "容器未进入 healthy 状态");
    return;
  }

  // 引导状态校验：确认拿到的是带 Supabase 角色的镜像，否则 RLS 测试没有意义
  const bootstrap = queryOne(
    "select count(*) from pg_roles where rolname in ('anon','authenticated','service_role','authenticator')",
  );
  if (bootstrap !== "4") {
    fail("provision", `镜像缺少 Supabase 角色（期望 4 个，实际 ${bootstrap}）`);
    return;
  }

  // ---- 2. 应用迁移 ----
  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  log("2/5", `应用 ${migrationFiles.length} 个迁移…`);
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const res = psql(sql);
    if (res.status !== 0) {
      fail("migrate", `${file} 执行失败：${res.stderr.trim().split("\n").slice(-2).join(" ")}`);
      return;
    }
  }

  const grantCheck = queryOne(
    "select has_schema_privilege('authenticated','public','usage') and has_table_privilege('authenticated','public.progress','insert')",
  );
  if (grantCheck !== "t") {
    fail("migrate", "迁移后 authenticated 对 public.progress 缺少权限，RLS 测试会失真");
    return;
  }

  // ---- 3. pgTAP 测试 ----
  const ext = psql("create extension if not exists pgtap;");
  if (ext.status !== 0) {
    fail("pgtap", `无法安装 pgTAP：${ext.stderr.trim()}`);
    return;
  }

  const testFiles = fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith(".sql")).sort();
  log("3/5", `执行 ${testFiles.length} 个 pgTAP 测试文件…`);
  for (const file of testFiles) {
    const sql = fs.readFileSync(path.join(TESTS_DIR, file), "utf8");
    const res = psql(sql);
    const output = `${res.stdout}\n${res.stderr}`;
    const failedAssertions = (output.match(/^\s*not ok \d+/gm) ?? []).length;
    const planMismatch = /Looks like you (planned \d+ tests but ran \d+|failed \d+ test)/.test(output);
    if (res.status !== 0 || failedAssertions > 0 || planMismatch) {
      const detail = output
        .split("\n")
        .filter((l) => /not ok|# Failed|#       |Looks like|ERROR/.test(l))
        .slice(0, 12)
        .join("\n");
      fail("pgTAP", `${file} 未通过（失败断言 ${failedAssertions}）\n${detail}`);
    } else {
      const passed = (output.match(/^\s*ok \d+/gm) ?? []).length;
      log("3/5", `✅ ${file} — ${passed} 条断言通过`);
    }
  }

  // ---- 4. 回滚演练（使用真实的 rollback 脚本）----
  log("4/5", "回滚演练：0008 目标档位约束…");
  const constraintCount = () =>
    queryOne(
      "select count(*) from pg_constraint where conrelid = 'public.user_settings'::regclass " +
        "and conname in ('user_settings_daily_goal_min_check','user_settings_weekly_goal_min_check')",
    );
  const before = constraintCount();
  if (before !== "2") {
    fail("rollback", `回滚前约束数量应为 2，实际 ${before}`);
  } else {
    const rollbackSql = fs.readFileSync(ROLLBACK_0008, "utf8");
    const rb = psql(rollbackSql);
    if (rb.status !== 0) {
      fail("rollback", `rollback/0008 执行失败：${rb.stderr.trim()}`);
    } else if (constraintCount() !== "0") {
      fail("rollback", "执行 rollback/0008 后约束仍然存在");
    } else {
      log("4/5", "✅ rollback/0008 生效，两项约束已移除");

      // 约束移除后写入历史非法值（模拟脏数据），再跑正向迁移验证归一化
      const seed = psql(
        "insert into auth.users (id, instance_id, aud, role, email, encrypted_password, confirmed_at, created_at, updated_at) " +
          "values ('cccccccc-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','drill@example.test','x',now(),now(),now());" +
          "insert into user_settings (user_id, daily_goal_min, weekly_goal_min) " +
          "values ('cccccccc-0000-0000-0000-000000000003', 7, 100);",
      );
      if (seed.status !== 0) {
        fail("rollback", `约束移除后写入非法值失败：${seed.stderr.trim()}`);
      } else {
        const reapplied = psql(fs.readFileSync(FORWARD_0008, "utf8"));
        if (reapplied.status !== 0) {
          fail("rollback", `重新应用 0008 失败：${reapplied.stderr.trim()}`);
        } else {
          const after = constraintCount();
          const normalized = queryOne(
            "select daily_goal_min || '/' || weekly_goal_min from user_settings " +
              "where user_id = 'cccccccc-0000-0000-0000-000000000003'",
          );
          if (after !== "2") {
            fail("rollback", `重新应用后约束数量应为 2，实际 ${after}`);
          } else if (normalized !== "15/90") {
            fail("rollback", `历史脏值应归一化为 15/90，实际 ${normalized}`);
          } else {
            const rejected = psql(
              "update user_settings set daily_goal_min = 7 " +
                "where user_id = 'cccccccc-0000-0000-0000-000000000003';",
            );
            if (rejected.status === 0) {
              fail("rollback", "重新应用 0008 后非法档位 7 仍可写入");
            } else {
              log("4/5", "✅ 回滚 → 重放：脏数据归一化、约束恢复、非法值再次被拒绝");
            }
          }
        }
      }
    }
  }

  log("5/5", "收尾");
}

try {
  main();
} finally {
  teardown();
}

if (failures.length > 0) {
  console.error(`\n[db:test] ❌ ${failures.length} 项失败：`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\n[db:test] ✅ 迁移、RLS 越权测试、双设备同步约束与回滚演练全部通过");
