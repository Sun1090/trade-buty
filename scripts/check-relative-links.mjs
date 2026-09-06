/**
 * R10.11：相对链接跨语言解析审计。
 * 逐篇用 remark（站点实际渲染同款解析器）抽取链接/图片目标，验证：
 *   1. 同语言存在性：目标章节/课程/资产在当前 locale 必须真实存在——
 *      相对链接写错 slug 会在渲染后变成 404（宽容渲染不报错）。
 *   2. en 镜像缺口：en 文档链接的目标在 en 不存在、但 zh 存在 → en 页 404
 *      （目标该补译，或链接该改/删）。跨语言镜像内容才有的漂移，逐页
 *      check:links（只看构建产物）覆盖不到。
 * 纯 KB 扫描，无需构建。用法：npm run check:relative-links
 */
import fs from "node:fs";
import path from "node:path";
import { linkNodes, resolveLinkTarget } from "./relative-link-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
const LOCALES = ["zh", "en"];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

/** 该 locale 合法内容集合：章节 slug 与 "chapter/doc"（README 存在的章节才算合法）。 */
function indexLocale(locale) {
  const set = new Set();
  const locRoot = path.join(KB, locale);
  for (const e of fs.readdirSync(locRoot, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const chDir = path.join(locRoot, e.name);
    if (!fs.existsSync(path.join(chDir, "README.md"))) continue;
    set.add(e.name);
    for (const f of fs.readdirSync(chDir)) {
      if (!f.endsWith(".md") || f === "README.md") continue;
      set.add(`${e.name}/${f.replace(/\.md$/, "")}`);
    }
  }
  return set;
}

function main() {
  if (!fs.existsSync(KB)) {
    console.error("[relative-links] 知识库缺失：请先 git submodule update --init");
    process.exit(1);
  }
  const zhIndex = indexLocale("zh");
  const enIndex = indexLocale("en");
  const problems = [];
  const counts = { link: 0, image: 0, checked: 0 };

  for (const locale of LOCALES) {
    const localeIndex = locale === "zh" ? zhIndex : enIndex;
    for (const file of walk(path.join(KB, locale))) {
      const relFile = path.relative(root, file);
      const m = relFile.match(/\/knowledge\/(zh|en)\/([^/]+)\/([^/]+)\.md$/);
      if (!m) continue;
      const [, , chapter] = m;
      const raw = fs.readFileSync(file, "utf8");

      for (const node of linkNodes(raw)) {
        counts[node.type] += 1;
        const target = resolveLinkTarget(node.url, chapter);
        if (target.kind === "external") continue;
        counts.checked += 1;

        if (target.kind === "asset") {
          const kbAsset = path.join(
            KB, locale, target.owner, "_assets", target.file
          );
          if (!fs.existsSync(kbAsset)) {
            problems.push(`${relFile} → 资产缺失（知识库侧）: ${node.url}`);
          }
          continue;
        }

        const key =
          target.kind === "chapter" ? target.chapter : `${target.chapter}/${target.doc}`;
        if (localeIndex.has(key)) continue;

        if (locale === "en" && target.kind === "doc" && zhIndex.has(key)) {
          problems.push(
            `${relFile} → ${key}：en 无该文档镜像（zh 存在）——en 页将 404，需补译或改链`
          );
        } else {
          problems.push(`${relFile} → 目标不存在: ${node.url}（解析为 ${key}）`);
        }
      }
    }
  }

  console.log(
    `[relative-links] 链接 ${counts.link} · 图片 ${counts.image} · 站内目标 ${counts.checked}`
  );
  if (problems.length > 0) {
    console.error(`❌ 相对链接问题 ${problems.length} 处：`);
    console.error([...new Set(problems)].slice(0, 40).join("\n"));
    process.exit(1);
  }
  console.log("✅ 相对链接解析通过（目标均存在且无 en 镜像缺口）");
}

main();
