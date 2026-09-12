import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "./schema";

type SqlTable = {
  columns: Set<string>;
  rls: boolean;
  policies: { name: string; command: string; body: string }[];
};

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

function matchingParen(sql: string, open: number): number {
  let depth = 0;
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === "(") depth++;
    if (sql[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error("Unclosed CREATE TABLE parenthesis");
}

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "(") depth++;
    if (body[i] === ")") depth--;
    if (body[i] === "," && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

function parseMigrations(): Map<string, SqlTable> {
  const tables = new Map<string, SqlTable>();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const sql = stripComments(
    files.map((name) => readFileSync(path.join(MIGRATIONS_DIR, name), "utf8")).join("\n"),
  );

  const createRe = /create\s+table\s+if\s+not\s+exists\s+([a-z0-9_]+)\s*\(/gi;
  for (const match of sql.matchAll(createRe)) {
    const name = match[1];
    const open = (match.index ?? 0) + match[0].lastIndexOf("(");
    const body = sql.slice(open + 1, matchingParen(sql, open));
    const columns = new Set<string>();
    for (const part of splitTopLevel(body)) {
      const first = part.trim().split(/\s+/, 1)[0];
      if (!first || /^(constraint|primary|unique|foreign|check)$/i.test(first)) continue;
      columns.add(first.replace(/"/g, ""));
    }
    tables.set(name, { columns, rls: false, policies: [] });
  }

  const addColumnRe = /alter\s+table\s+([a-z0-9_]+)\s+add\s+column\s+if\s+not\s+exists\s+([a-z0-9_]+)/gi;
  for (const match of sql.matchAll(addColumnRe)) {
    tables.get(match[1])?.columns.add(match[2]);
  }

  const rlsRe = /alter\s+table\s+([a-z0-9_]+)\s+enable\s+row\s+level\s+security/gi;
  for (const match of sql.matchAll(rlsRe)) {
    const table = tables.get(match[1]);
    if (table) table.rls = true;
  }

  const policyRe = /create\s+policy\s+"([^"]+)"\s+on\s+([a-z0-9_]+)\s+for\s+(all|select|insert|update|delete)([\s\S]*?);/gi;
  for (const match of sql.matchAll(policyRe)) {
    tables.get(match[2])?.policies.push({
      name: match[1],
      command: match[3].toLowerCase(),
      body: match[4].replace(/\s+/g, " ").trim().toLowerCase(),
    });
  }

  return tables;
}

const expectedTables = {
  progress: schema.progress,
  wrongbook: schema.wrongbook,
  quiz_scores: schema.quizScores,
  replay_history: schema.replayHistory,
  replay_best: schema.replayBest,
  kb_embeddings: schema.kbEmbeddings,
  ai_conversations: schema.aiConversations,
  ai_feedback: schema.aiFeedback,
  ai_citation_clicks: schema.aiCitationClicks,
  user_settings: schema.userSettings,
} as const;

describe("Supabase migration contract", () => {
  const migrations = parseMigrations();

  it("Drizzle 镜像与迁移中的公开表、列完全一致", () => {
    const migrationTables = [...migrations.keys()].sort();
    expect(Object.keys(expectedTables).sort()).toEqual(migrationTables);

    for (const [tableName, table] of Object.entries(expectedTables)) {
      const config = getTableConfig(table);
      const schemaColumns = config.columns.map((column) => column.name).sort();
      const migrationColumns = [...(migrations.get(tableName)?.columns ?? [])].sort();
      expect(schemaColumns, `${tableName} columns`).toEqual(migrationColumns);
    }
  });

  it("每张公开表都开启 RLS 且至少有一条策略", () => {
    for (const [tableName, table] of migrations) {
      expect(table.rls, `${tableName} RLS`).toBe(true);
      expect(table.policies.length, `${tableName} policies`).toBeGreaterThan(0);
    }
  });

  it("用户数据表策略同时约束读取身份与写入身份", () => {
    const userOwned = [
      "progress",
      "wrongbook",
      "quiz_scores",
      "replay_history",
      "replay_best",
      "ai_conversations",
      "ai_feedback",
      "user_settings",
    ];
    for (const tableName of userOwned) {
      const policies = migrations.get(tableName)?.policies ?? [];
      expect(
        policies.some(
          (policy) =>
            policy.command === "all" &&
            policy.body.includes("auth.uid() = user_id") &&
            policy.body.includes("with check"),
        ),
        `${tableName} self-only policy`,
      ).toBe(true);
    }
  });

  it("公开向量数据只读，匿名分析数据只允许显式 insert", () => {
    const embeddings = migrations.get("kb_embeddings")?.policies ?? [];
    expect(embeddings.map((policy) => policy.command)).toEqual(["select"]);
    expect(embeddings[0]?.body).toContain("true");

    const clicks = migrations.get("ai_citation_clicks")?.policies ?? [];
    expect(clicks.map((policy) => policy.command)).toEqual(["insert"]);
    expect(clicks[0]?.body).toContain("user_id is null or auth.uid() = user_id");
  });

  it("目标档位约束与客户端常量一致，且提供回滚脚本", () => {
    const migration = stripComments(
      readFileSync(path.join(MIGRATIONS_DIR, "0008_goal_tier_constraints.sql"), "utf8"),
    )
      .replace(/\s+/g, " ")
      .toLowerCase();
    expect(migration).toContain("daily_goal_min in (5, 15, 30)");
    expect(migration).toContain("weekly_goal_min in (45, 90, 150)");

    const rollback = readFileSync(
      path.resolve(process.cwd(), "supabase/rollback/0008_goal_tier_constraints.sql"),
      "utf8",
    );
    expect(rollback).toContain("drop constraint if exists user_settings_daily_goal_min_check");
    expect(rollback).toContain("drop constraint if exists user_settings_weekly_goal_min_check");
  });
});
