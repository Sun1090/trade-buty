/**
 * R16.321：`docs/perf-notes.md` 最新那张复测表的**实测列**，必须在 build 之后判。
 *
 * 为什么这一半不住在 Vitest 里（与 `scripts/manifest-artifact.mjs` 同一族、同一条理由）：
 * CI 的 `npm run test:coverage` 排在 `npm run build` **之前**，单元测试跑的时候根本没有
 * `.next`。R16.306 那条「实测列与当场重算逐字一致」因此自建立起在 CI 里**必然**走
 * 「缺产物 → 明说跳过」分支（2026-10-13 实测 main 上 run 38305102894 的日志印的就是那句跳过）——
 * CI 的绿灯从来没为这句话签过字。而本地能判，靠的是工作区里恰好有一份 `.next`，
 * 那份产物属于**上一次构建的那棵树**，不是被测的这棵：后果是判据系统性滞后一步，
 * 任何改变产物字节的提交，第一趟链绿、第二趟链红。
 *
 * 现在这半住在 `check:bundle` 里（它本来就跑在 build 之后，产物现成，且已经量过全部路由）。
 *
 * 第二件事：**读数依赖宿主 zlib 的 deflate 行为**，跨环境不可比（实测 darwin 与 linux 之间
 * 14 个可比分组 14/14 全不同，CI 那侧每组偏高 +0.9~+2.3KB）。所以判之前先对**行为指纹**
 * （`deflate-fingerprint.mjs`，量的是「这段输入压成多少字节」，不是版本号）：
 * 指纹与表上登记的那份不符时**明说跳过并印出两边指纹**——跳过要有理由、要看得见，
 * 而不是像以前那样由步骤顺序造成一场静默的不判。
 *
 * 纯函数、无副作用：产物由调用方读好递进来，返回 `{ skipped, issues, notes }`。
 */

/** 表上登记指纹那一行的锚点（找不到 = 表被改坏了，不许静默放过） */
export const FINGERPRINT_CLAIM = "- 记录环境指纹：";

/** 与判据同口径：`static-info` 那组排除 `/changelog`（它的读数由 git 历史决定，见 R16.308） */
export const EXCLUDED_MAX_ROUTES = Object.freeze([/\/changelog$/]);

function isExcluded(route) {
  return EXCLUDED_MAX_ROUTES.some((re) => re.test(route));
}

/** 取以某个前缀开头的那一行（找不到返回 null，由调用方决定怎么响） */
function docLine(doc, prefix) {
  return doc.split("\n").find((line) => line.startsWith(prefix)) ?? null;
}

/**
 * 从文档里读出**最新那张**复测表：分组 → { maxTotalKB, maxRoute }，以及那一节登记的指纹。
 * 只认最后一张（历史那几张留着当历史，拿今天的产物要求它们等于要求历史撒谎）。
 */
export function parseCurrentTable(doc) {
  const lines = doc.split("\n");
  const headings = lines
    .map((line, i) => (line.startsWith("### 复测") ? i : -1))
    .filter((i) => i >= 0);
  if (headings.length === 0) return { rows: new Map(), fingerprint: null, headingCount: 0 };
  const start = headings[headings.length - 1];
  const section = lines.slice(start);
  const rows = new Map();
  for (const line of section) {
    // 两列表头不同（首次那张多一列「路由数」），故两列都认，按「有没有数字+KB」取。
    const m = line.match(
      /^\|\s*([a-z-]+)\s*\|\s*(?:(?:\d+)\s*\|\s*)?([\d.]+)\s*KB\s*\|[^|]*\|\s*`([^`]+)`\s*\|/,
    );
    if (m) rows.set(m[1], { maxTotalKB: Number(m[2]), maxRoute: m[3] });
  }
  const claim = docLine(section.join("\n"), FINGERPRINT_CLAIM);
  const fingerprint = claim ? (claim.match(/`([0-9a-f]{6,64})`/)?.[1] ?? null) : null;
  return { rows, fingerprint, headingCount: headings.length };
}

/** 从「已按路由量好的读数」算出每组最大值（与文档那张表同一口径） */
export function groupMaxima({ measurements, budgets, formatKB }) {
  const byGroup = new Map();
  for (const budget of budgets) {
    const group = measurements.filter((m) => m.budget?.id === budget.id && !isExcluded(m.route));
    if (group.length === 0) continue;
    const max = group.reduce((a, c) => (c.metrics.total > a.metrics.total ? c : a));
    byGroup.set(budget.id, {
      maxTotalKB: Number(formatKB(max.metrics.total)),
      maxBytes: max.metrics.total,
      maxRoute: max.route,
    });
  }
  return byGroup;
}

/**
 * 主判据。`currentFingerprintId` 由调用方现量（`fingerprintId(deflateFingerprint(gzip))`），
 * 本函数**不碰 node:zlib**，这样用例可以注入假指纹来验证「跳过真的是指纹那一支造成的」。
 */
export function checkPerfReadings({
  doc,
  measurements,
  budgets,
  formatKB,
  currentFingerprintId,
  minRows = 13,
}) {
  const notes = [];
  const issues = [];
  const { rows, fingerprint, headingCount } = parseCurrentTable(doc);

  // ① 表本身的完整性**不受指纹影响**：表没了、行形状变了，无论在哪台机器上都得红。
  if (headingCount === 0) {
    issues.push("docs/perf-notes.md 里一张复测表都没有了——实测列的判据会随之空转");
    return { skipped: false, issues, notes };
  }
  if (rows.size < minRows) {
    issues.push(
      `最新那张表只解析出 ${rows.size} 行（下限 ${minRows}）——行形状变了或整表被删，比对会空转`,
    );
  }
  for (const name of rows.keys()) {
    if (!budgets.some((b) => b.id === name)) {
      issues.push(`表里有个清单里没有的分组：${name}`);
    }
  }
  if (!fingerprint) {
    issues.push(
      `最新那张表里没有「${FINGERPRINT_CLAIM.trim()}」那一行（或它没带一个十六进制 id）——` +
        `实测列依赖测量环境的 deflate 行为，不登记指纹就没法判断这台机器能不能判`,
    );
    return { skipped: false, issues, notes };
  }

  // ② 环境不对就**明说跳过**：这不是失败，但也不能读成「一致」。
  if (fingerprint !== currentFingerprintId) {
    notes.push(
      `[perf-readings] 跳过实测列比对：这台机器的 deflate 行为与录表时不同\n` +
        `  表登记 ${fingerprint} · 当场量 ${currentFingerprintId}\n` +
        `  （实测跨环境的读数差在 KB 量级，比一次真实回归大两个数量级，逐字比对必然假红）`,
    );
    return { skipped: true, issues, notes };
  }

  // ③ 同一把尺上才逐字比。不给容差（R16.306），但报错要带字节——
  //    读数贴着 0.1KB 档界时，「差 0.1」可能只是产物在界上抖，字节数才说得清是哪一种。
  const actual = groupMaxima({ measurements, budgets, formatKB });
  for (const [id, row] of rows) {
    const now = actual.get(id);
    if (!now) {
      issues.push(`${id}：表里列着，产物里量不到这一组（路由数为 0？）`);
      continue;
    }
    if (now.maxTotalKB !== row.maxTotalKB) {
      issues.push(
        `${id}：最大 total 表 ${row.maxTotalKB}KB / 实测 ${now.maxTotalKB}KB（实测 ${now.maxBytes} 字节）`,
      );
    }
    if (now.maxRoute !== row.maxRoute) {
      issues.push(`${id}：最大路由 表 ${row.maxRoute} / 实测 ${now.maxRoute}`);
    }
  }
  if (issues.length === 0) {
    notes.push(
      `[perf-readings] ✓ 实测列与当场重算逐字一致：${rows.size} 组 · 环境指纹 ${fingerprint}`,
    );
  }
  return { skipped: false, issues, notes };
}
