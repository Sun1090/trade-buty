import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { auditEnvDocs, extractDocumentedVars, extractEnvRefs, loadSources } from "./env-docs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const docs = () =>
  [
    "# 环境变量",
    "NEXT_PUBLIC_ 前缀会内联到客户端 bundle，其余变量只在服务端可见。",
    "| 变量 | 必需 | 说明 |",
    "|---|---|---|",
    "| `AI_API_KEY` | AI 功能要 | 对话 key |",
    "| `NEXT_PUBLIC_SITE_URL` | 否 | 站点地址 |",
  ].join("\n");

const src = (file, source) => ({ file, source });
const ts = (body) => `export function f() {\n${body}\n}\n`;
/** 让 fixture 里的每个已登记变量都真的被读，隔离出被测的那条规则。 */
const baseline = () => [src("src/lib/site.ts", ts("return process.env.NEXT_PUBLIC_SITE_URL;"))];

describe("env docs contract", () => {
  it("accepts the tracked repository state", () => {
    const { errors, required } = auditEnvDocs({
      docs: fs.readFileSync(path.join(ROOT, "docs/env.md"), "utf8"),
      sources: loadSources(),
    });
    expect(errors).toEqual([]);
    expect(required).toContain("AI_API_KEY");
    expect(required).toContain("NEXT_PUBLIC_AI_ENABLED");
    expect(required).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("reads both dot and bracket env access", () => {
    const refs = extractEnvRefs(`process.env.AI_API_KEY\nprocess.env["ADMIN_TOKEN"]\nprocess.env['NEXT_PUBLIC_SITE_URL']`);
    expect([...refs].sort()).toEqual(["ADMIN_TOKEN", "AI_API_KEY", "NEXT_PUBLIC_SITE_URL"]);
  });

  it("only treats underscore-bearing code spans as variable names", () => {
    const vars = extractDocumentedVars("`NODE_ENV` `AI` `R3.10` `Bearer` `AI_MODEL`");
    expect([...vars].sort()).toEqual(["AI_MODEL", "NODE_ENV"]);
  });

  it("flags a variable the code reads but the docs miss", () => {
    const { errors } = auditEnvDocs({
      docs: docs(),
      sources: [src("src/lib/x.ts", ts('return process.env.AI_RETRIEVAL_JSON;'))],
    });
    expect(errors.some((e) => e.includes("未登记 AI_RETRIEVAL_JSON"))).toBe(true);
  });

  it("flags a documented variable nothing reads any more", () => {
    const { errors } = auditEnvDocs({
      docs: `${docs()}\n| \`AI_RETRIEVAL_JSON\` | 否 | 幽灵 |`,
      sources: [src("src/lib/x.ts", ts("return process.env.AI_API_KEY;"))],
    });
    expect(errors.some((e) => e.includes("幽灵") && e.includes("AI_RETRIEVAL_JSON"))).toBe(true);
  });

  it("flags a server-only secret read from a client module", () => {
    const { errors } = auditEnvDocs({
      docs: docs(),
      sources: [
        src("src/components/leak.ts", `"use client";\n${ts("return process.env.SUPABASE_SERVICE_ROLE_KEY;")}`),
      ],
    });
    expect(errors.some((e) => e.includes("服务端密钥 SUPABASE_SERVICE_ROLE_KEY"))).toBe(true);
  });

  it("does not flag secrets read from server modules or tests", () => {
    const { errors } = auditEnvDocs({
      docs: `${docs()}\n| \`SUPABASE_SERVICE_ROLE_KEY\` | 是 | 仅服务端 |`,
      sources: [
        ...baseline(),
        src("src/lib/supabase/admin.ts", ts("return process.env.SUPABASE_SERVICE_ROLE_KEY;")),
        src("src/lib/x.test.ts", ts("return process.env.AI_API_KEY;")),
      ],
    });
    expect(errors).toEqual([]);
  });

  it("requires the NEXT_PUBLIC_ exposure note", () => {
    const { errors } = auditEnvDocs({
      docs: docs().replace("NEXT_PUBLIC_ 前缀会内联到客户端 bundle，其余变量只在服务端可见。", "略。"),
      sources: [src("src/lib/x.ts", ts("return process.env.AI_API_KEY;"))],
    });
    expect(errors.some((e) => e.includes("NEXT_PUBLIC_"))).toBe(true);
  });

  it("ignores DB_TEST_/BACKUP_DRILL_ tooling variables", () => {
    const { errors } = auditEnvDocs({
      docs: docs(),
      sources: [
        ...baseline(),
        src("src/lib/x.ts", ts("return process.env.AI_API_KEY;")),
        src("scripts/db-test.ts", ts("return process.env.DB_TEST_IMAGE;")),
      ],
    });
    expect(errors).toEqual([]);
  });
});
