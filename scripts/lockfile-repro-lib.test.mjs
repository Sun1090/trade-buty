import { describe, expect, it } from "vitest";
import {
  diffLockPackages,
  formatDriftReport,
  isNpmVersionAllowed,
  lockPackageKeys,
  npmMajorOf,
  parseNpmPin,
} from "./lockfile-repro-lib.mjs";

/**
 * 2026-09-13 实测锚点：Dependabot 的 TS 6 PR（ddd2ca3）用 npm 11 生成 lockfile，
 * 相比 CI 的 npm 10 少了这 14 条 puppeteer-core 嵌套 optional-peer 条目。
 * 这里把它们作为真实回归 fixture，确保 diff 逻辑能抓到「npm major 漂移」。
 */
const NPM11_MISSING_KEYS = [
  "node_modules/proxy-agent-negotiate",
  "node_modules/puppeteer-core/node_modules/agent-base",
  "node_modules/puppeteer-core/node_modules/data-uri-to-buffer",
  "node_modules/puppeteer-core/node_modules/degenerator",
  "node_modules/puppeteer-core/node_modules/get-uri",
  "node_modules/puppeteer-core/node_modules/http-proxy-agent",
  "node_modules/puppeteer-core/node_modules/https-proxy-agent",
  "node_modules/puppeteer-core/node_modules/lru-cache",
  "node_modules/puppeteer-core/node_modules/pac-proxy-agent",
  "node_modules/puppeteer-core/node_modules/pac-resolver",
  "node_modules/puppeteer-core/node_modules/proxy-agent",
  "node_modules/puppeteer-core/node_modules/proxy-from-env",
  "node_modules/puppeteer-core/node_modules/socks-proxy-agent",
  "node_modules/quickjs-wasi",
];

/** 用一组 key 造出最小的 `{ packages: { ... } }` 形状。 */
function lockOf(keys) {
  const packages = {};
  for (const key of keys) packages[key] = { version: "1.0.0" };
  return { lockfileVersion: 3, packages };
}

describe("parseNpmPin", () => {
  it("解析 caret 钉版并给出主版本与精确版本", () => {
    expect(parseNpmPin({ devEngines: { packageManager: { name: "npm", version: "^10.9.4" } } })).toEqual({
      version: "^10.9.4",
      major: 10,
      exact: "10.9.4",
      caret: true,
      tilde: false,
    });
  });

  it("解析 tilde 与裸版本", () => {
    expect(parseNpmPin({ devEngines: { packageManager: { name: "npm", version: "~10.9" } } }).exact).toBeNull();
    expect(parseNpmPin({ devEngines: { packageManager: { name: "npm", version: "10.9.4" } } })).toMatchObject({
      major: 10,
      exact: "10.9.4",
      caret: false,
      tilde: false,
    });
  });

  it("对非 npm 管理器、缺字段或空版本返回 null", () => {
    expect(parseNpmPin({ devEngines: { packageManager: { name: "pnpm", version: "^10.0.0" } } })).toBeNull();
    expect(parseNpmPin({ devEngines: {} })).toBeNull();
    expect(parseNpmPin({})).toBeNull();
    expect(parseNpmPin(undefined)).toBeNull();
    expect(parseNpmPin({ devEngines: { packageManager: { name: "npm", version: "   " } } })).toBeNull();
  });

  it("无法解析成 X.Y.Z 时仍给出主版本，但 exact 为 null", () => {
    const pin = parseNpmPin({ devEngines: { packageManager: { name: "npm", version: ">=11" } } });
    expect(pin.major).toBe(11);
    expect(pin.exact).toBeNull();
  });
});

describe("npmMajorOf", () => {
  it("提取数字主版本", () => {
    expect(npmMajorOf("10.9.4")).toBe(10);
    expect(npmMajorOf("v11.19.0")).toBe(11);
    expect(npmMajorOf("11")).toBe(11);
  });

  it("解析不出时返回 null", () => {
    expect(npmMajorOf("")).toBeNull();
    expect(npmMajorOf(undefined)).toBeNull();
    expect(npmMajorOf("latest")).toBeNull();
  });
});

describe("isNpmVersionAllowed", () => {
  const caret = parseNpmPin({ devEngines: { packageManager: { name: "npm", version: "^10.9.4" } } });
  const tilde = parseNpmPin({ devEngines: { packageManager: { name: "npm", version: "~10.9.4" } } });
  const exact = parseNpmPin({ devEngines: { packageManager: { name: "npm", version: "10.9.4" } } });

  it("caret 允许同 major 且不低于 floor", () => {
    expect(isNpmVersionAllowed("10.9.4", caret)).toBe(true);
    expect(isNpmVersionAllowed("10.12.0", caret)).toBe(true);
    expect(isNpmVersionAllowed("10.9.3", caret)).toBe(false);
    expect(isNpmVersionAllowed("11.19.0", caret)).toBe(false);
  });

  it("tilde 锁定 minor", () => {
    expect(isNpmVersionAllowed("10.9.9", tilde)).toBe(true);
    expect(isNpmVersionAllowed("10.10.0", tilde)).toBe(false);
  });

  it("裸版本要求完全一致", () => {
    expect(isNpmVersionAllowed("10.9.4", exact)).toBe(true);
    expect(isNpmVersionAllowed("10.9.5", exact)).toBe(false);
  });

  it("范围解析不了时判定权交给 lockfile diff（返回 true）", () => {
    const loose = parseNpmPin({ devEngines: { packageManager: { name: "npm", version: ">=11" } } });
    expect(isNpmVersionAllowed("10.9.4", loose)).toBe(true);
  });
});

describe("lockPackageKeys / diffLockPackages", () => {
  it("lockPackageKeys 稳定排序", () => {
    expect(lockPackageKeys(lockOf(["b", "a", "c"]))).toEqual(["a", "b", "c"]);
    expect(lockPackageKeys({})).toEqual([]);
    expect(lockPackageKeys(undefined)).toEqual([]);
  });

  it("检出 npm 11 → npm 10 缺失的 14 条条目", () => {
    // before = npm 11 生成的 lockfile（少了 14 条），after = npm 10 重新生成后（多了 14 条）
    const before = lockOf(["node_modules/typescript", "node_modules/eslint"]);
    const after = lockOf(["node_modules/typescript", "node_modules/eslint", ...NPM11_MISSING_KEYS]);
    const { added, removed } = diffLockPackages(before, after);
    expect(added).toHaveLength(14);
    expect(added).toEqual([...NPM11_MISSING_KEYS].sort());
    expect(removed).toEqual([]);
  });

  it("无漂移时 added / removed 都为空", () => {
    const lock = lockOf(["node_modules/a", "node_modules/b"]);
    expect(diffLockPackages(lock, lock)).toEqual({ added: [], removed: [] });
  });

  it("也能检出条目减少", () => {
    const before = lockOf(["node_modules/a", "node_modules/b"]);
    const after = lockOf(["node_modules/a"]);
    expect(diffLockPackages(before, after)).toEqual({ added: [], removed: ["node_modules/b"] });
  });
});

describe("formatDriftReport", () => {
  it("把运行版本、CI 期望、新增条目和修复命令都摊开", () => {
    const pin = parseNpmPin({ devEngines: { packageManager: { name: "npm", version: "^10.9.4" } } });
    const report = formatDriftReport({
      runningNpm: "11.19.0",
      pin,
      added: NPM11_MISSING_KEYS,
      removed: [],
      registry: "https://registry.npmjs.org",
    });
    expect(report).toContain("11.19.0");
    expect(report).toContain("npm ^10.9.4");
    expect(report).toContain("https://registry.npmjs.org");
    expect(report).toContain("+ node_modules/proxy-agent-negotiate");
    expect(report).toContain("npx --yes npm@10.9.4 install --package-lock-only");
    expect(report).toContain("docs/deps.md");
  });

  it("没有条目差异时给出（无）而不是空白", () => {
    const report = formatDriftReport({ runningNpm: "10.9.4", pin: null, added: [], removed: [] });
    expect(report).toContain("（无）");
    expect(report).toContain("未声明");
    expect(report).toContain("<CI 的 npm 版本>");
  });
});
