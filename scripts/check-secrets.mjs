/**
 * Q5.3：扫描受版本控制及未忽略的新文件，阻断私钥、平台 token 与硬编码密钥。
 * 输出只包含文件、行列与规则名，不回显疑似凭据。
 *
 * R16.83：git 列不出文件（仓库损坏、在错误的目录下跑、ls-files 参数被改坏）时，
 * 待扫集合是空的，「0 处发现」会被打印成通过。列出的文件数因此也要过下限。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { scanText } from "./secret-scan-lib.mjs";
import { scanFloorViolation } from "./scan-floor-lib.mjs";

/** 实测（2026-09-24）git ls-files 列出 762 个文件；低于此只能是被扫的东西不见了，不是仓库瘦了两成。 */
const MIN_LISTED_FILES = 700;

const root = process.cwd();
const listed = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { cwd: root },
);
const files = listed.toString("utf8").split("\0").filter(Boolean);

const shrunk = scanFloorViolation({ count: files.length, floor: MIN_LISTED_FILES, what: "git 列出的待扫文件" });
if (shrunk) {
  console.error(`[secret-scan] ❌ ${shrunk}`);
  process.exit(1);
}

const findings = [];
let scanned = 0;
let skipped = 0;

for (const file of files) {
  const absolute = path.join(root, file);
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch {
    skipped += 1;
    continue;
  }
  if (!stat.isFile()) {
    skipped += 1;
    continue;
  }

  const content = fs.readFileSync(absolute);
  if (content.includes(0)) {
    skipped += 1;
    continue;
  }

  scanned += 1;
  findings.push(...scanText(content.toString("utf8"), file));
}

if (findings.length > 0) {
  console.error(`[secret-scan] ❌ 发现 ${findings.length} 处疑似凭据（仅显示位置，不回显值）：`);
  for (const finding of findings) {
    console.error(`  - ${finding.file}:${finding.line}:${finding.column} ${finding.label} (${finding.rule})`);
  }
  console.error("请移除凭据、吊销泄露值，并改用环境变量或密钥管理系统。");
  process.exit(1);
}

console.log(`[secret-scan] ✅ 已扫描 ${scanned} 个文本文件，未发现疑似凭据（跳过 ${skipped} 个非文本项）`);
