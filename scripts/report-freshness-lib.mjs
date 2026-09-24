/**
 * R16.26：重算型报告的新鲜度判定。
 *
 * `docs/*.md` / `docs/*.json` 里有一批是门禁当场重算出来的可审阅快照（走
 * `report-write-lib.mjs` 的 `writeReport`，内容不变就不重写，所以文件头那个日期
 * 读作「内容最后一次变化」）。但**没有任何一处比对「入库版本 == 当场重算结果」**：
 * `check:test-clock-hygiene` 这类步骤在 CI 里把文件重写了，工作区脏一下也没人看，
 * 于是 PR #218 新增一份测试文件之后，入库台账上的扫描数一直停在 286，
 * 全绿通过了好几个 PR。报告式台账的价值全在于「它是真的」，静默过期比没有更糟。
 *
 * 口径刻意只覆盖 `writeReport` 这条通道：按日追加的历史快照
 * （`kb:translation-status`、`kb:diff`）里日期本身就是数据，CI 跑一次就会合法地
 * 改动它们，纳进来只会制造噪声。范围由「谁用了这个保证幂等的写入器」推导，
 * 而不是手维护一张清单。
 */

const WRITE_REPORT = /writeReport\(/;
/** 报告落盘路径的两种写法：`path.join(root, "docs/x.md")` 与 `path.join(root, "docs", "x.md")`。 */
const DOCS_PATH = /path\.join\(\s*root\s*,\s*"docs(?:\/([^"]+))?"\s*(?:,\s*"([^"]+)")?\s*\)/g;

/**
 * 从一个巡检器源码里取出它用 `writeReport` 落盘的报告路径。
 * 不调用 `writeReport` 的脚本一个都不产出——这就是幂等通道的定义域。
 */
function scanReportPaths(sources) {
  const pairs = [];
  for (const { file, source } of sources ?? []) {
    if (!WRITE_REPORT.test(String(source))) continue;
    // 逐行扫，跳过注释行：`DOCS_PATH` 认的是字面形状，而形状这种东西注释里也会出现——
    // 实测一次「在注释里解释这个形状怎么写」就把 `docs/…` 这样一个不存在的报告登记进了清单
    // （清单是从源码里推导的，没人手写，所以多出来的那一条只能靠漂移报错才被发现）。
    for (const line of String(source).split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
      for (const match of line.matchAll(DOCS_PATH)) {
        const tail = match[1] ?? match[2];
        if (tail) pairs.push({ file, path: `docs/${tail.replace(/^\/+/, "")}` });
      }
    }
  }
  return pairs;
}

export function collectReportInventory(sources) {
  return [...new Set(scanReportPaths(sources).map((pair) => pair.path))].sort();
}

/**
 * 报告 → 写它的巡检器。清单只说「哪份过期」，读者还得知道去哪儿重算，
 * 所以这两份视图必须出自同一次扫描，而不是各扫一遍、各自漂移。
 */
export function collectReportProducers(sources) {
  const producers = new Map();
  for (const { file, path } of scanReportPaths(sources)) {
    const files = producers.get(path) ?? [];
    if (!files.includes(file)) files.push(file);
    producers.set(path, files);
  }
  return producers;
}

/**
 * `git status --porcelain -uall` → 命中清单的路径。
 * porcelain 每行形如 `XY <path>`，重命名是 `R new -> old`，取新路径。
 */
export function parsePorcelain(output) {
  const changed = [];
  for (const line of String(output ?? "").split("\n")) {
    if (!line.trim()) continue;
    const payload = line.slice(3);
    const arrow = payload.indexOf(" -> ");
    changed.push((arrow >= 0 ? payload.slice(arrow + 4) : payload).trim());
  }
  return changed;
}

/** 报告在库里的状态：未跟踪（新报告忘了提交）也算不新鲜。 */
export function assessFreshness({ inventory, statusOutput, tracked }) {
  const trackedSet = new Set(tracked ?? []);
  const changed = new Set(parsePorcelain(statusOutput));
  const stale = inventory.filter((file) => changed.has(file));
  const untracked = inventory.filter((file) => !trackedSet.has(file));
  return { stale, untracked };
}

export function shouldFailFreshness({ inventory, stale, untracked, minReports }) {
  if (inventory.length < (minReports ?? 15)) {
    return "inventory-too-small";
  }
  return stale.length > 0 || untracked.length > 0 ? "stale-reports" : null;
}

export function renderFreshnessFailure({
  reason,
  inventory,
  stale,
  untracked,
  minReports,
  producers,
  commands,
}) {
  if (reason === "inventory-too-small") {
    return [
      `[report-freshness] ❌ 只推导出 ${inventory.length} 份报告（下限 ${minReports ?? 15}）。`,
      "  写入器或路径写法变了，巡检器会退化成「零份要核对」——先修巡检器本身。",
    ].join("\n");
  }
  const lines = ["[report-freshness] ❌ 入库的重算型报告与当场重算不一致："];
  for (const file of stale) {
    lines.push(`  - ${file}：门禁重跑改写了它，说明入库版本是过期的（把重算结果一起提交）`);
    lines.push(...producerHints(file, producers, commands));
  }
  for (const file of untracked) {
    lines.push(`  - ${file}：巡检器会写它，但它在仓库里不存在（新报告漏提交）`);
    lines.push(...producerHints(file, producers, commands));
  }
  return lines.join("\n");
}

/** 指出去哪儿重算：能对上 package.json 脚本名就给 npm run，对不上就给脚本路径。 */
function producerHints(file, producers, commands) {
  const files = producers?.get?.(file) ?? producers?.[file] ?? [];
  return files.map((script) => {
    const name = commands?.[script];
    return `      重算：${name ? `npm run ${name}` : `node scripts/${script}`}，然后把新内容一起提交`;
  });
}
