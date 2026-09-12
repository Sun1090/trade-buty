/**
 * 生成 / 校验仓库根目录的 CHANGELOG.md。
 *
 * 单一来源：src/data/release-notes.json（站点「更新日志」页面也读它）。
 * 用法：
 *   node scripts/generate-changelog.mjs            # 写入 CHANGELOG.md
 *   node scripts/generate-changelog.mjs --check    # 只校验（CI 阻断）
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataFile = path.join(root, "src/data/release-notes.json");
const outFile = path.join(root, "CHANGELOG.md");
const checkOnly = process.argv.includes("--check");

const SEMVER = /^\d+\.\d+\.\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const issues = [];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value) {
  return (
    ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function auditBilingualList(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${label} 必须是 { zh, en } 对象`);
    return { zh: [], en: [] };
  }
  for (const locale of ["zh", "en"]) {
    const list = value[locale];
    if (!Array.isArray(list) || list.length === 0) {
      issues.push(`${label}.${locale} 必须是非空数组`);
      continue;
    }
    if (!list.every(isNonEmptyString)) {
      issues.push(`${label}.${locale} 含空条目`);
    }
  }
  if (
    Array.isArray(value.zh) &&
    Array.isArray(value.en) &&
    value.zh.length !== value.en.length
  ) {
    issues.push(
      `${label} 中英条目数不一致：zh ${value.zh.length} / en ${value.en.length}`,
    );
  }
  return { zh: value.zh ?? [], en: value.en ?? [] };
}

function auditBilingualText(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${label} 必须是 { zh, en } 对象`);
    return { zh: "", en: "" };
  }
  for (const locale of ["zh", "en"]) {
    if (!isNonEmptyString(value[locale]))
      issues.push(`${label}.${locale} 不能为空`);
  }
  return { zh: value.zh ?? "", en: value.en ?? "" };
}

function render() {
  if (!fs.existsSync(dataFile)) {
    console.error(`[changelog] ❌ 缺少数据文件：${dataFile}`);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch (error) {
    console.error(`[changelog] ❌ ${dataFile} 不是合法 JSON：${error.message}`);
    process.exit(1);
  }

  const releases = Array.isArray(data.releases) ? data.releases : [];
  if (releases.length === 0) issues.push("releases 不能为空");

  const seenVersions = new Set();
  const normalized = releases.map((release, index) => {
    const label = `releases[${index}]`;
    const version = release?.version;
    if (!isNonEmptyString(version) || !SEMVER.test(version)) {
      issues.push(`${label}.version 必须是 x.y.z 形式`);
    } else if (seenVersions.has(version)) {
      issues.push(`${label}.version 重复：${version}`);
    } else {
      seenVersions.add(version);
    }
    if (!isNonEmptyString(release?.date) || !isIsoDate(release.date)) {
      issues.push(`${label}.date 必须是合法 ISO 日期（YYYY-MM-DD）`);
    }
    const name = auditBilingualText(release?.name, `${label}.name`);
    const highlights = auditBilingualList(
      release?.highlights,
      `${label}.highlights`,
    );
    const docs = Array.isArray(release?.docs) ? release.docs : [];
    if (!Array.isArray(release?.docs)) issues.push(`${label}.docs 必须是数组`);
    for (const doc of docs) {
      if (!isNonEmptyString(doc) || !fs.existsSync(path.join(root, doc))) {
        issues.push(`${label}.docs 指向不存在的文件：${doc}`);
      }
    }
    return { version, date: release?.date, name, highlights, docs };
  });

  for (let index = 1; index < normalized.length; index += 1) {
    if (String(normalized[index - 1].date) < String(normalized[index].date)) {
      issues.push(
        `releases 必须按日期从新到旧排列：${normalized[index - 1].version} (${normalized[index - 1].date}) 早于 ${normalized[index].version} (${normalized[index].date})`,
      );
    }
  }

  const unreleased = data.unreleased
    ? {
        date: data.unreleased.date,
        highlights: auditBilingualList(
          data.unreleased.highlights,
          "unreleased.highlights",
        ),
      }
    : null;
  if (unreleased && !isIsoDate(unreleased.date)) {
    issues.push("unreleased.date 必须是合法 ISO 日期（YYYY-MM-DD）");
  }
  if (unreleased && normalized[0] && unreleased.date < normalized[0].date) {
    issues.push(
      `unreleased.date (${unreleased.date}) 不能早于最新发布版本日期 (${normalized[0].date})`,
    );
  }

  const lines = [
    "# 变更日志（CHANGELOG）",
    "",
    "<!-- 由 `npm run changelog:generate` 从 src/data/release-notes.json 生成，请勿手工编辑。 -->",
    "",
    "> 站点内的「更新日志」页面（`/[locale]/changelog`）与本文件共用同一份数据（`src/data/release-notes.json`）。",
    "> v0.3 及更早的里程碑记录在 [docs/roadmap.md](docs/roadmap.md)。",
    "",
  ];

  if (unreleased) {
    lines.push(`## [未发布] - ${unreleased.date}`, "");
    lines.push("### 中文", "");
    for (const item of unreleased.highlights.zh) lines.push(`- ${item}`);
    lines.push("", "### English", "");
    for (const item of unreleased.highlights.en) lines.push(`- ${item}`);
    lines.push("");
  }

  for (const release of normalized) {
    lines.push(`## [${release.version}] - ${release.date}`, "");
    lines.push(`**${release.name.zh} / ${release.name.en}**`, "");
    lines.push("### 中文", "");
    for (const item of release.highlights.zh) lines.push(`- ${item}`);
    lines.push("", "### English", "");
    for (const item of release.highlights.en) lines.push(`- ${item}`);
    if (release.docs.length > 0) {
      lines.push(
        "",
        `参考：${release.docs.map((doc) => `[${doc}](${doc})`).join(" · ")}`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

const rendered = render();

if (issues.length > 0) {
  console.error("[changelog] ❌ 发布记录数据不合法：");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

const current = fs.existsSync(outFile)
  ? fs.readFileSync(outFile, "utf8")
  : null;

if (checkOnly) {
  if (current !== rendered) {
    console.error(
      "[changelog] ❌ CHANGELOG.md 与 src/data/release-notes.json 不一致：请运行 `npm run changelog:generate` 后提交。",
    );
    process.exit(1);
  }
  console.log(
    `[changelog] ✅ CHANGELOG.md 与发布记录数据一致（${rendered.match(/^## /gm)?.length ?? 0} 条：含未发布 + 已发布版本）`,
  );
} else {
  fs.writeFileSync(outFile, rendered);
  console.log(`[changelog] ✅ 已写入 ${path.relative(root, outFile)}`);
}
