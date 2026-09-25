/**
 * R16.252：`docs/architecture.md` 点名的东西，得一件件查得到。
 *
 * 这份文档是「系统长什么样」的入口，读者拿它决定去哪里改东西；它通篇没有专项判据看着——前两轮
 * 只收回了它的「当前基线」日期并查过它点名的路径存在性（`doc-anchor-claims`）。本轮读下来两处不实：
 * ①§5.2 写「冲突元数据记录在 `tb-cloud-sync-meta`」，那个键在代码里根本不存在——真键是
 * `tb-sync-conflicts`（`sync-conflicts.ts:37`），而 `tb-last-cloud-sync`（`cloud-sync-meta.ts:8`）
 * 记的是「最近一次云端合并」的时刻；那个假键就是把模块名 `cloud-sync-meta.ts` 当成键名抄出来的，
 * 同一族错误 R16.104 已经在一份测试夹具里修过一次（那次是 `tb-cloud-sync-at`）。②§5.1 写 admin
 * client「只允许被 `src/app/api/**` 导入」，而 `src/lib/ai/rag.ts` 直接导着它——真边界不是目录，
 * 是「没有任何客户端模块能拿到它」，这条现在由判据顺着导入闭包走一遍来保证。
 *
 * 其余几条是把文档里能机械核对的说法钉住：点名的路径与相对链接、§4.2 的 prebuild 四步与
 * `package.json` 的实际顺序、§7 点名的响应头与 `next.config.ts`、§8 的作业数与工作流名单
 * （两个数都从 `ci.yml` 和 `.github/workflows/` 现读，而且要求数字写在作业清单旁边——整节里
 * 搜一个说法会被文档自己那句带引号的旧措辞满足）。
 *
 * 一条 CI 教出来的规矩：`npm run test:coverage` 排在 `npm run build` 之前，所以判据在干净检出里
 * 看不见任何 prebuild 产物——`public/search-index.json` 与 `public/knowledge-assets/` 都是 gitignore
 * 掉的生成物，本机跑过构建就一直在，本地全绿而 CI 直接红两条。`public/` 下的表面因此按
 * 「在检出里」或「有脚本往那个路径写」两条证据任一算数，见 `publicSurface()`。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const doc = read("docs/architecture.md");
const section = (from, to) => {
  const a = doc.indexOf(from);
  expect(a, `文档里找不到「${from}」这一节`).toBeGreaterThan(-1);
  const b = to ? doc.indexOf(to, a) : -1;
  return doc.slice(a, b === -1 ? undefined : b);
};

/** src 下全部非测试源码文件（含 ts/tsx），用于解析 import 说明符 */
function sourceFiles(dir = "src") {
  const out = [];
  for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(rel);
  }
  return out;
}
const FILES = sourceFiles();
const FILE_SET = new Set(FILES);

/** scripts/ 下的可执行脚本源码，用来证明一个 `public/…` 产物有生产者 */
const SCRIPT_TEXT = readdirSync(path.join(root, "scripts"))
  .filter((n) => /\.(mjs|cjs|js|sh)$/.test(n))
  .map((n) => ({ name: n, text: read(`scripts/${n}`) }));

/** 这条路径有没有被版本库管着——读的是索引不是历史，浅检出里同样成立 */
function tracked(rel) {
  return execFileSync("git", ["ls-files", "--", rel], {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  }).trim() !== "";
}

/**
 * `public/` 下被点名的表面分两种，判据必须两种都认：签进版本库的（`sw.js`、`offline.html`）在
 * 任何检出里都在；构建产物（`search-index.json`、`knowledge-assets/`）在干净检出里**根本不存在**，
 * 只有跑过 prebuild 的工作区里有。CI 的 `npm run test:coverage` 排在 `npm run build` 之前，所以
 * 只凭「文件在不在」写断言会在 CI 上红，而且红得像判据坏了——本轮就是这么第一次撞上这条的。
 * 所以先用版本库管没管这条路径来分流：管着的看检出，没管的必须有脚本往那个路径写（本地产物骗不过去）。
 */
function publicSurface(rel) {
  const p = `public/${rel}`;
  if (tracked(p)) return { ok: existsSync(path.join(root, p)), mode: "tracked", producers: [] };
  const producers = SCRIPT_TEXT.filter((s) => s.text.includes(`"${p}`)).map((s) => s.name);
  return { ok: producers.length > 0, mode: "generated", producers };
}

function specToFile(spec, fromFile) {
  if (!spec.startsWith(".") && !spec.startsWith("@/")) return null;
  const base = spec.startsWith("@/")
    ? `src/${spec.slice(2)}`
    : path.join(path.dirname(fromFile), spec).split(path.sep).join("/");
  for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, base]) {
    if (FILE_SET.has(cand.replace(/^\.\//, ""))) return cand.replace(/^\.\//, "");
  }
  return null;
}
function importedFiles(rel) {
  const specs = [...read(rel).matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)].map((m) => m[1]);
  return specs.map((s) => specToFile(s, rel)).filter(Boolean);
}
/** 反向闭包：谁能（经任意层 import）拿到 target */
function importersOf(target) {
  const seen = new Set([target]);
  const frontier = [target];
  const all = new Set();
  while (frontier.length) {
    const cur = frontier.shift();
    const base = cur.replace(/\.(ts|tsx)$/, "");
    for (const rel of FILES) {
      if (seen.has(rel)) continue;
      if (importedFiles(rel).includes(cur) || importedFiles(rel).some((d) => d === base)) {
        seen.add(rel);
        all.add(rel);
        frontier.push(rel);
      }
    }
  }
  return [...all];
}

describe("文档点名的路径与链接都还在", () => {
  it("反引号里的仓库路径逐个存在（构建产物要有产出它的那个脚本）", () => {
    const paths = [...new Set([...doc.matchAll(/`((?:src|scripts|public|supabase|docs|\.github)\/[^`\s]*)`/g)].map((m) => m[1]))]
      .filter((p) => !/[*.]{2}|\{|\.\.\./.test(p));
    expect(paths.length, "架构文档一个路径都没点到，扫描八成没跑起来").toBeGreaterThanOrEqual(25);
    const publicNamed = paths.filter((p) => p.startsWith("public/"));
    expect(publicNamed.length, "文档不再点名任何 public/ 表面，产物那条支路就成了死码").toBeGreaterThanOrEqual(3);
    for (const p of paths) {
      if (p.startsWith("public/")) {
        const s = publicSurface(p.slice("public/".length));
        expect(s.ok, `文档指着 ${p}：${s.mode === "tracked" ? "版本库管着它，检出里却没有" : "干净检出里没有，也没有任何 scripts/ 脚本往那个路径写"}`).toBe(true);
        continue;
      }
      expect(existsSync(path.join(root, p)), `文档指着 ${p}，仓库里没有这个文件`).toBe(true);
    }
    // 分流自己也要对着：签进版本库的那两条不许走「产物」支路，产物也不许被当成签入文件放过
    expect(tracked("public/sw.js"), "public/sw.js 现在不归版本库管了，这条分流要重看").toBe(true);
    expect(tracked("public/search-index.json"), "search-index.json 被签进版本库了，「产物要有生产者」那一条要重看").toBe(false);
  });

  it("相对链接（含 §10 那一份）从 docs/ 出发解析得到", () => {
    const links = [...doc.matchAll(/\]\(([^)\s]+)\)/g)]
      .map((m) => m[1].split("#")[0])
      .filter((l) => l && !/^[a-z]+:/.test(l));
    expect(links.length, "文档不再链接任何兄弟文档").toBeGreaterThanOrEqual(8);
    for (const l of links) {
      expect(existsSync(path.join(root, "docs", l)), `链接 ${l} 从 docs/ 出发解析不到`).toBe(true);
    }
  });

  it("文档点名的每一个 `tb-*` 标识都真被当作持久化名字用着", () => {
    // 约定：反引号 = 「这是代码里有的东西」。被改掉/被证伪的拼写要用普通文字引用，
    // 否则这条判据会把纠错的那句话一起当成"当前存在的键"（同一族错误见 §5.1 那条目录说法）。
    const keys = [...new Set([...doc.matchAll(/`(tb-[a-z0-9-]+)`/g)].map((m) => m[1]))];
    expect(keys.length, "文档不再点名任何存储键").toBeGreaterThanOrEqual(2);
    const all = FILES.map((rel) => read(rel)).join("\n");
    // 「这个字符串在代码里出现过」不是这里要的形状：`tb-sync-conflict` 是一个 DOM 事件名
    // （`sync-conflicts.ts` 里 `dispatchEvent(new Event(...))`），探针把文档上的
    // `tb-sync-conflicts` 抄掉一个字母就正好撞上它而绿。只有真拿来读写持久化状态的位置才算：
    // 存储读写、cookie 读写、或赋给一个常量的键名。
    const persisted = new Set();
    for (const re of [
      /(?:localStorage|sessionStorage)\s*[.\[]\s*(?:getItem|setItem|removeItem)\s*\(\s*"(tb-[a-z0-9-]+)"/g,
      /cookies\s*[.\[]\s*(?:get|set)\s*\(\s*"(tb-[a-z0-9-]+)"/g,
      /(?:const|let|var)\s+[A-Za-z_0-9]+\s*=\s*"(tb-[a-z0-9-]+)"/g,
    ]) {
      for (const m of all.matchAll(re)) persisted.add(m[1]);
    }
    expect(persisted.size, "一个持久化名字都没扫出来，这条判据在空转").toBeGreaterThanOrEqual(3);
    for (const k of keys) {
      expect(persisted.has(k), `文档把 ${k} 当成存储键/cookie 名点名了，src 里没有一处这样用它`).toBe(true);
    }
    // 正向对照 ①：本轮删掉的那个假键（把模块名 cloud-sync-meta.ts 抄成键名）必须被抓住
    expect(all.includes('"tb-cloud-sync-meta"'), "代码里现在真有这个键了，那条假键的说法要重看").toBe(false);
    // 正向对照 ②：那个同名的 DOM 事件不算持久化名字，否则抄错一个字母的键名会蒙过去
    expect(persisted.has("tb-sync-conflict"), "`tb-sync-conflict` 现在真是存储键了，这条对照要重看").toBe(false);
  });
});

describe("文档描述的运行形状就是仓库里那份", () => {
  it("§4.2 的 prebuild 四步与 package.json 的顺序逐个对上", () => {
    const cmds = JSON.parse(read("package.json")).scripts.prebuild.split("&&").map((s) => s.trim());
    const listed = [...section("### 4.2 prebuild", "### 4.3").matchAll(/^\d+\.\s+`scripts\/([A-Za-z0-9-]+\.mjs)`/gm)].map((m) => m[1]);
    expect(listed.length, "§4.2 不再按编号列 prebuild 步骤").toBeGreaterThanOrEqual(4);
    expect(cmds.length, "prebuild 的步骤数与文档不符").toBe(listed.length);
    cmds.forEach((c, i) => {
      expect(c, `prebuild 第 ${i + 1} 步不是 node 跑脚本：${c}`).toContain(`scripts/${listed[i]}`);
      expect(existsSync(path.join(root, "scripts", listed[i])), `文档第 ${i + 1} 步点名的 scripts/${listed[i]} 不存在`).toBe(true);
    });
  });

  it("§5.1：admin client 拿得到它的闭包里没有任何客户端模块", () => {
    const ADMIN = "src/lib/supabase/admin.ts";
    expect(existsSync(path.join(root, ADMIN)), `${ADMIN} 不在了，§5.1 那一整节要重看`).toBe(true);
    const closure = importersOf(ADMIN);
    expect(closure.length, "一个模块都不导入 admin client，判据空转").toBeGreaterThanOrEqual(2);
    const clients = closure.filter((rel) => /["']use client["']/.test(read(rel)));
    expect(clients, `service role client 泄漏进了客户端模块：${clients.join("、")}`).toEqual([]);
    // 那句「只允许被 src/app/api/** 导入」是本轮改掉的：真导入方包括 src/lib/ai/rag.ts
    const s51 = section("### 5.1", "### 5.2");
    expect(s51.includes("只允许被 `src/app/api"), "§5.1 又回到「按目录」的说法了——按目录那条从来不是真的").toBe(false);
    for (const direct of closure.filter((rel) => importedFiles(rel).includes(ADMIN))) {
      if (direct.startsWith("src/app/api/")) continue;
      expect(s51, `${direct} 直接导入 admin client，§5.1 却没有它`).toContain(path.basename(direct));
    }
  });

  it("§7 点名的响应头与缓存策略就是 next.config.ts 里的那些", () => {
    const conf = read("next.config.ts");
    for (const h of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]) {
      expect(conf, `§7 说 next.config.ts 设置 ${h}，那份文件里没有`)
        .toContain(h);
    }
    expect(conf, "那个头不再是 nosniff 了，§7 的说法要改").toMatch(/X-Content-Type-Options",\s*value:\s*"nosniff"/);
    expect(conf, "那个头不再是 DENY 了，§7 的说法要改").toMatch(/X-Frame-Options",\s*value:\s*"DENY"/);
    // 缓存策略是两张表：内容产物每次重验证，sw.js 永不缓存
    const revalidateValue = /const contentCacheHeader = \{[\s\S]*?value:\s*"([^"]+)"/.exec(conf);
    expect(revalidateValue, "读不到那份「每次重验证」的头部值").toBeTruthy();
    expect(revalidateValue[1], "那份 header 已经不是 must-revalidate 了").toContain("must-revalidate");
    const entries = [...conf.matchAll(/source:\s*"([^"]+)",\s*headers:\s*\[([^\]]+)\]/g)].map((m) => ({ source: m[1], via: m[2].trim() }));
    expect(entries.length, "next.config.ts 里的缓存条目读不出来，判据空转").toBeGreaterThanOrEqual(3);
    const revalidated = entries.filter((e) => e.via === "contentCacheHeader").map((e) => e.source);
    const noCache = entries.filter((e) => /no-cache/.test(e.via)).map((e) => e.source);
    expect(noCache, "`no-cache` 不只用在 sw.js 上，§7 那句要说全").toEqual(["/sw.js"]);
    const s7 = section("### PWA", "### 安全与可观测性");
    expect(s7, "§7 不再说 sw.js 用 no-cache").toContain("no-cache");
    expect(s7, "§7 不再说那批产物每次重验证").toContain("重验证");
    for (const srcPath of ["/sw.js", ...revalidated]) {
      // "/knowledge-assets/:path*" → public/knowledge-assets；"/sw.js" → public/sw.js
      const rel = srcPath.replace(/^\/+/, "").replace(/\/?:path.*$/, "").replace(/\*.*$/, "").replace(/\/$/, "");
      expect(rel, `缓存策略那条 source「${srcPath}」解析不出文件路径，判据读不动`).toBeTruthy();
      expect(publicSurface(rel).ok, `§7 的缓存策略指着 public/${rel}：检出里没有，也没有脚本产出它`).toBe(true);
      expect(s7, `§7 没有点到 ${rel}`).toContain(path.basename(rel));
    }
    expect(revalidated.length, "每次重验证的表面少到不正常").toBeGreaterThanOrEqual(3);
  });

  it("§8 说的作业数与工作流名单就是 ci.yml 与 .github/workflows 里的", () => {
    const yml = read(".github/workflows/ci.yml");
    const jobsBlock = yml.slice(yml.indexOf("\njobs:\n"));
    expect(jobsBlock, "ci.yml 里没有 jobs: 这一段").not.toBe(yml);
    const jobs = [...jobsBlock.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9_-]*):\s*$/gm)].map((m) => m[1]);
    expect(jobs.length, "ci.yml 的 job 少到不正常").toBeGreaterThanOrEqual(2);
    const s8 = section("## 8.", "## 9.");
    for (const j of jobs) expect(s8, `ci.yml 有作业 ${j}，§8 没提它`).toContain(`\`${j}\``);
    // 作业数要说对，而且要**在清单旁边**说对：整节里搜一个「两个并行作业」会被那句被引号
    // 框起来的旧说法（「GitHub Actions 包含两个并行作业」）白 satisfy，探针就是这么活下来的。
    const CN = ["零", "一", "两", "三", "四", "五", "六", "七", "八", "九", "十"];
    const lines = s8.split("\n");
    const firstBullet = lines.findIndex((l) => new RegExp(`^- \\\`(${jobs.join("|")})\\\``).test(l));
    expect(firstBullet, "§8 不再用 `- \\`ci\\`` 那种列表逐项列作业").toBeGreaterThan(0);
    const intro = [...lines.slice(0, firstBullet)].reverse().find((l) => l.trim() !== "");
    expect(intro, `§8 引入作业清单的那句得写「${CN[jobs.length]}个作业」，实际是：${JSON.stringify(intro)}`)
      .toContain(`${CN[jobs.length]}个作业`);
    // 被证伪的那句整句说法只能以引文形式出现，不许回到正文里
    const live = s8.replace(/「[^」]*」/g, "");
    expect(live, "「GitHub Actions 包含 N 个并行作业」那句又当成正文写回来了").not.toMatch(/GitHub Actions\s*包含/);
    // 工作流不止 ci.yml：漏掉另一个就是「GitHub Actions 只有两个作业」那种错
    const others = readdirSync(path.join(root, ".github/workflows"))
      .filter((n) => n !== "ci.yml" && /\.(yml|yaml)$/.test(n));
    for (const w of others) expect(s8, `仓库里还有工作流 ${w}，§8 一个字没提`).toContain(w);
    expect(live, `§8 正文没写清工作流总数是 ${CN[others.length + 1]} 个`).toContain(`${CN[others.length + 1]}个工作流`);
  });
});
