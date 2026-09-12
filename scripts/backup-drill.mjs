#!/usr/bin/env node
/**
 * Q5.4 数据层可复现部分：public schema + 数据备份/恢复演练。
 *
 * 这个脚本不替代线上 Supabase 的定时备份与仓库镜像确认，而是把可在本地验证的
 * 关键路径钉死：
 *   1. 在干净 Supabase Postgres 上应用仓库迁移并写入覆盖全部业务表的样例数据；
 *   2. 用 pg_dump 生成 custom-format 备份；
 *   3. 销毁源容器，模拟实例丢失；
 *   4. 在另一个全新 Supabase Postgres 中恢复备份；
 *   5. 对比恢复前后每张表的数据指纹、schema/RLS/约束/索引/触发器指纹；
 *   6. 在恢复后的数据库重跑全部 pgTAP RLS/同步/约束测试。
 *
 * 说明：Supabase 托管项目的 auth schema 由平台负责备份；本演练只导出 public schema，
 * 因此在恢复目标中预置最小 auth.users 行以满足 FK。线上备份的 auth/存储/项目配置
 * 仍必须在 Supabase 控制台执行并确认。
 *
 * 用法：
 *   npm run backup:drill
 *   npm run backup:drill -- --keep
 *   BACKUP_DRILL_IMAGE=supabase/postgres:17.6.1.155 npm run backup:drill
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const IMAGE =
  process.env.BACKUP_DRILL_IMAGE ??
  process.env.DB_TEST_IMAGE ??
  "supabase/postgres:17.6.1.155";
const SOURCE = process.env.BACKUP_DRILL_SOURCE ?? "trade-buty-backup-source";
const TARGET = process.env.BACKUP_DRILL_TARGET ?? "trade-buty-backup-target";
const KEEP = process.argv.includes("--keep");

const MIGRATIONS_DIR = path.join(root, "supabase", "migrations");
const TESTS_DIR = path.join(root, "supabase", "tests");

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const ZERO_VECTOR = `[${Array.from({ length: 1024 }, () => "0").join(",")}]`;

const DATA_TABLES = [
  { name: "progress", orderBy: "id" },
  { name: "wrongbook", orderBy: "id" },
  { name: "quiz_scores", orderBy: "id" },
  { name: "replay_history", orderBy: "id" },
  { name: "replay_best", orderBy: "user_id" },
  { name: "kb_embeddings", orderBy: "id" },
  { name: "ai_conversations", orderBy: "id" },
  { name: "ai_feedback", orderBy: "id" },
  { name: "ai_citation_clicks", orderBy: "id" },
  { name: "user_settings", orderBy: "user_id" },
];

const APP_TABLE_LITERAL = DATA_TABLES.map(({ name }) => `'${name}'`).join(",");

function docker(args, options = {}) {
  return spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
}

function psql(container, sql, { flags = ["-q", "-v", "ON_ERROR_STOP=1"] } = {}) {
  const res = docker(
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", ...flags],
    { input: sql },
  );
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    error: res.error,
  };
}

function queryOne(container, sql) {
  const res = psql(container, sql, { flags: ["-tA", "-v", "ON_ERROR_STOP=1"] });
  if (res.status !== 0) return null;
  return res.stdout.trim();
}

function detail(result) {
  return `${result.stderr || ""}`.trim().split("\n").slice(-4).join(" ");
}

function assertOk(step, result) {
  if (result.status !== 0) {
    throw new Error(`${step}：${detail(result) || result.error || "未知错误"}`);
  }
  return result;
}

function dockerAvailable() {
  const res = docker(["version", "--format", "{{.Server.Version}}"]);
  return res.status === 0 && !res.error;
}

function destroy(container) {
  docker(["rm", "-f", container]);
}

function teardown() {
  if (KEEP) {
    console.log(
      `[backup:drill] 保留容器 ${SOURCE} / ${TARGET}（排查完请 docker rm -f ${SOURCE} ${TARGET}）`,
    );
    return;
  }
  destroy(SOURCE);
  destroy(TARGET);
}

function waitForHealthy(container, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let last = "(unknown)";
  while (Date.now() < deadline) {
    const res = docker(["inspect", "-f", "{{.State.Health.Status}}", container]);
    last = (res.stdout ?? "").trim() || "(no health status)";
    if (last === "healthy") return true;
    if (last === "unhealthy") return false;
    spawnSync("sleep", ["1"]);
  }
  throw new Error(`${container} 健康检查超时，最后状态=${last}`);
}

function startContainer(container) {
  destroy(container);
  const run = docker([
    "run",
    "-d",
    "--name",
    container,
    "-e",
    "POSTGRES_PASSWORD=postgres",
    "-e",
    "POSTGRES_DB=postgres",
    IMAGE,
  ]);
  assertOk(`启动 ${container}`, { status: run.status ?? 1, stderr: run.stderr ?? "", error: run.error });
  waitForHealthy(container);
}

function assertSupabaseRoles(container) {
  const roles = queryOne(
    container,
    "select count(*) from pg_roles where rolname in ('anon','authenticated','service_role','authenticator','supabase_admin')",
  );
  if (roles !== "5") {
    throw new Error(`${container} 缺少 Supabase 角色（实际 ${roles ?? "query failed"}）`);
  }
}

function applyMigrations(container) {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    assertOk(`应用迁移 ${file}`, psql(container, sql));
  }
  return files.length;
}

function seedAuthUsers(container) {
  assertOk(
    "预置 auth.users",
    psql(
      container,
      `insert into auth.users (
         id, instance_id, aud, role, email, encrypted_password, confirmed_at, created_at, updated_at
       ) values
         ('${USER_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'backup-a@example.test', 'x', now(), now(), now()),
         ('${USER_B}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'backup-b@example.test', 'x', now(), now(), now());`,
    ),
  );
}

function seedApplicationData(container) {
  assertOk(
    "写入演练数据",
    psql(
      container,
      `insert into progress (id, user_id, chapter_num, doc_slug, completed_at) values
         ('10000000-0000-0000-0000-000000000001', '${USER_A}', 'getting-started', 'intro', '2026-09-01T01:02:03Z'),
         ('10000000-0000-0000-0000-000000000002', '${USER_A}', 'candlestick', 'basics', '2026-09-02T01:02:03Z'),
         ('10000000-0000-0000-0000-000000000003', '${USER_B}', 'risk', 'position-size', '2026-09-03T01:02:03Z');

       insert into wrongbook (id, user_id, chapter_num, question_idx, picked, answered_at, srs_stage, srs_due) values
         ('20000000-0000-0000-0000-000000000001', '${USER_A}', 'candlestick', 2, 1, '2026-09-04T01:02:03Z', 3, '2026-09-20'),
         ('20000000-0000-0000-0000-000000000002', '${USER_B}', 'risk', 0, 2, '2026-09-05T01:02:03Z', 0, '2026-09-14');

       insert into quiz_scores (id, user_id, chapter_num, best, total, done, updated_at) values
         ('30000000-0000-0000-0000-000000000001', '${USER_A}', 'candlestick', 8, 10, true, '2026-09-06T01:02:03Z');

       insert into replay_history (id, user_id, symbol, interval, total, correct, best_streak, recorded_at) values
         ('40000000-0000-0000-0000-000000000001', '${USER_A}', 'BTCUSDT', '1h', 30, 18, 5, '2026-09-07T01:02:03Z');

       insert into replay_best (user_id, best_streak, updated_at) values
         ('${USER_A}', 5, '2026-09-07T01:02:03Z');

       insert into kb_embeddings (id, chunk, chapter, doc, locale, embedding, created_at) values
         ('50000000-0000-0000-0000-000000000001', '演练向量块', 'risk', 'position-size', 'zh', '${ZERO_VECTOR}'::vector, '2026-09-08T01:02:03Z');

       insert into ai_conversations (id, user_id, role, content, sources, created_at) values
         ('60000000-0000-0000-0000-000000000001', '${USER_A}', 'user', '如何理解回撤？', '[{"chapter":"risk","doc":"drawdown"}]'::jsonb, '2026-09-09T01:02:03Z');

       insert into ai_feedback (id, user_id, conversation_id, rating, question, answer, created_at) values
         ('70000000-0000-0000-0000-000000000001', '${USER_A}', '60000000-0000-0000-0000-000000000001', 'helpful', '如何理解回撤？', '回撤是峰值到谷值的跌幅。', '2026-09-09T01:03:03Z');

       insert into ai_citation_clicks (id, user_id, kind, chapter, doc, question, created_at) values
         ('80000000-0000-0000-0000-000000000001', null, 'source', 'risk', 'drawdown', '什么是回撤？', '2026-09-10T01:02:03Z'),
         ('80000000-0000-0000-0000-000000000002', '${USER_A}', 'suggested', 'risk', 'position-size', '仓位怎么定？', '2026-09-10T01:03:03Z');

       insert into user_settings (user_id, daily_goal_min, weekly_goal_min, updated_at) values
         ('${USER_A}', 30, 150, '2026-09-11T01:02:03Z'),
         ('${USER_B}', 5, 45, '2026-09-11T01:03:03Z');`,
    ),
  );
}

function dataFingerprint(container) {
  const out = {};
  for (const { name, orderBy } of DATA_TABLES) {
    const value = queryOne(
      container,
      `select count(*)::text || ':' || coalesce(md5(string_agg(to_jsonb(t)::text, E'\\n' order by t.${orderBy})), 'empty') from public.${name} t`,
    );
    if (value === null) throw new Error(`${container} 无法读取数据指纹：${name}`);
    out[name] = value;
  }
  return out;
}

function schemaFingerprint(container) {
  const q = (sql, label) => {
    const value = queryOne(container, sql);
    if (value === null) throw new Error(`${container} 无法读取 schema 指纹：${label}`);
    return value;
  };

  return {
    tables: q(
      `select count(*)::text from pg_tables where schemaname='public' and tablename = any(array[${APP_TABLE_LITERAL}])`,
      "tables",
    ),
    rls: q(
      `select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname = any(array[${APP_TABLE_LITERAL}]) and c.relrowsecurity`,
      "rls",
    ),
    policies: q(
      `select count(*)::text || ':' || coalesce(md5(string_agg(tablename||'|'||policyname||'|'||cmd||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''), E'\\n' order by tablename,policyname)), 'empty')
       from pg_policies where schemaname='public' and tablename = any(array[${APP_TABLE_LITERAL}])`,
      "policies",
    ),
    constraints: q(
      `select count(*)::text || ':' || coalesce(md5(string_agg(r.relname||'|'||c.conname||'|'||c.contype::text||'|'||pg_get_constraintdef(c.oid), E'\\n' order by r.relname,c.conname)), 'empty')
       from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace
       where n.nspname='public' and r.relname = any(array[${APP_TABLE_LITERAL}])`,
      "constraints",
    ),
    indexes: q(
      `select count(*)::text || ':' || coalesce(md5(string_agg(tablename||'|'||indexname||'|'||indexdef, E'\\n' order by tablename,indexname)), 'empty')
       from pg_indexes where schemaname='public' and tablename = any(array[${APP_TABLE_LITERAL}])`,
      "indexes",
    ),
    triggers: q(
      `select count(*)::text || ':' || coalesce(md5(string_agg(r.relname||'|'||t.tgname||'|'||pg_get_triggerdef(t.oid), E'\\n' order by r.relname,t.tgname)), 'empty')
       from pg_trigger t join pg_class r on r.oid=t.tgrelid join pg_namespace n on n.oid=r.relnamespace
       where not t.tgisinternal and n.nspname='public' and r.relname = any(array[${APP_TABLE_LITERAL}])`,
      "triggers",
    ),
    columns: q(
      `select count(*)::text || ':' || coalesce(md5(string_agg(table_name||'|'||column_name||'|'||data_type||'|'||udt_name||'|'||is_nullable||'|'||coalesce(column_default,''), E'\\n' order by table_name,column_name)), 'empty')
       from information_schema.columns where table_schema='public' and table_name = any(array[${APP_TABLE_LITERAL}])`,
      "columns",
    ),
    functions: q(
      `select count(*)::text || ':' || coalesce(md5(string_agg(p.proname||'|'||pg_get_function_identity_arguments(p.oid)||'|'||pg_get_functiondef(p.oid), E'\\n' order by p.proname,pg_get_function_identity_arguments(p.oid))), 'empty')
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname = any(array['touch_updated_at','match_kb_embeddings'])`,
      "functions",
    ),
    extensions: q(
      `select coalesce(string_agg(extname||':'||extversion, ',' order by extname), 'none')
       from pg_extension where extname in ('vector','pgtap')`,
      "extensions",
    ),
  };
}

function compareFingerprints(label, source, restored) {
  const diffs = [];
  for (const key of Object.keys(source)) {
    if (source[key] !== restored[key]) {
      diffs.push(`${key}: before=${source[key]} after=${restored[key]}`);
    }
  }
  if (diffs.length > 0) {
    throw new Error(`${label} 不一致：\n  ${diffs.join("\n  ")}`);
  }
}

function assertRestoredPrivileges(container) {
  const privileges = queryOne(
    container,
    "select has_schema_privilege('authenticated','public','usage')::text || '/' || has_table_privilege('authenticated','public.progress','select,insert,update,delete')::text",
  );
  if (privileges !== "true/true") {
    throw new Error(`恢复后 authenticated 权限异常：${privileges ?? "query failed"}`);
  }
}

function runPgtap(container) {
  assertOk("安装 pgTAP", psql(container, "create extension if not exists pgtap;"));
  const files = fs
    .readdirSync(TESTS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(TESTS_DIR, file), "utf8");
    const res = psql(container, sql);
    const output = `${res.stdout}\n${res.stderr}`;
    const failedAssertions = (output.match(/^\s*not ok \d+/gm) ?? []).length;
    const planMismatch = /Looks like you (planned \d+ tests but ran \d+|failed \d+ test)/.test(output);
    if (res.status !== 0 || failedAssertions > 0 || planMismatch) {
      throw new Error(
        `恢复后 pgTAP ${file} 未通过（失败断言 ${failedAssertions}）：\n${output
          .split("\n")
          .filter((line) => /not ok|# Failed|#       |Looks like|ERROR/.test(line))
          .slice(0, 12)
          .join("\n")}`,
      );
    }
    const passed = (output.match(/^\s*ok \d+/gm) ?? []).length;
    console.log(`[backup:drill] ✅ ${file} — ${passed} 条断言通过`);
  }
  return files.length;
}

function main() {
  if (!dockerAvailable()) {
    throw new Error(
      "找不到可用的 Docker daemon；备份演练必须在真实 Supabase Postgres 容器上执行。",
    );
  }
  if (!fs.existsSync(MIGRATIONS_DIR) || !fs.existsSync(TESTS_DIR)) {
    throw new Error("缺少 supabase/migrations 或 supabase/tests 目录");
  }

  console.log(`[backup:drill] 1/6 启动源库 ${SOURCE}（${IMAGE}）…`);
  startContainer(SOURCE);
  assertSupabaseRoles(SOURCE);

  console.log("[backup:drill] 2/6 应用迁移并写入覆盖全部业务表的数据…");
  const migrationCount = applyMigrations(SOURCE);
  seedAuthUsers(SOURCE);
  seedApplicationData(SOURCE);
  const sourceData = dataFingerprint(SOURCE);
  const sourceSchema = schemaFingerprint(SOURCE);

  console.log("[backup:drill] 3/6 pg_dump public schema + data（custom format）…");
  const dump = docker(
    [
      "exec",
      SOURCE,
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Fc",
      "--schema=public",
      "--no-owner",
      "--no-acl",
    ],
    { encoding: null },
  );
  assertOk("pg_dump", {
    status: dump.status ?? 1,
    stderr: dump.stderr?.toString() ?? "",
    error: dump.error,
  });
  if (!dump.stdout || dump.stdout.length < 1024) {
    throw new Error(`备份文件异常（${dump.stdout?.length ?? 0} bytes）`);
  }
  console.log(`[backup:drill] 备份 ${dump.stdout.length} bytes；销毁源库以模拟实例丢失`);
  destroy(SOURCE);

  console.log(`[backup:drill] 4/6 启动全新目标库 ${TARGET} 并恢复…`);
  startContainer(TARGET);
  assertSupabaseRoles(TARGET);
  seedAuthUsers(TARGET);
  assertOk("准备 vector 扩展", psql(TARGET, "create extension if not exists vector;"));
  const restore = docker(
    [
      "exec",
      "-i",
      TARGET,
      "pg_restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "--no-owner",
      "--no-acl",
      "--schema=public",
      "--single-transaction",
      "--exit-on-error",
    ],
    { input: dump.stdout },
  );
  assertOk("pg_restore", {
    status: restore.status ?? 1,
    stderr: restore.stderr?.toString() ?? "",
    error: restore.error,
  });

  console.log("[backup:drill] 5/6 对比数据与 schema/RLS/约束指纹…");
  const restoredData = dataFingerprint(TARGET);
  const restoredSchema = schemaFingerprint(TARGET);
  compareFingerprints("恢复数据", sourceData, restoredData);
  compareFingerprints("恢复 schema", sourceSchema, restoredSchema);
  assertRestoredPrivileges(TARGET);

  console.log("[backup:drill] 6/6 在恢复库上重跑 pgTAP…");
  const testCount = runPgtap(TARGET);

  console.log(
    `[backup:drill] ✅ ${migrationCount} 个迁移、${DATA_TABLES.length} 张业务表、${testCount} 个 pgTAP 文件全部通过`,
  );
}

try {
  main();
} finally {
  teardown();
}
