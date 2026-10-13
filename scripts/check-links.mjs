import fs from "node:fs";
import path from "node:path";

/**
 * 死链检查：扫描构建产物 HTML，把站内链接与构建输出交叉验证。
 * 用法: npm run build && npm run check:links
 * - 路由/资产 404 → exit 1（CI 阻断）
 * - 锚点缺失 → exit 1（R16.325 起从「仅报告」升级为阻断，理由见下面 anchorMiss 那段注释）
 *
 * **R16.325：这道门禁以前根本不查同页锚点**。过滤条件 `!raw.startsWith("/")` 排在
 * 前面，于是 `href="#…"`（课文页「本页目录」的全部条目）在第一步就被 continue 掉，
 * 下面那段「纯本页锚点」的分支**永远进不去**——它是不可达代码，而它身后是产物里
 * 每页去重后 7811 处同页锚点（总出现 15624 次：桌面侧栏与移动 `<details>` 各一份目录），
 * 分布在 364 个页面上，一处都没被核过。
 * 实测漏法：往一篇课文的产物 HTML 里插两条死锚点（一条 `href="#不存在"`、一条
 * `href="/本页#不存在"`）→ 只有后者被报出来，前者静默通过。
 * 现在两条形状都查，并加一条**地板**：同页锚点计数为 0 就红（正是当初能抓住这个 bug 的那句话）。
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
  /** 两类锚点各数一遍，供地板判据使用（R16.325：不数就不知道自己没扫到） */
  let samePageAnchors = 0;
  let crossPageAnchors = 0;

  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    const ids = collectIds(html);
    const seen = new Set();
    const re = / href="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const raw = m[1];
      if (
        // 同页锚点（`href="#…"`）要查，所以不能一律要求以 `/` 开头（R16.325）。
        (!raw.startsWith("/") && !raw.startsWith("#")) ||
        raw.startsWith("/_next") ||
        raw.startsWith("//") ||
        // 根级那份 + R16.292 的 `/{locale}/manifest.webmanifest`。
        // 用正则而不是逐个列举 `/zh/…` `/en/…`：语言增删时不必回来改这里（那正是本条被漏掉的原因）。
        /^\/(?:[a-z]{2}\/)?manifest\.webmanifest$/.test(raw) ||
        raw.startsWith("/favicon.ico") ||
        raw.startsWith("/icon")
      )
        // Next.js 框架动态元数据路由（manifest/icon），运行时存在，不产出 html 文件——
        // 带语言前缀的那份（R16.292）是**动态 Route Handler**，靠 `manifest.webmanifest.body`
        // 在运行时应答，所以同样不能按 `public/` 静态文件核对。
        continue;
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
        samePageAnchors++;
        if (frag && !ids.has(frag) && !ids.has(encodeURIComponent(frag))) {
          anchorMiss.push(`${file} #${frag}`);
        }
        continue;
      }
      // 只有真的带 `#` 才算跨页锚点；否则它是普通站内链接，不该进这个计数
      if (frag) crossPageAnchors++;

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
  if (broken.length > 0) {
    console.error(`[links] 死链 ${broken.length} 处：`);
    for (const b of broken) console.error(`  ✗ ${b}`);
    process.exit(1);
  }
  // R16.325 地板：同页锚点一条都没扫到 = 过滤条件又把它们挡在外面了。
  // 这条判据比下面的 miss 判定更早失败，因为它防的是「门禁静默不判」这一类。
  if (samePageAnchors === 0) {
    console.error("[links] ✗ 同页锚点（href=\"#…\"）扫到 0 处：过滤条件把它们挡在门外了，这道门禁等于没查锚点");
    process.exit(1);
  }
  if (anchorMiss.length > 0) {
    // 以前是「仅报告」（知识库原文锚点写法多样）。R16.325 当场量过人口之后升级为阻断：
    // 同页 7811 处（每页去重）+ 跨页 6 处，**miss 为 0**，所以阻断不会一上来就红一片；
    // 而报告式判据不红等于没有判据（同一轮里那条不可达的同页分支就是代价）。
    console.error(`[links] ✗ 锚点缺失 ${anchorMiss.length} 处（同页扫到 ${samePageAnchors} 处 / 跨页 ${crossPageAnchors} 处）：`);
    for (const a of anchorMiss.slice(0, 30)) console.error(`  ✗ ${a}`);
    if (anchorMiss.length > 30) console.error(`  …还有 ${anchorMiss.length - 30} 处`);
    process.exit(1);
  }
  console.log(`[links] ✓ 锚点核对：同页 ${samePageAnchors} 处 · 跨页 ${crossPageAnchors} 处，全部命中`);
  console.log("[links] ✓ 无死链");
}

main();
