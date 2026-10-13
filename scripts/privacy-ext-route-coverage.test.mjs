/**
 * `e2e/privacy-third-party.spec.ts` 那份 ROUTES 清单不许是手抄的：它必须由源码树推导，
 * 而隐私页点名的跨源主机名必须由**真的在 fetch / WebSocket 里用到的那些主机**推导。
 *
 * 为什么这条值得钉（R16.327 的下一层）：那条判据的口径是「零点击时离开设备的跨源请求」，
 * 而它扫哪些路由、核哪些主机，过去完全由两份字面量清单决定。新增一个「挂载即取行情」的
 * 入口页，不会有人想起要去改那份清单——于是判据照旧绿，隐私页照旧漏披露。这与本仓
 * 「手抄数字没有主人」（R16.315）/「注释里的路径没有主人」（R16.317）同一条病。
 *
 * **静态可达只是「候选」，不是「事实」**：本轮实测过，课文页沿 import 链能走到
 * `kline-chart`，但那是 `LazyChartEmbed` 的视口门控动态加载，零点击时**一个跨源请求都不发**
 * （`.gate-logs/ext-route-measure-r82.mjs`，13 条路由逐个静置 7 秒量出来的）。所以这里
 * 把静态候选**全部**放进 spec 的观测面（多几条不观测到东西是安全的），而「不许空转」的
 * 地板改成**全局**的：不许按路由要求每条都命中，那会把懒加载页判成缺陷。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const SPEC = "e2e/privacy-third-party.spec.ts";
const PRIVACY = "src/app/[locale]/privacy/page.tsx";
const APP = "src/app";
// 页面都住在 `src/app/[locale]/` 之下；这里要的是那个字面量目录名，不是语言代码
const LOCALE_DIR = "[locale]";

function walk(dir, out = []) {
  for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const sourceFiles = walk("src").filter(
  (f) => /\.tsx?$/.test(f) && !f.includes(".test."),
);

/**
 * 从调用点取主机名：只认 `fetch("https://host/…")` 与 `new WebSocket("wss://host/…")`。
 * 不按「这个文件里出现过某个 URL」算——`kline-chart.tsx` 同时有推送用的 wss 端点与
 * 一句 TradingView 署名链接（`<a href>`，不发请求），按文件算会把后者当成跨源依赖。
 */
const CALL_SITE = /(?:fetch|new\s+WebSocket|new\s+EventSource)\s*\(\s*[`'"](?:https?:|wss?:)\/\/((?:[a-z0-9-]+\.)+[a-z]{2,})/gi;

function externalHostsUsed(file) {
  const out = new Set();
  for (const m of read(file).matchAll(CALL_SITE)) out.add(m[1].toLowerCase());
  return out;
}

/** 含跨源调用事实的模块：调用点里写着外部主机 */
const EXT_MODULES = sourceFiles.filter((f) => externalHostsUsed(f).size > 0);
const EXT_BASENAMES = new Set(
  EXT_MODULES.map((f) => path.posix.basename(f).replace(/\.tsx?$/, "")),
);
const EXT_HOSTS = new Set();
for (const f of EXT_MODULES) for (const h of externalHostsUsed(f)) EXT_HOSTS.add(h);

function importSpecs(file) {
  const src = read(file);
  const out = new Set();
  for (const m of src.matchAll(/(?:^|\s)import\s*\(\s*["']([^"']+)["']\s*\)/g)) out.add(m[1]);
  for (const m of src.matchAll(/\bfrom\s+["']([^"']+)["']/g)) out.add(m[1]);
  return out;
}

function resolve(spec, fromFile) {
  const base = spec.startsWith("@/")
    ? path.posix.join("src", spec.slice(2))
    : path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    if (existsSync(path.join(root, base + ext))) return base + ext;
  }
  return null;
}

/** 从某个页面出发，深度 4 内能否走到含跨源调用的模块（静态候选，不等于零点击会发请求） */
function reachesExternal(pageFile, depth = 4) {
  const seen = new Set([pageFile]);
  let frontier = [pageFile];
  for (let d = 0; d < depth && frontier.length; d += 1) {
    const next = [];
    for (const f of frontier) {
      for (const spec of importSpecs(f)) {
        const r = resolve(spec, f);
        if (!r || seen.has(r)) continue;
        seen.add(r);
        if (EXT_BASENAMES.has(path.posix.basename(r).replace(/\.tsx?$/, ""))) return true;
        next.push(r);
      }
    }
    frontier = next;
  }
  return false;
}

const PAGES = sourceFiles.filter((f) => f.endsWith("/page.tsx"));

/** 页面文件 → 站内路由（去掉语言前缀；`[locale]/page.tsx` 的根路由是 `/`） */
function routeOf(pageFile) {
  const prefix = `${APP}/${LOCALE_DIR}/`;
  if (!pageFile.startsWith(prefix)) return null;
  const rest = pageFile.slice(prefix.length).replace(/page\.tsx$/, "").replace(/\/$/, "");
  return rest === "" ? "/" : `/${rest}`;
}

/** 候选路由：静态上能走到跨源模块的页面（spec 的观测面必须是它的超集） */
const CANDIDATE_ROUTES = [
  ...new Set(
    PAGES.filter(reachesExternal)
      .map(routeOf)
      .filter((r) => r !== null),
  ),
].sort();

/** spec 里那份 ROUTES 字面量，剥掉语言前缀后用于比对 */
function specRoutes() {
  const src = read(SPEC);
  const m = /const ROUTES = \[([^\]]+)\]/.exec(src);
  expect(m, `${SPEC} 里找不到 const ROUTES = [...] 那一行，这条比对没有对象`).toBeTruthy();
  return [...m[1].matchAll(/"([^"]+)"/g)]
    .map((x) => x[1].replace(/^\/(?:zh|en)(?=\/|$)/, "") || "/");
}

  /**
   * 候选路由里含动态段（`/knowledge/[chapter]/[doc]`），spec 只能写一个**具体实例**。
   * 所以「覆盖」的判据是按段匹配：字面段必须逐字相同，`[x]` 段允许任何值——
   * 这样既不需要把某个真实 slug 抄进门禁（抄了就是又一个没主人的数），也不放行
   * 「随便写一条别的深度」的假覆盖。
   */
  function coveredBy(candidate, declared) {
    const want = candidate.split("/").filter(Boolean);
    return declared.some((route) => {
      const have = route.split("/").filter(Boolean);
      if (have.length !== want.length) return false;
      return want.every((seg, i) => seg.startsWith("[") || seg === have[i]);
    });
  }

describe("隐私跨源判据的观测面与主机名单由源码树推导", () => {
  it("扫描本身不是空转（页面数、跨源模块数、候选路由数都有地板）", () => {
    expect(PAGES.length, `只数到 ${PAGES.length} 份 page.tsx，扫描本身坏了`).toBeGreaterThanOrEqual(20);
    expect(
      EXT_MODULES.length,
      "没扫出任何含跨源调用的模块，下面两条比对会静默全绿",
    ).toBeGreaterThanOrEqual(2);
    expect(CANDIDATE_ROUTES.length, "没有任何页面被判定为跨源候选").toBeGreaterThanOrEqual(2);
    expect(EXT_HOSTS.size, "跨源调用点里没解析出任何主机名").toBeGreaterThanOrEqual(2);
  });

  it("每一个跨源候选页面都在 spec 的 ROUTES 里（新增入口页不许漏）", () => {
    const declared = specRoutes();
    const missing = CANDIDATE_ROUTES.filter((r) => !coveredBy(r, declared));
    expect(
      missing,
      `这些页面静态上能走到跨源模块，却没进 ${SPEC} 的 ROUTES：${missing.join(", ")}——它们若改成挂载即发请求，隐私页的披露会漏掉`,
    ).toEqual([]);
  });

  it("ROUTES 里不许留着已经没有 page.tsx 的路由（清单不许只长不消）", () => {
    const real = PAGES.map(routeOf).filter(Boolean);
    // 反向同理：spec 写的是具体实例，所以按「能匹配上某条真实路由」判存在
    const stale = specRoutes().filter((r) => !real.some((route) => coveredBy(route, [r])));
    expect(stale, `ROUTES 点名了没有对应 page.tsx 的路由：${stale.join(", ")}`).toEqual([]);
  });

  it("源码里每一个跨源主机名，隐私页两种语言各点名一次", () => {
    const copy = read(PRIVACY);
    for (const host of EXT_HOSTS) {
      const hits = copy.split(host).length - 1;
      expect(
        hits,
        `隐私页提到 ${host} ${hits} 次——中英各一次才算双语齐全（只在一侧点名，另一种语言的读者就没被披露）`,
      ).toBe(2);
    }
  });

  it("正向对照：删掉一侧的主机点名，上一条就会红（自证不是空转）", () => {
    const copy = read(PRIVACY);
    const host = [...EXT_HOSTS].sort()[0];
    const first = copy.indexOf(host);
    expect(first, `隐私页里找不到 ${host}`).toBeGreaterThanOrEqual(0);
    // 抠掉第一次出现，模拟「只有另一种语言点名」的失效形状
    const mutated = copy.slice(0, first) + "某个行情端点" + copy.slice(first + host.length);
    expect(mutated.split(host).length - 1, "抠掉一处后仍有两处，这个夹具抓不住单侧漏点名").toBe(1);
  });
});
