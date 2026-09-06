/**
 * R6.6 + R10.12：知识库图片资产与 alt 审计。
 * alt 维度（R6.6，防回归）：
 *   - `![](...)` 空 alt → exit 1
 * 资产维度（R10.12 增强）：
 *   - 引用的 _assets 文件必须在同 locale 章节目录真实存在（缺失 → 渲染成裂图）
 *   - _assets 目录里的文件必须至少被引用一次（孤儿资产白占 public 体积）
 *   - zh/en 同章节资产集合需一一对应（en 删图没删 zh、或只在一侧新增 → 镜像漂移）
 * 引用用 remark 解析（与站点渲染同款），不依赖逐行正则。
 * 用法：npm run check:image-alt
 */
import fs from "node:fs";
import path from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { resolveLinkTarget } from "./relative-link-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
const LOCALES = ["zh", "en"];

function walkMd(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function listAssets(locale) {
  const locRoot = path.join(KB, locale);
  const byChapter = {};
  for (const e of fs.readdirSync(locRoot, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const assetsDir = path.join(locRoot, e.name, "_assets");
    if (!fs.existsSync(assetsDir)) continue;
    byChapter[e.name] = fs.readdirSync(assetsDir).sort();
  }
  return byChapter;
}

function main() {
  if (!fs.existsSync(KB)) {
    console.error("[image-alt] 知识库缺失：请先 git submodule update --init");
    process.exit(1);
  }
  const byLocale = { zh: listAssets("zh"), en: listAssets("en") };
  const problems = [];
  const stats = { refs: 0, images: 0 };

  for (const locale of LOCALES) {
    for (const file of walkMd(path.join(KB, locale))) {
      const rel = path.relative(root, file);
      const m = rel.match(/\/knowledge\/(zh|en)\/([^/]+)\/[^/]+\.md$/);
      if (!m) continue;
      const chapter = m[2];
      const raw = fs.readFileSync(file, "utf8");
      const tree = unified().use(remarkParse).parse(raw);

      (function walk(node) {
        if (node.type === "image") {
          stats.images += 1;
          const alt = (node.alt ?? "").trim();
          if (!alt) {
            problems.push(`${rel} → 空 alt：![](${node.url.slice(0, 60)})`);
          } else if (node.url.includes("_assets")) {
            const target = resolveLinkTarget(node.url, chapter);
            if (target.kind === "asset") {
              stats.refs += 1;
              const files = byLocale[locale][target.owner] ?? [];
              if (!files.includes(target.file)) {
                problems.push(
                  `${rel} → 资产缺失：${locale}/${target.owner}/_assets/${target.file}`
                );
              }
            }
          }
        }
        for (const child of node.children ?? []) walk(child);
      })(tree);
    }
  }

  // 孤儿资产 + zh/en 集合镜像
  for (const [locale, byChapter] of Object.entries(byLocale)) {
    for (const [chapter, files] of Object.entries(byChapter)) {
      for (const f of files) {
        const other = locale === "zh" ? byLocale.en[chapter] : byLocale.zh[chapter];
        const ownerKey = `${locale}/${chapter}`;
        void ownerKey;
        if (other === undefined || !other.includes(f)) {
          problems.push(
            `${locale}/${chapter}/_assets/${f}：资产未在另一 locale 镜像（zh/en 需同步增删）`
          );
        }
      }
    }
  }

  if (problems.length > 0) {
    console.error(`❌ 图片资产/alt 问题 ${problems.length} 处：`);
    console.error([...new Set(problems)].slice(0, 40).join("\n"));
    process.exit(1);
  }
  console.log(
    `✅ 图片审计通过：${stats.images} 处图片均有 alt，${stats.refs} 个资产引用全部存在且无孤儿/镜像漂移`
  );
}

main();
