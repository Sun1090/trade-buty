import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { auditEnvDocs, extractDocumentedVars, extractEnvRefs, extractExampleVars, isClientModule, loadSources, loadExample, run } from "./env-docs.mjs";

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
      example: loadExample(),
    });
    expect(errors).toEqual([]);
    expect(required).toContain("AI_API_KEY");
    expect(required).toContain("NEXT_PUBLIC_AI_ENABLED");
    expect(required).toContain("SUPABASE_SERVICE_ROLE_KEY");
    // 三方对账不空转：示例文件与代码读取集今天恰好一一对应，
    // 任何一侧漂移（新增变量忘了登记示例、或示例留了幽灵）都会让上面 errors 变红。
    expect(extractExampleVars(loadExample()).size).toBe(required.length);
  });

  it("flags a variable the code reads that the example file omits", () => {
    const sources = [
      ...baseline(),
      src("src/lib/ai.ts", ts("return process.env.AI_API_KEY;")),
    ];
    // 对照：示例文件列全时不报错，否则下面这条断言可能只是 fixture 本身坏了。
    expect(
      auditEnvDocs({
        docs: docs(),
        sources,
        example: "NEXT_PUBLIC_SITE_URL=https://example.com\nAI_API_KEY=your_key\n",
      }).errors
    ).toEqual([]);

    const { errors } = auditEnvDocs({
      docs: docs(),
      sources,
      example: "NEXT_PUBLIC_SITE_URL=https://example.com\n",
    });
    expect(errors.some((e) => e.includes(".env.example 未列出 AI_API_KEY"))).toBe(true);
  });

  it("flags a ghost variable that only the example file still lists", () => {
    const { errors } = auditEnvDocs({
      docs: docs(),
      sources: baseline(),
      example: "NEXT_PUBLIC_SITE_URL=https://example.com\nAI_GONE_KEY=whatever\n",
    });
    expect(errors.some((e) => e.includes("幽灵") && e.includes("AI_GONE_KEY"))).toBe(true);
  });

  it("counts commented-out example lines as registered", () => {
    expect([...extractExampleVars("# AI_RETRIEVAL_JSON=\nADMIN_TOKEN=x")].sort()).toEqual([
      "ADMIN_TOKEN",
      "AI_RETRIEVAL_JSON",
    ]);
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

  it("recognizes a client directive after leading comments without catastrophic backtracking", () => {
    expect(isClientModule('// copyright\n/* license */\n"use client";\n')).toBe(true);
    expect(isClientModule('/* never closed\n"use client";\n')).toBe(false);
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

it("runs the real CLI entrypoint success and failure branches", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "env-docs-run-"));
  fs.mkdirSync(path.join(root, "src/lib"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/env.md"), docs());
  fs.writeFileSync(path.join(root, "src/lib/site.ts"), 'export function f() { return process.env.NEXT_PUBLIC_SITE_URL; }\nexport function a() { return process.env.AI_API_KEY; }\n');
  fs.writeFileSync(path.join(root, "next.config.ts"), "const config = { async headers() { return []; } };\n");
  fs.writeFileSync(path.join(root, ".env.example"), "NEXT_PUBLIC_SITE_URL=https://example.com\nAI_API_KEY=your_key\n");
  try {
    let code = null;
    const logs = [];
    run({ rootDir: root, log: (message) => logs.push(String(message)), error: () => undefined, exit: (value) => { code = value; } });
    expect(code).toBeNull();
    expect(logs[0]).toContain("2 个运行时变量");

    // 示例文件本身缺席（今天 CONTRIBUTING.md 指向的就是一个从未入库的文件）也要报错。
    fs.rmSync(path.join(root, ".env.example"));
    let missingCode = null;
    const missingErrors = [];
    run({ rootDir: root, log: () => undefined, error: (message) => missingErrors.push(String(message)), exit: (value) => { missingCode = value; } });
    expect(missingCode).toBe(1);
    expect(missingErrors.join("\n")).toContain(".env.example 不存在");
    fs.writeFileSync(path.join(root, ".env.example"), "NEXT_PUBLIC_SITE_URL=https://example.com\nAI_API_KEY=your_key\n");

    fs.writeFileSync(path.join(root, "docs/env.md"), docs().replace("`AI_API_KEY`", "AI_API_KEY"));
    let failCode = null;
    const errors = [];
    run({ rootDir: root, log: () => undefined, error: (message) => errors.push(String(message)), exit: (value) => { failCode = value; } });
    expect(failCode).toBe(1);
    expect(errors.join("\n")).toContain("docs/env.md 未登记 AI_API_KEY");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
