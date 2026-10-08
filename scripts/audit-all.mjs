import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `npm run audit:all` 的实现（R16.288）：跑全量依赖审计，但对「上游确认无补丁、
 * 有重审日期的例外」做**显式白名单**——其余任何 high / critical 照常 exit 1。
 *
 * 为什么需要这个门禁形态：2026-10-02 起 GHSA-vfj7-8cjw-p6xm（CVE-2026-93687，
 * braces 的二次时间 CPU DoS）把受影响范围改为 `<= 3.0.3` 全部版本且**无补丁**
 * （上游 micromatch / fast-glob 尚未迁移，`npm audit fix --force` 只能给
 * eslint-config-next 开破坏性降级）。受影响链是纯 dev 依赖（@next/eslint-plugin-next
 * 的 lint glob），`audit:prod` 全绿、生产运行时零暴露——但 `audit:all` 的硬门禁
 * 从此必然红。按 docs/deps.md 的延期先例（eslint 10 / typescript 7），例外必须
 * 带理由与重审日期，过期即自动转红，不允许永久白名单。
 *
 * 过滤是传递的：一个包若其 via 只引用（a）白名单内的通告或（b）已被过滤的包，
 * 它同样被过滤——否则「Depends on vulnerable versions of braces」的整条链
 * （micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next）
 * 依然会红。白名单条目同时校验包名，防止同 GHSA 号被挪用到别的包上。
 */

export const AUDIT_ALLOWLIST = [
  {
    ghsa: "GHSA-vfj7-8cjw-p6xm",
    packageName: "braces",
    /** 二次时间 CPU DoS（CVE-2026-93687），≤3.0.3 全部受影响且无补丁 */
    since: "2026-10-02",
    /** 重审日：到期后本条自动转红，强制重新评估上游是否已出补丁或迁移 */
    revisit: "2026-11-15",
    reason:
      "dev-only 链（@next/eslint-plugin-next 的 lint glob 经 fast-glob/micromatch 引入）；" +
      "生产依赖（audit:prod）零暴露；上游无补丁，npm audit fix --force 是破坏性降级",
  },
];

/** 纯函数：给定 npm audit --json 报告与白名单，判定通过与否及明细 */
export function evaluateAuditReport(report, allowlist, today = new Date().toISOString().slice(0, 10)) {
  const vulnerabilities = report?.vulnerabilities ?? {};
  if (Object.keys(vulnerabilities).length === 0) {
    return { ok: true, filtered: [], violations: [] };
  }

  const ghsaAllow = new Map(
    allowlist.map((entry) => [`${entry.ghsa}|${entry.packageName}`, entry]),
  );
  const filteredNames = new Set();
  const violations = [];
  const filtered = [];

  // 迭代到不动点：via 全部指向「白名单通告」或「已过滤的包」的包逐层被过滤
  let changed = true;
  const pending = new Set(Object.keys(vulnerabilities));
  while (changed) {
    changed = false;
    for (const name of Array.from(pending)) {
      const entry = vulnerabilities[name];
      if (!entry || !Array.isArray(entry.via)) continue;
      const direct = entry.via.filter((v) => typeof v === "object");
      const viaNames = entry.via.filter((v) => typeof v === "string");
      const allDirectAllowed =
        direct.length > 0 &&
        direct.every((v) => ghsaAllow.has(`${v.url?.split("/").pop()}|${name}`));
      const allViaFiltered = viaNames.length > 0 && viaNames.every((n) => filteredNames.has(n));
      const pass = allDirectAllowed || (direct.length === 0 && allViaFiltered);
      if (pass) {
        filteredNames.add(name);
        pending.delete(name);
        filtered.push({ name, via: entry.via });
        changed = true;
      }
    }
  }

  for (const name of pending) {
    const entry = vulnerabilities[name];
    if (!["high", "critical"].includes(entry.severity ?? "")) continue;
    violations.push({
      name,
      severity: entry.severity,
      range: entry.range,
      via: entry.via?.map((v) => (typeof v === "object" ? v.url ?? v.title ?? "?" : v)) ?? [],
    });
  }

  // 白名单过期检查：重审日一过，例外自动失效（转红并要求重新评审）
  const expired = allowlist.filter((entry) => today > entry.revisit);
  for (const entry of expired) {
    violations.push({
      name: `${entry.packageName}（白名单 ${entry.ghsa} 已过期）`,
      severity: "allowlist-expired",
      range: `重审日 ${entry.revisit}`,
      via: [],
    });
  }

  return { ok: violations.length === 0, filtered, violations };
}

export function main() {
  let report;
  try {
    const out = execFileSync(
      "npm",
      ["audit", "--json", "--audit-level=none", "--registry=https://registry.npmjs.org"],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    report = JSON.parse(out);
  } catch (error) {
    // npm audit 在有漏洞时 exit 非零：stdout 里仍是完整 JSON，从 error 对象恢复
    const stdout = error.stdout;
    try {
      report = JSON.parse(stdout);
    } catch {
      console.error("[audit:all] ❌ 无法取得审计报告：", String(error).slice(0, 200));
      process.exit(1);
    }
  }

  const result = evaluateAuditReport(report, AUDIT_ALLOWLIST);

  console.log(
    `[audit:all] 例外白名单 ${AUDIT_ALLOWLIST.length} 条（重审日：` +
      AUDIT_ALLOWLIST.map((e) => `${e.ghsa} → ${e.revisit}`).join(" / ") +
      "）",
  );
  for (const f of result.filtered) {
    console.log(`[audit:all] ⏭ 已按白名单过滤：${f.name}`);
  }
  if (result.ok) {
    console.log("[audit:all] ✅ 除白名单外无 high / critical 漏洞");
    return;
  }
  console.error("[audit:all] ❌ 存在未被白名单覆盖的高危漏洞：");
  for (const v of result.violations) {
    console.error(`  ${v.severity.toUpperCase()} ${v.name}（${v.range}）via ${v.via.join(", ") || "?"}`);
  }
  console.error(
    "  → 修复它们，或（确认上游无补丁且 dev-only 后）按 docs/deps.md 的延期先例补白名单条目并更新重审日",
  );
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
