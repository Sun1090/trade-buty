/**
 * lockfile 可复现性门禁的纯计算部分。
 *
 * 背景（2026-09-13 实测）：`package-lock.json` 的**形状由 npm 主版本决定**。
 * npm 11 会重排 root `devDependencies`，并删掉 `puppeteer-core/node_modules/*`
 * 这类嵌套 optional-peer 条目；npm 10 的 `npm ci` 随即报
 * `Missing: get-uri@8.0.1 from lock file`——错误信息完全看不出「生成 lockfile
 * 的 npm 和跑 CI 的 npm 不是同一个 major」这条真实原因。
 *
 * 本库只做纯函数：解析根 `package.json` 里的 npm 钉版、比较两次 lockfile 的
 * 包条目差异、生成可操作的失败文案。进程调用（跑 npm、读文件）留在
 * scripts/check-lockfile-reproducibility.mjs。
 */

/** 从 `devEngines.packageManager` 解析 npm 钉版；缺字段或不是 npm 时返回 null。 */
export function parseNpmPin(pkg) {
  const manager = pkg?.devEngines?.packageManager;
  if (!manager || manager.name !== "npm") return null;
  const version = String(manager.version ?? "").trim();
  if (!version) return null;
  const match = /^(?:\^|~)?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const major = /(\d+)/.exec(version.replace(/^[\^~>=]+/, ""))?.[1];
  return {
    version,
    major: major === undefined ? null : Number(major),
    exact: match ? `${match[1]}.${match[2]}.${match[3]}` : null,
    caret: version.startsWith("^"),
    tilde: version.startsWith("~"),
  };
}

/** `10.9.4` / `v10.9.4` → 10；解析不出来时返回 null。 */
export function npmMajorOf(version) {
  const match = /(\d+)/.exec(String(version ?? ""));
  return match ? Number(match[1]) : null;
}

/** 把 `A.B.C` 拆成可比较的数字数组；非法输入返回 null。 */
function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? "").trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareSemver(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/**
 * 运行中的 npm 版本是否落在钉版范围内（只支持 `X.Y.Z` / `^X.Y.Z` / `~X.Y.Z`）。
 * 范围本身解析不了时返回 true——门禁的判定权在 lockfile diff，不在版本串。
 */
export function isNpmVersionAllowed(version, pin) {
  const running = parseSemver(version);
  const floor = parseSemver(pin?.exact);
  if (!running) return false;
  if (!floor) return true;
  if (running[0] !== floor[0]) return false;
  if (!pin.caret && !pin.tilde) return compareSemver(running, floor) === 0;
  if (pin.caret) return compareSemver(running, floor) >= 0;
  return compareSemver(running, floor) >= 0 && running[1] === floor[1];
}

/** lockfile 的顶层包条目名（`packages` 的 key，去掉首尾空档）。 */
export function lockPackageKeys(lock) {
  return Object.keys(lock?.packages ?? {}).sort();
}

/** 两次 lockfile 的包条目差异：added = 重新生成后多出来的条目。 */
export function diffLockPackages(before, after) {
  const beforeKeys = new Set(lockPackageKeys(before));
  const afterKeys = new Set(lockPackageKeys(after));
  return {
    added: lockPackageKeys(after).filter((key) => !beforeKeys.has(key)),
    removed: lockPackageKeys(before).filter((key) => !afterKeys.has(key)),
  };
}

/** 生成失败文案：把「哪个 npm 生成的」「CI 用哪个 npm」直接摊开。 */
export function formatDriftReport({ runningNpm, pin, added = [], removed = [], registry }) {
  const lines = [
    "❌ package-lock.json 与当前 npm 不可复现——重新生成会得到不同的文件。",
    "",
    `运行中的 npm：${runningNpm}（CI 期望：npm ${pin?.version ?? "未声明"}）`,
    registry ? `解析用的 registry：${registry}` : null,
    "",
    "重新生成后新增的包条目：",
    ...(added.length ? added.slice(0, 20).map((key) => `  + ${key}`) : ["  （无）"]),
    "重新生成后消失的包条目：",
    ...(removed.length ? removed.slice(0, 20).map((key) => `  - ${key}`) : ["  （无）"]),
    "",
    "这意味着生成这份 lockfile 的 npm 主版本和当前 npm 主版本不是同一个。",
    "修复：用 CI 的 npm 主版本重新生成，并把退出码写进 PR：",
    `  npx --yes npm@${pin?.exact ?? "<CI 的 npm 版本>"} install --package-lock-only --registry=https://registry.npmjs.org`,
    "  git add package-lock.json",
    "详见 docs/deps.md「lockfile 工具链漂移（npm 10 vs npm 11）」。",
  ];
  return lines.filter((line) => line !== null).join("\n");
}
