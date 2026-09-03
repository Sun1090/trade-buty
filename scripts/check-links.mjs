import fs from "node:fs";
import path from "node:path";

/**
 * 死链检查：扫描构建产物 HTML，把站内链接与构建输出交叉验证。
 * 用法: npm run build && npm run check:links
 * - 路由/资产 404 → exit 1（CI 阻断）
 * - 锚点缺失 → 仅报告（知识库原文锚点写法多样，逐个修）
 */
const root = process.cwd();
const appOut = path.join(root, ".next/server/app");
const publicDir = path.join(root, "public");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html") && !e.name.startsWith("_")) out.push(p);
  }
  return out;
}

function routeToFile(urlPath) {
  // /zh/review -> .next/server/app/zh/review.html ; /zh -> .next/server/app/zh.html
  const rel = urlPath.replace(/^\/+|\/+$/g, "");
  if (!rel) return null; // "/" 走 proxy 重定向，无对应 html
  const direct = path.join(appOut, rel + ".html");
  if (fs.existsSync(direct)) return direct;
  return null;
}

function collectIds(html) {
  const ids = new Set();
  const re = / id="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  return ids;
}

function main() {
  if (!fs.existsSync(appOut)) {
    console.error("[links] 缺少构建产物：请先 npm run build");
    process.exit(1);
  }
  const files = walk(appOut);
  let checked = 0;
  const broken = [];
  const anchorMiss = [];

  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    const ids = collectIds(html);
    const seen = new Set();
    const re = / href="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const raw = m[1];
      if (
        !raw.startsWith("/") ||
        raw.startsWith("/_next") ||
        raw.startsWith("//") ||
        raw.startsWith("/manifest.webmanifest") ||
        raw.startsWith("/favicon.ico") ||
        raw.startsWith("/icon")
      )
        continue; // Next.js 框架动态元数据路由（manifest/icon），运行时存在
      const [noQuery] = raw.split("?");
      const hashIdx = noQuery.indexOf("#");
      const urlPath =
        hashIdx === -1 ? noQuery : noQuery.slice(0, hashIdx) || null;
      const frag =
        hashIdx === -1 ? null : decodeURIComponent(noQuery.slice(hashIdx + 1));
      const key = raw;
      if (seen.has(key)) continue;
      seen.add(key);
      checked++;

      // 纯本页锚点
      if (urlPath === null) {
        if (frag && !ids.has(frag) && !ids.has(encodeURIComponent(frag))) {
          anchorMiss.push(`${file} #${frag}`);
        }
        continue;
      }

      let targetFile = null;
      if (urlPath.startsWith("/knowledge-assets/")) {
        const p = path.join(publicDir, decodeURIComponent(urlPath));
        if (!fs.existsSync(p)) broken.push(`${file} → ${raw}（资产缺失）`);
      } else if (/\.\w+$/.test(urlPath)) {
        // search-index.json / sitemap.xml / robots.txt / favicon 等
        const p = path.join(publicDir, decodeURIComponent(urlPath));
        if (!fs.existsSync(p)) broken.push(`${file} → ${raw}（静态文件缺失）`);
      } else {
        targetFile = routeToFile(urlPath.split("?")[0]);
        if (!targetFile) {
          broken.push(`${file} → ${raw}（路由无构建产物）`);
          continue;
        }
      }

      // 跨页锚点
      if (frag && targetFile) {
        const targetHtml = fs.readFileSync(targetFile, "utf8");
        const targetIds = collectIds(targetHtml);
        if (!targetIds.has(frag)) {
          anchorMiss.push(`${file} → ${raw}`);
        }
      }
    }
  }

  console.log(`[links] 检查 ${files.length} 页 / ${checked} 个站内链接`);
  if (anchorMiss.length > 0) {
    console.log(`[links] 锚点疑似缺失 ${anchorMiss.length} 处（仅报告）：`);
    for (const a of anchorMiss.slice(0, 30)) console.log(`  ~ ${a}`);
    if (anchorMiss.length > 30)
      console.log(`  …还有 ${anchorMiss.length - 30} 处`);
  }
  if (broken.length > 0) {
    console.error(`[links] 死链 ${broken.length} 处：`);
    for (const b of broken) console.error(`  ✗ ${b}`);
    process.exit(1);
  }
  console.log("[links] ✓ 无死链");
}

main();
