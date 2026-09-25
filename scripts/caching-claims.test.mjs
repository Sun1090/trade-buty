/**
 * R16.256：`docs/caching.md` 与 `docs/env.md` 说的每把尺子，都得是代码里那把。
 *
 * 这两份文档此前没有判据看着：`docs/caching.md` 连一次 `scripts/` 引用都没有（只有
 * `src/lib/pwa-offline.test.ts` 断言 `public/sw.js` 里含它的文件名），`docs/env.md` 只有
 * `scripts/env-docs.mjs` 对账**变量名**——列里写「必需」还是「可留空」、哪个变量有回退，没人查。
 * 逐条读下来九处不实：
 * ①§3 的 `ipHits` 这个名字 `src/` 里根本不存在（真对象是 `chatLimiter`，`createRateLimiter` 的
 *   实例），而「游客限流计数」也不对——键是 `user?.id ?? ip`，登录用户同样在这里计数；
 * ②§1 写 `/api/ai/**` 带 `Cache-Control: no-cache`，实际八条 AI 路由里只有 chat 一条设了；
 * ③§1 写 sitemap `lastModified = 构建时间`，实际是知识库提交时间、拿不到才退回构建时间（R13.17）；
 * ④§2 把 `tb-replay-*` 写成「永久」，而 `REPLAY_HISTORY_KEEP = 100` 每写一次就裁一次；
 * ⑤同一行把 `tb-quiz-*` 全说成云端双写，而 `tb-quiz-difficulty` / `tb-quiz-attempts` 被账号镜像
 *   显式排除、只在本机；⑥`tb-study-time` 那行还留着「滚动保留 90 天」，正是 R16.246/R16.251 在
 *   `docs/retention-metrics.md` 里改口过的那个词；⑦事件总线只点了 4 个名字而两侧各有 13 个，
 *   且「消费组件经 `useSyncExternalStore` 订阅」漏了另一种现行写法（直接 `addEventListener`）；
 * ⑧§4 说同步产物与指针「同一 commit」，而 `public/search-index.json`、`public/knowledge-assets/`
 *   都被 gitignore、由 prebuild 重新生成；⑨`docs/env.md` 把三个 embedding 变量标成「RAG 要」，
 *   而 `src/lib/ai/client.ts` 对三个都有回退，`.env.example` 早就写着「留空则回退」。
 * 另有一处**核对之后确认文档是对的**：`ADMIN_TOKEN` 不设时导出接口确实一律 401
 * （`isAuthorized()` 在没有 token 时对任何请求都返回 false），503 那条分支在鉴权之后、与这一句无关，
 * 所以那句话留着没动，并由下面的正向对照钉住。
 * 还有一处按实测改口：现网 HTML 也返回 `public, max-age=0, must-revalidate`，但那是 Vercel 对预渲染
 * 路由的默认，本仓库没有声明它（也没有任何 `revalidate` 配置）——原文把它与内容产物记成同一件事。
 *
 * 规矩沿用前几轮：数字一律现读、每个计数带地板、被证伪的拼写不许用反引号、正向对照必须能抓住
 * 旧的假说法。`public/` 下的产物按「版本库管没管」分流（见 `architecture-claims.test.mjs` 里那条
 * CI 学到的教训），本文件的断言在干净检出里同样成立。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const cache = read("docs/caching.md");
const envDoc = read("docs/env.md");
const section = (doc, from, to) => {
  const a = doc.indexOf(from);
  expect(a, `文档里找不到「${from}」`).toBeGreaterThan(-1);
  const b = to ? doc.indexOf(to, a) : -1;
  return doc.slice(a, b === -1 ? undefined : b);
};
/** 折行会让中文正文里的同一句话跨行，比对前先压平 */
const flat = (s) => s.replace(/\n+/g, "").replace(/\s+/g, " ");

function walk(dir, filter) {
  const out = [];
  for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(rel, filter));
    else if (filter(e.name)) out.push(rel);
  }
  return out;
}
const SRC = walk("src", (n) => /\.tsx?$/.test(n) && !/\.(test|spec)\./.test(n));
const ALL_SRC = walk("src", () => true);
const SRC_TEXT = SRC.map((rel) => read(rel)).join("\n");
function tracked(rel) {
  return execFileSync("git", ["ls-files", "--", rel], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() !== "";
}
/**
 * 「这条路径归 gitignore 管吗」必须问它底下的一个子路径，不能问裸路径。
 * `.gitignore` 里那条是 `public/knowledge-assets/`——带尾斜杠的只匹配目录，而 git 判裸路径时
 * 要先 stat 才知道它是不是目录；干净检出里这份产物**根本不存在**，于是裸路径那一次回答「没忽略」，
 * 判据就在 CI 上红、在跑过 build 的本机绿。子路径按前缀匹配，不需要 stat，两种检出形状同一个答案。
 * （第三十二轮的全量链第一次跑就是这么撞上的：上一轮立的规矩——问 git 而不是问文件系统——
 * 落到了 `tracked()` 上，却没落到这一行。）
 */
function ignored(rel) {
  try {
    execFileSync("git", ["check-ignore", "-q", `${rel}/.gate-probe`], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false; // check-ignore 以 1 表示「没被忽略」，不是错误
  }
}

/** 真被当作持久化名字用的 `tb-*`（存储读写实参 / cookie 实参 / 键名常量） */
function persistedKeys() {
  const keys = new Set();
  for (const re of [
    /(?:localStorage|sessionStorage)\s*[.\[]\s*(?:getItem|setItem|removeItem)\s*\(\s*"(tb-[a-z0-9-]+)"/g,
    /cookies\s*[.\[]\s*(?:get|set)\s*\(\s*"(tb-[a-z0-9-]+)"/g,
    /(?:const|let|var)\s+[A-Za-z_0-9]+\s*=\s*"(tb-[a-z0-9-]+)"/g,
  ]) for (const m of SRC_TEXT.matchAll(re)) keys.add(m[1]);
  for (const m of SRC_TEXT.matchAll(/ACCOUNT_MIRROR_KEYS\s*=\s*\[([\s\S]*?)\]/g))
    for (const k of m[1].matchAll(/"(tb-[a-z0-9-]+)"/g)) keys.add(k[1]);
  return keys;
}
function eventNames(which) {
  const set = new Set();
  if (which === "dispatch") {
    for (const m of SRC_TEXT.matchAll(/dispatchEvent\(\s*new (?:Custom)?Event\(\s*"(tb-[a-z0-9-]+)"/g)) set.add(m[1]);
    return set;
  }
  for (const m of SRC_TEXT.matchAll(/window\.addEventListener\(\s*"(tb-[a-z0-9-]+)"/g)) set.add(m[1]);
  for (const m of SRC_TEXT.matchAll(/const events = \[([^\]]+)\]/g)) {
    for (const k of m[1].matchAll(/"(tb-[a-z0-9-]+)"/g)) set.add(k[1]);
  }
  return set;
}
/** 代码里以模板拼出来的键名前缀（`tb-quiz-difficulty:${…}`、`tb-quiz-${…}`） */
const TEMPLATE_KEYS = new Set([...SRC_TEXT.matchAll(/`(tb-[a-z0-9-]+):?\$\{/g)].map((m) => m[1]));

describe("§1 页面层：谁真的设了头、sitemap 的 lastmod 是哪来的", () => {
  const aiRoutes = ALL_SRC.filter((f) => /^src\/app\/api\/ai\/.*route\.ts$/.test(f));
  const withNoCache = aiRoutes.filter((f) => /Cache-Control",\s*"no-cache"/.test(read(f)));
  it("只有 chat 路由声明 no-cache，文档那一条点名的是它", () => {
    expect(aiRoutes.length, "AI 路由少到不正常").toBeGreaterThanOrEqual(6);
    expect(withNoCache, "声明 no-cache 的路数变了，§1 那一行要重读").toEqual(["src/app/api/ai/chat/route.ts"]);
    const row = section(cache, "| `/api/ai/chat`", "\n");
    expect(flat(row), "§1 又回到「整个 /api/ai/** 都 no-cache」那种说法").toContain("只有这一条路由显式设了这个头");
    for (const f of aiRoutes.filter((x) => !withNoCache.includes(x))) {
      const base = path.basename(path.dirname(f)) === "ai" ? "feedback" : path.basename(path.dirname(f));
      expect(flat(row), `§1 漏点了不设这个头的 ${f}`).toContain(base === "export" ? "feedback/export" : base);
    }
  });
  it("sitemap 的 lastmod 是知识库提交时间，构建时间只是兜底", () => {
    const sm = read("src/app/sitemap.ts");
    expect(sm, "sitemap 不再用 kbLastModified()，§1 那行要重写").toMatch(/kbLastModified\(\)\s*\?\?\s*new Date\(\)/);
    const row = section(cache, "| sitemap.xml", "\n");
    expect(flat(row), "§1 又把 lastmod 写成构建时间了（那是 R13.17 之前的行为）").toContain("知识库提交时间");
    expect(flat(row)).toContain("退回构建时间");
    expect(flat(row), "§1 的这行不再点名实现文件").toContain("kb-freshness");
  });
  it("本仓库没有 revalidate 配置，文档就不许说 ISR", () => {
    const hits = SRC.filter((f) => /export const revalidate\s*=/.test(read(f)));
    expect(hits.length, `出现 revalidate 配置（${hits.join("、")}），页层那张表要重读`).toBe(0);
    expect(read("next.config.ts"), "next.config.ts 里出现了 revalidate 选项").not.toMatch(/revalidate\s*:/);
    expect(flat(section(cache, "> 三层缓存", "\n")), "头一句又写回 SSG/ISR 了").toContain("没有");
  });
  it("/ai 的 noindex 由 seo-surface 声明，文档那行与它一致", () => {
    const noindex = JSON.parse(read("src/lib/seo-surface.json")).noindex;
    expect(Array.isArray(noindex), "seo-surface.json 里没有 noindex 数组").toBe(true);
    expect(noindex.length, "noindex 名单短到不正常").toBeGreaterThanOrEqual(5);
    expect(noindex).toContain("/ai");
    expect(flat(section(cache, "| `/[locale]/ai`", "\n")), "§1 说 /ai noindex，而那份名单里没有它").toContain("noindex");
  });
});

describe("§2 学习数据：键、窗口与事件总线", () => {
  const s2 = section(cache, "## 2. 客户端 localStorage", "## 3.");
  const persisted = persistedKeys();
  it("现读的持久化键个数就是文档写的那个数", () => {
    expect(persisted.size, "持久化键扫出来太少，八成是形状变了").toBeGreaterThanOrEqual(40);
    const m = /非测试代码里真被当作持久化名字使用的 `tb-\*` 键有 (\d+) 个/.exec(s2);
    expect(m, "§2 不再写「共 N 个键」那句话，扫描结果没人记账").toBeTruthy();
    expect(Number(m[1]), `§2 写的键数不是现读的 ${persisted.size}`).toBe(persisted.size);
  });
  it("文档点名的每个 tb-* 都真被代码当键名用着（完整键或模板前缀）", () => {
    const named = [...new Set([...section(s2, "| key |", "事件总线：").matchAll(/`(tb-[a-z0-9-]+)(?::[^`<]*)?`/g)].map((m) => m[1]))];
    expect(named.length, "§2 没点名任何存储键").toBeGreaterThanOrEqual(8);
    for (const k of named) {
      const ok = persisted.has(k) || TEMPLATE_KEYS.has(k);
      expect(ok, `§2 点名 ${k}，代码里既没有这个持久化键，也没有以它为前缀的模板键`).toBe(true);
    }
  });
  it("study-time 那行：90 天、锚在最后有记录那天，且不叫「滚动」", () => {
    const st = read("src/lib/study-time.ts");
    const days = /(?:const|export const)\s+(\w*(?:DAYS|WINDOW)\w*)\s*=\s*(\d+)/.exec(st);
    expect(days, "读不到 study-time 的保留天数常量").toBeTruthy();
    expect(Number(days[2]), "保留天数不是 90 了，文档那行要改").toBe(90);
    const row = section(s2, "| `tb-study-time`", "\n");
    expect(flat(row), "这行又回到「滚动保留」那种说法（R16.246 已经在留存文档里改过口）").not.toContain("滚动");
    expect(flat(row), "这行没写窗口锚在哪一天").toContain("最新有记录");
    const kept = /保留\s*(\d+)\s*天/.exec(flat(row));
    expect(kept, "这行没有「保留 N 天」那个数可以比对").toBeTruthy();
    expect(Number(kept[1]), `这行写的保留天数不是常量里的 ${days[2]}`).toBe(Number(days[2]));
  });
  it("回放历史有上限，测验的两个例外只在本机", () => {
    const keep = Number(/export const REPLAY_HISTORY_KEEP = (\d+)/.exec(read("src/lib/replay-history-limit.ts"))[1]);
    expect(keep, "回放保留轮数读不出来").toBeGreaterThanOrEqual(10);
    const replayRow = section(s2, "| `tb-replay-history`", "\n");
    expect(flat(replayRow), `回放那行没写 ${keep} 轮这个上限`).toContain(String(keep));
    expect(flat(replayRow), "回放那行又写成「永久」了").not.toContain("永久");
    const excl = [...read("src/lib/account-mirror.ts").matchAll(/PER_CHAPTER_QUIZ_EXCLUSIONS\s*=\s*\[([^\]]+)\]/g)][0][1];
    const names = [...excl.matchAll(/"(tb-[a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(names.length, "读不到账号镜像的排除清单").toBeGreaterThanOrEqual(2);
    const localRow = section(s2, `| \`${names[0]}`, "\n");
    for (const n of names) expect(flat(localRow), `排除清单里的 ${n} 没被 §2 那行点名`).toContain(n);
    expect(flat(localRow), "那一行没写「只在本机」").toContain("只在本机");
    // 排除清单里写的必须是代码真写过的键形状：一条写成 `tb-quiz-difficulty` 而代码只写
    // `tb-quiz-difficulty:<locale>`，判断就会漏（换账号时清掉设备偏好，本轮修的就是这个）
    for (const n of names) {
      expect(persisted.has(n) || TEMPLATE_KEYS.has(n), `${n} 既不是完整键名，也不是代码里的模板前缀`).toBe(true);
    }
    const am = read("src/lib/account-mirror.ts");
    expect(am, "排除判断不再认 `前缀:` 这种形状，换账号会清掉设备偏好").toMatch(/key === k \|\| key\.startsWith\(`\$\{k\}:`\)/);
    expect(cache, "文档里另一个 quiz 行又声称整族都上云").not.toMatch(/`tb-quiz-\*`[^|]*\|[^|]*永久（云端双写）/);
  });
  it("事件总线：两侧名字同集合，文档逐个点名", () => {
    const disp = eventNames("dispatch");
    const listen = eventNames("listen");
    expect(disp.size, "派发端一个 tb-* 名字都没扫到").toBeGreaterThanOrEqual(10);
    expect([...listen].sort()).toEqual([...disp].sort());
    const para = flat(section(cache, "事件总线：", "\n\n| 缓存"));
    const list = /共 (\d+) 个——([^；]+)；两侧名字集合相同/.exec(para);
    expect(list, "§2 那段事件的枚举形状变了，这里扫不到名单").toBeTruthy();
    const named = [...new Set([...list[2].matchAll(/`(tb-[a-z0-9-]+)`/g)].map((m) => m[1]))].sort();
    expect(Number(list[1]), "文档写的个数与它自己列出的名字数不符").toBe(named.length);
    expect(named, "文档点名的事件与代码派发的那批不等").toEqual([...disp].sort());
    const shared = [...disp].filter((n) => persisted.has(n)).sort();
    const m2 = /只有 (\d+) 个（([^）]*)）恰好同名/.exec(para);
    expect(m2, "§2 没写事件名与存储键同名的个数").toBeTruthy();
    expect(Number(m2[1]), `同名个数不是现读的 ${shared.length}`).toBe(shared.length);
    expect([...m2[2].matchAll(/`(tb-[a-z0-9-]+)`/g)].map((x) => x[1]).sort(), "同名清单与现读的不等").toEqual(shared);
    const syncFiles = SRC.filter((f) => /useSyncExternalStore\(/.test(read(f))).length;
    const n2 = /`useSyncExternalStore`（(\d+) 个组件文件/.exec(para);
    expect(n2, "没写 useSyncExternalStore 的文件数").toBeTruthy();
    expect(Number(n2[1]), `文件数不是现读的 ${syncFiles}`).toBe(syncFiles);
    // 「两种订阅写法都有」这句话要在**它自己那一句里**成立：整段搜 addEventListener 会被上一句
    // （「被 `addEventListener` 读到」）白满足，探针 D8 第一次就是这么活下来的。
    const listenClause = /监听侧[^。]*。/.exec(para)?.[0] ?? "";
    expect(listenClause, "§2 没有一句在讲监听侧的两种写法").toBeTruthy();
    expect(listenClause, "那一句没写 useSyncExternalStore").toContain("useSyncExternalStore");
    expect(listenClause, "那一句没写直接 addEventListener 这种同样在用的写法").toContain("addEventListener");
    expect(listenClause, "那一句又把它说成单一写法了").toContain("两种");
  });
});

describe("§3 内存缓存：名字与 TTL 就是代码里的常量", () => {
  const s3 = section(cache, "## 3. 服务端内存缓存", "## 云端合并规则");
  it("那个限流器叫 chatLimiter，`ipHits` 从来不存在", () => {
    expect(SRC_TEXT.includes("ipHits"), "`ipHits` 又成了真名字，§3 那行要重看").toBe(false);
    const chat = read("src/app/api/ai/chat/route.ts");
    expect(chat).toMatch(/const chatLimiter = createRateLimiter\(/);
    const row = section(s3, "| `chatLimiter`", "\n");
    expect(flat(row), "§3 那行没点名 chatLimiter 的键写法").toContain("user?.id ?? ip");
    const guest = Number(/guestLimit:\s*(\d+)/.exec(chat)[1]);
    const authed = Number(/authedLimit:\s*(\d+)/.exec(chat)[1]);
    expect(flat(row), `§3 没写游客 ${guest} 次`).toContain(String(guest));
    expect(flat(row), `§3 没写登录 ${authed} 次`).toContain(String(authed));
    expect(flat(row), "那行又把限流说成游客专用").not.toMatch(/游客限流计数/);
    const win = Number(/DEFAULT_WINDOW_MS = ([\d_]+)/.exec(read("src/lib/ai/rate-limit.ts"))[1].replace(/_/g, ""));
    expect(flat(section(s3, "| `chatLimiter`", "\n")), "窗口时长与常量对不上").toContain(`${Math.round(win / 3_600_000)} 小时`);
  });
  it("两个应答缓存的 TTL 由各自常量决定", () => {
    for (const [file, name, re, unit, row] of [
      ["src/app/api/ai/chat/route.ts", "answerCache", /const CACHE_TTL = (\d+) \* 60 \* 1000/, "分钟", "| `answerCache`"],
      ["src/app/api/ai/quiz/route.ts", "quizCache", /const QUIZ_CACHE_TTL = (\d+) \* 60 \* 60 \* 1000/, "小时", "| `quizCache`"],
    ]) {
      expect(read(file), `${name} 不在这个文件里了，§3 那行要重读`).toContain(name);
      const n = Number(re.exec(read(file))[1]);
      expect(Number.isFinite(n), `读不到 ${name} 的 TTL`).toBe(true);
      const r = flat(section(s3, row, "\n"));
      expect(r, `§3 的 ${name} 那行没有 ${n} ${unit}`).toContain(`${n} ${unit}`);
    }
  });
});

describe("§4 内容产物的 git 形状", () => {
  it("两份 prebuild 产物被 gitignore，所以不随指针提交", () => {
    for (const rel of ["public/search-index.json", "public/knowledge-assets"]) {
      expect(tracked(rel), `${rel} 现在被签进版本库了，§4 那句「不提交」要重看`).toBe(false);
      expect(ignored(rel), `${rel} 不再被 gitignore，§4 得改成它会提交`).toBe(true);
    }
    const s4 = section(cache, "## 4.", "## 5.");
    expect(flat(s4), "§4 没有交代产物不提交这件事").toContain("**不提交**");
    expect(flat(s4), "§4 又把指针与产物写成同一个 commit").not.toMatch(/等同步产物同一 commit/);
    expect(tracked("scripts/kb-manifest.json"), "kb-manifest.json 不在版本库里了，§4 要改").toBe(true);
  });
  it("现网那个头的两层出处被写清了", () => {
    const conf = read("next.config.ts");
    const value = /const contentCacheHeader = \{[\s\S]*?value:\s*"([^"]+)"/.exec(conf);
    expect(value, "读不到那份头部值").toBeTruthy();
    const s4 = flat(section(cache, "## 4.", "## 5."));
    expect(s4).toContain(value[1]);
    expect(s4, "页面那层又回落到「我们声明的」——现网那个头是平台默认").toContain("Vercel 对预渲染路由的默认");
    expect(s4, "缺了复测这一说：文档里的实测记录要有日期与出处").toMatch(/2026-09-\d\d 复测/);
  });
});

describe("docs/env.md 的必需列与烘进 HTML 的页面", () => {
  const client = read("src/lib/ai/client.ts");
  it("三个 embedding 变量都有回退，所以不许标成必需", () => {
    for (const [name, alt] of [["AI_EMBEDDING_URL", "AI_API_URL"], ["AI_EMBEDDING_KEY", "AI_API_KEY"], ["AI_EMBEDDING_MODEL", null]]) {
      const re = new RegExp(`process\\.env\\.${name}\\s*\\|\\|`);
      expect(re.test(client), `${name} 不再有回退，env.md 的必需列要改回去`).toBe(true);
      const row = section(envDoc, `| \`${name}\``, "\n");
      expect(flat(row), `${name} 那行不再写「可留空」`).toContain("可留空");
      if (alt) expect(flat(row), `${name} 那行没写回退到 ${alt}`).toContain(alt);
      expect(flat(row), `${name} 那行还留着「RAG 要」这种必需说法`).not.toMatch(/RAG 要/);
    }
    const example = read(".env.example");
    expect(example, ".env.example 里那条回退说明变了，两份文档要一起看").toContain("留空则回退");
  });
  it("烘进 HTML 的是 aiEnabledForPage 的那四个页面", () => {
    const callers = SRC.filter((f) => /aiEnabledForPage\(/.test(read(f)) && /page\.tsx$/.test(f) && !f.includes("ai-toggle")).sort();
    expect(callers.length, "调用这把开关的页面少到不正常").toBeGreaterThanOrEqual(3);
    for (const f of callers) expect(envDoc, `env.md 没点名 ${f}`).toContain(path.basename(path.dirname(f)));
    const n = /调用它的\s*(\d+)\s*个页面/.exec(flat(envDoc));
    expect(n, "env.md 不再写「调用它的 N 个页面」").toBeTruthy();
    expect(Number(n[1]), `页面数不是现读的 ${callers.length}`).toBe(callers.length);
    expect(flat(envDoc), "env.md 又把这件事说成「都是 SSG」").not.toMatch(/都是 SSG/);
  });
  it("ADMIN_TOKEN 不设一律 401 这句是真的，且 503 在鉴权之后", () => {
    const route = read("src/app/api/ai/feedback/export/route.ts");
    expect(route, "鉴权函数不再在无 token 时直接返回 false，那句 401 要重看").toMatch(/const token = process\.env\.ADMIN_TOKEN;\s*\n\s*if \(!token\) return false;/);
    expect(route.indexOf('"Unauthorized"'), "401 那条分支跑到 503 后面去了").toBeLessThan(route.indexOf('status: 503'));
    expect(section(envDoc, "| `ADMIN_TOKEN`", "\n"), "env.md 那句 401 被改掉了").toContain("一律 401");
  });
});

/**
 * R16.264：§5 那句「文档级导航（首次进入、…）断网时会显示离线引导页」把前提漏掉了。
 * 2026-09-26 拿同一份构建量了三条（`.gate-logs/probe-r33-offline.mjs`）：
 * A 在线首次访问 `/zh` → 200；B 先在线访问过、worker 接管后断网导航 → 看到离线壳；
 * C **全新上下文、开局就离线** → `page.goto` 直接 `net::ERR_INTERNET_DISCONNECTED`，没有我们的壳。
 * C 之所以必然如此，是因为注册发生在页面 `load` 之后、且只在生产构建里注册
 * （`src/components/service-worker-registrar.tsx`）——那一刻浏览器里根本没有 worker 可以拦截。
 * 这条判据不许把「首次进入」再塞回来，也不许再写「所有内容请求仍直接走网络」：
 * `public/sw.js` 对非导航请求压根不 `respondWith`，联网时它只是原样 `fetch(request)`。
 */
describe("§5 离线兜底的前提与边界", () => {
  const s5 = section(cache, "## 5.", null);
  const sw = read("public/sw.js");
  const registrar = read("src/components/service-worker-registrar.tsx");

  it("代码侧那三件事实还在：只在 load 之后注册、只在生产注册、只拦导航", () => {
    expect(registrar, "注册不再是「load 之后」做的，§5 的前提要重看").toMatch(/document\.readyState === "complete"/);
    expect(registrar).toContain('window.addEventListener("load", run, { once: true })');
    expect(registrar, "注册不再分生产/开发，§5 那句「只在生产构建里注册」要重看").toContain(
      'process.env.NODE_ENV === "production"',
    );
    expect(sw, "worker 不再只兜导航请求，§5 与 §4 的边界要重看").toMatch(
      /request\.method !== "GET" \|\| request\.mode !== "navigate"\) return;/,
    );
    const precaches = sw.match(/cache\.add\(/g) ?? [];
    expect(precaches.length, `安装期预缓存不再是 1 条（读到 ${precaches.length}）`).toBe(1);
  });

  it("文档交代了「得先联网访问过一次」这个前提，也没有再承诺冷启动", () => {
    const t = flat(s5);
    expect(t, "§5 不再写离线壳的前提（联网打开过一次本站）").toContain("至少联网打开过一次本站");
    expect(t, "§5 没交代从没访问过的浏览器断网会看到什么").toContain("浏览器自己的错误页");
    expect(t, "§5 又把「首次进入」当成有兜底的场景（实测冷启动离线拿不到我们的壳）").not.toMatch(/（首次进入/);
    expect(t, "§5 又说联网时所有请求「直接走网络」——非导航请求它根本不拦，谈不上走不走").not.toMatch(
      /所有内容请求仍直接走网络/,
    );
    expect(t, "§5 少了那条边界：非导航请求不由 worker 处理").toContain("不拦截");
  });

  it("引用的那句 e2e 注释还在它被引的那几行里", () => {
    const cited = /`(e2e\/pwa-offline\.spec\.ts):(\d+)-(\d+)`[^「]*「([^」]+)」/.exec(s5);
    expect(cited, "§5 不再引用 e2e 里那句注释（或写法变了），判据要跟着改").toBeTruthy();
    const [, file, from, to, quote] = cited;
    const lines = read(file).split("\n").slice(Number(from) - 1, Number(to));
    expect(lines.length, `${file}:${from}-${to} 越界了`).toBeGreaterThan(0);
    // 注释会折行（那句就折在「绕过刚 / 启动的 worker」中间），比的是**散文**不是换行位置：
    // 两边都去掉注释符号与空白再比。
    const tidy = (s) => s.replace(/\/\/|\/\*|\*\s?/g, "").replace(/\s+/g, "");
    expect(
      tidy(lines.join("")),
      `${file}:${from}-${to} 里已经没有「${quote}」——行号被移动过，重新定位后再改文档`,
    ).toContain(tidy(quote));
  });
});

/**
 * R16.266：§5 中间那句「应用内点链接……由 `src/app/error.tsx` 承接，不是离线引导页」被实测推翻。
 * 2026-09-26 四个探针（`.gate-logs/probe-r34-*.mjs`，`next start -p 3162` + chromium）的读数：
 * ① 联网点站内链接新增请求 0 条（payload 已被预取，点击不上网）；② 只掐 `?_rsc=` → 渲染真页面，
 * 但同一次里多出一条 `document` 请求，即 RSC 取数失败后 Next **回退成整页导航**；③ 掐 RSC + 断网
 * → 那条整页导航正是 worker 唯一会接的 `mode === "navigate"`，屏幕上是我们自己的离线壳，
 * `src/app/error.tsx` 一次都没出现，也没有 `/api/error-reports` 上报；④ 只断网、payload 已预取
 * → 照常渲染真页面。所以断网点应用内链接的尽头**也是离线壳**，原句把兜底层说反了。
 */
describe("§5 应用内点击断网时谁接（实测：回退成整页导航 → 离线壳）", () => {
  const s5 = section(cache, "## 5.", null);
  const sw = read("public/sw.js");

  /** 递归列出 `src/app` 下所有 error boundary 文件 */
  const boundaries = (dir = "src/app", acc = []) => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) boundaries(rel, acc);
      else if (/^(global-)?error\.tsx$/.test(entry.name)) acc.push(rel);
    }
    return acc;
  };

  it("全仓 `src/app` 下 error boundary 只有一个，且它渲染的是探针找的那句文案", () => {
    const found = boundaries();
    expect(found, `error boundary 不再只有一个（读到 ${JSON.stringify(found)}），§5 的归因要重看`).toEqual([
      path.join("src/app", "error.tsx"),
    ]);
    expect(read("src/app/error.tsx"), "边界文案换了，探针找的词与 §5 的说法都要重看").toContain("Something went wrong");
  });

  it("文档写明回退成整页导航、尽头是离线壳，且不再把这条路径判给 error.tsx", () => {
    const t = flat(s5);
    // 三条都要**成对绑死**：§5 里「整页导航」「预取」「离线壳」各出现两次（一次叙事、一次归因），
    // 只搜词会被邻近那句白满足——同轮探针 N2 / N4 就是这么暴露的（第三次与第四次同形）。
    expect(t, "§5 不再说 RSC 取数失败会回退成整页导航（实测多出一条 document 请求）").toMatch(
      /取数失败[^。]{0,24}回退成一次整页导航/,
    );
    expect(t, "§5 不再把断网应用内点击的尽头说成离线壳").toMatch(/尽头\*{0,2}也是离线壳/);
    expect(t, "§5 少了预取这一档（实测点击根本不上网）").toMatch(/预取好了，\*{0,2}断网点它照样渲染真页面/);
    expect(t, "§5 又把这条路径判回 `src/app/error.tsx` 承接（实测三个断网场景里它一次没出现）").not.toContain(
      "src/app/error.tsx` 承接",
    );
  });

  it("引用的 `public/sw.js` 行号里确实是那句只放导航过的守卫", () => {
    const cited = /`public\/sw\.js:(\d+)(?:-(\d+))?`/.exec(s5);
    expect(cited, "§5 不再引用 public/sw.js 的守卫行号，判据要跟着改").toBeTruthy();
    const [, from, to] = cited;
    const lines = sw.split("\n").slice(Number(from) - 1, to ? Number(to) : Number(from));
    expect(lines.join("\n"), `public/sw.js:${from}${to ? `-${to}` : ""} 已经不是那句守卫了`).toMatch(
      /request\.mode !== "navigate"\) return;/,
    );
  });
});
