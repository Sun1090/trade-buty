import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { evaluateAuditReport, AUDIT_ALLOWLIST } from "./audit-all.mjs";

const CLI = fileURLToPath(import.meta.url).replace(/\.test\.mjs$/, ".mjs");

describe("audit:all 的 CLI 真的会跑 main（R16.288 曾把入口漏掉，门禁哑火六天）", () => {
  it("直接以脚本执行会打出审计报告，而不是 import 完就静默退出", () => {
    const proc = spawnSync(process.execPath, [CLI], { encoding: "utf8", timeout: 180_000 });
    // 白名单外若有 high/critical 应 exit 1 并点名，那同样是在「跑」；
    // 只有哑火的 no-op 才是 exit 0 + 零输出。
    expect(proc.stdout + proc.stderr).toMatch(/\[audit:all\]/);
    expect([0, 1]).toContain(proc.status);
  }, 180_000);

  it("被 import 时不触发 CLI（单测必须只跑纯函数，不联网、不 process.exit）", () => {
    const url = new URL(`file://${CLI}`).href;
    const proc = spawnSync(
      process.execPath,
      ["-e", `import(${JSON.stringify(url)}).then(m => console.log('OK', Object.keys(m).join(',')))`],
      { encoding: "utf8", timeout: 60_000 },
    );
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("OK");
    expect(proc.stdout).not.toMatch(/\[audit:all\]/);
  });
});

/** 与白名单同形的测试夹具 */
const bracesChain = {
  braces: {
    severity: "high",
    range: "<=3.0.3",
    via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }],
  },
  micromatch: { severity: "high", range: "*", via: ["braces"] },
  "fast-glob": { severity: "high", range: "*", via: ["micromatch"] },
  "@next/eslint-plugin-next": { severity: "high", range: "*", via: ["fast-glob"] },
  "eslint-config-next": { severity: "high", range: "*", via: ["@next/eslint-plugin-next"] },
};

describe("audit:all 白名单判定（R16.288）", () => {
  it("零报告直接通过", () => {
    const r = evaluateAuditReport({ vulnerabilities: {} }, AUDIT_ALLOWLIST);
    expect(r.ok).toBe(true);
    expect(r.filtered).toEqual([]);
  });

  it("braces 传递链整条被过滤（5 个包，含四层 via 传递）", () => {
    const r = evaluateAuditReport({ vulnerabilities: bracesChain }, AUDIT_ALLOWLIST);
    expect(r.ok).toBe(true);
    expect(r.filtered.map((f) => f.name).sort()).toEqual([
      "@next/eslint-plugin-next",
      "braces",
      "eslint-config-next",
      "fast-glob",
      "micromatch",
    ]);
  });

  it("链上混入非白名单的高危 → 拦截并点名", () => {
    const r = evaluateAuditReport(
      { vulnerabilities: { ...bracesChain, "some-evil": {
        severity: "high",
        range: "<2.0.0",
        via: [{ url: "https://github.com/advisories/GHSA-xxxx" }],
      } } },
      AUDIT_ALLOWLIST,
    );
    expect(r.ok).toBe(false);
    expect(r.violations.map((v) => v.name)).toEqual(["some-evil"]);
  });

  it("同 GHSA 号挪用到别的包上 → 不算白名单覆盖，拦截", () => {
    const r = evaluateAuditReport(
      { vulnerabilities: { "impersonator": {
        severity: "high",
        range: "*",
        via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }],
      } } },
      AUDIT_ALLOWLIST,
    );
    expect(r.ok).toBe(false);
    expect(r.violations.map((v) => v.name)).toEqual(["impersonator"]);
  });

  it("白名单重审日一过 → 例外自动失效转红", () => {
    const r = evaluateAuditReport(
      { vulnerabilities: bracesChain },
      [{ ...AUDIT_ALLOWLIST[0], revisit: "2026-01-01" }],
      "2026-02-01",
    );
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "allowlist-expired")).toBe(true);
  });

  it("重审日当天仍有效", () => {
    const r = evaluateAuditReport(
      { vulnerabilities: bracesChain },
      [{ ...AUDIT_ALLOWLIST[0], revisit: "2026-10-02" }],
      "2026-10-02",
    );
    expect(r.ok).toBe(true);
  });

  it("moderate 漏洞不在本门禁射程（audit-level=high）", () => {
    const r = evaluateAuditReport(
      { vulnerabilities: { minor: { severity: "moderate", range: "*", via: [{ url: "https://github.com/advisories/GHSA-mmm" }] } } },
      AUDIT_ALLOWLIST,
    );
    expect(r.ok).toBe(true);
  });
});
