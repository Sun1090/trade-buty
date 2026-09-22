#!/usr/bin/env node
/**
 * 生产冒烟（`docs/release-checklist.md` 第 5 步）：对已部署域名跑一遍「历史上真出过问题的入口」。
 *
 * 为什么单独成脚本而不是把 `node -e` 留在检查单里：这些断言每次发布都要跑，靠手抄就会漏项，
 * 而 0.7.2 的教训正是「合并 ≠ 上线」——部署被配额挡住时，生产上的行为与 `main` 无关。
 * 脚本只做只读断言（外加一次游客 AI 问答），不带凭证、不写数据。
 *
 * 用法：
 *   npm run ops:smoke-prod
 *   SMOKE_BASE_URL=https://other.example npm run ops:smoke-prod
 *
 * 预览域受 Vercel Deployment Protection 保护，未授权请求会 302 到 SSO（R14.9），
 * 所以默认指向生产域名；要覆盖预览需要账号级 protection-bypass 密钥。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_BASE_URL = "https://trade-buty.vercel.app";
export const RISK_WARNING_MARK = "⚠️";
const REQUEST_TIMEOUT_MS = 20_000;

/** 游客 AI 问答的探针问题：中性、无荐股、不触发作侧护栏 */
export const AI_PROBE_QUESTION = "K 线的上影线代表什么？";

/** 页面断言目标：课程页与课文页各一，历史上游客判定与风险块都在这两处出过问题 */
export const PAGE_PATHS = [
  "/zh",
  "/en",
  "/zh/knowledge/getting-started",
  "/zh/knowledge/getting-started/candlestick-basics",
];

/**
 * 分享落地页的合法载荷。编码规则与 `src/lib/share-decode.ts` 的 `encodeStreak` 一致
 * （`v1|base64url(JSON)`）；由 `prod-smoke.test.mjs` 拿真编码器钉住，防止两处漂移。
 */
export function streakSharePath(payload = { currentStreak: 7, longestStreak: 12, locale: "zh" }) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `/share/streak/v1|${encoded}`;
}

/** 最新发布版本号：`src/data/release-notes.json` 按日期倒序，第一条即最新（站点 changelog 同源） */
export function latestReleaseVersion(root = process.cwd()) {
  const file = path.join(root, "src", "data", "release-notes.json");
  if (!fs.existsSync(file)) return null;
  const releases = JSON.parse(fs.readFileSync(file, "utf8")).releases ?? [];
  const first = releases[0];
  return first && typeof first.version === "string" ? first.version : null;
}

async function defaultFetch(url, init) {
  return fetch(url, { redirect: "follow", ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

/**
 * 断言清单。每个 check 返回 `null` 表示通过，返回字符串表示失败原因（会原样打印）。
 * `expectedVersion` 为 null 时跳过 changelog 版本断言并明确报出原因，避免「无版本可比」被当成通过。
 */
export function buildChecks({ expectedVersion, aiQuestion = AI_PROBE_QUESTION }) {
  const checks = [];

  for (const pagePath of PAGE_PATHS) {
    checks.push({
      name: `GET ${pagePath} → 200 且含风险提示`,
      async run(ctx) {
        const res = await ctx.fetch(`${ctx.baseUrl}${pagePath}`);
        const html = await res.text();
        if (res.status !== 200) return `状态 ${res.status}`;
        if (!html.includes(RISK_WARNING_MARK)) return `HTML 里没有 ${RISK_WARNING_MARK} 风险提示块`;
        return null;
      },
    });
  }

  checks.push({
    name: "GET /sitemap.xml → 200 且是 urlset",
    async run(ctx) {
      const res = await ctx.fetch(`${ctx.baseUrl}/sitemap.xml`);
      const body = await res.text();
      if (res.status !== 200) return `状态 ${res.status}`;
      if (!body.includes("<urlset")) return "响应里没有 <urlset>";
      return null;
    },
  });

  checks.push({
    name: "GET /robots.txt → 200 且指向 sitemap",
    async run(ctx) {
      const res = await ctx.fetch(`${ctx.baseUrl}/robots.txt`);
      const body = await res.text();
      if (res.status !== 200) return `状态 ${res.status}`;
      if (!/sitemap/i.test(body)) return "响应里没有 Sitemap 行";
      return null;
    },
  });

  checks.push({
    name: "GET /zh/changelog → 含最新发布版本（部署跟上 main 的探针）",
    async run(ctx) {
      if (!expectedVersion) return "读不到本地最新发布版本号，无法判断部署是否跟上";
      const res = await ctx.fetch(`${ctx.baseUrl}/zh/changelog`);
      const html = await res.text();
      if (res.status !== 200) return `状态 ${res.status}`;
      if (!html.includes(expectedVersion)) return `页面里没有 ${expectedVersion}，生产构建落后于 main`;
      return null;
    },
  });

  checks.push({
    name: "GET /share/streak/<合法载荷> → 200 且含风险提示（R14.7）",
    async run(ctx) {
      const res = await ctx.fetch(`${ctx.baseUrl}${streakSharePath()}`);
      const html = await res.text();
      if (res.status !== 200) return `状态 ${res.status}`;
      if (!html.includes(RISK_WARNING_MARK)) return `落地页 HTML 里没有 ${RISK_WARNING_MARK}`;
      return null;
    },
  });

  checks.push({
    name: "GET /api/auth/session 匿名 → 200 {\"user\":null}（#107 游客判定回归）",
    async run(ctx) {
      const res = await ctx.fetch(`${ctx.baseUrl}/api/auth/session`);
      const body = (await res.text()).trim();
      if (res.status !== 200) return `状态 ${res.status}`;
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return `响应不是 JSON：${body.slice(0, 80)}`;
      }
      if (!parsed || typeof parsed !== "object" || !("user" in parsed) || parsed.user !== null) {
        return `游客被判成非匿名：${body.slice(0, 80)}`;
      }
      return null;
    },
  });

  checks.push({
    name: "POST /api/ai/chat 游客合法载荷 → 不返回 5xx",
    async run(ctx) {
      const res = await ctx.fetch(`${ctx.baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: aiQuestion }] }),
      });
      await res.text().catch(() => "");
      if (res.status === 429) return null; // 限流生效说明端点活着，且这次冒烟不是唯一流量来源
      if (res.status >= 500) return `状态 ${res.status}（AI 问答对游客不可用）`;
      if (res.status !== 200) return `非预期状态 ${res.status}`;
      return null;
    },
  });

  return checks;
}

/** 逐条跑断言；网络异常按失败计，不中断其余断言（冒烟要给全景，不是撞到第一个错就退）。 */
export async function runChecks({ baseUrl, checks, fetchImpl = defaultFetch }) {
  const ctx = { baseUrl, fetch: fetchImpl };
  const results = [];
  for (const check of checks) {
    try {
      const failure = await check.run(ctx);
      results.push({ name: check.name, ok: !failure, detail: failure ?? "" });
    } catch (error) {
      results.push({ name: check.name, ok: false, detail: `请求异常：${error instanceof Error ? error.message : String(error)}` });
    }
  }
  return results;
}

/** CLI 入口：返回退出码，便于测试；直接执行时由底部写入 process.exitCode。 */
export async function run({
  root = process.cwd(),
  env = process.env,
  stdout = console.log,
  stderr = console.error,
  fetchImpl = defaultFetch,
} = {}) {
  const rawBase = env.SMOKE_BASE_URL ?? DEFAULT_BASE_URL;
  let baseUrl;
  try {
    const url = new URL(rawBase);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("协议必须是 http(s)");
    baseUrl = url.origin;
  } catch (error) {
    stderr(`❌ SMOKE_BASE_URL 不可用：${rawBase}（${error instanceof Error ? error.message : String(error)}）`);
    return 1;
  }

  const expectedVersion = latestReleaseVersion(root);
  const checks = buildChecks({ expectedVersion });
  // 空清单绝不能静默通过——那正是「门禁形同虚设」的样子
  if (checks.length === 0) {
    stderr("❌ 没有任何冒烟断言，拒绝以「全部通过」收场");
    return 1;
  }

  stdout(`🚦 生产冒烟：${baseUrl}（期望已发布版本 ${expectedVersion ?? "读不到"}），${checks.length} 条断言`);
  const results = await runChecks({ baseUrl, checks, fetchImpl });
  for (const result of results) {
    stdout(`  ${result.ok ? "✅" : "❌"} ${result.name}${result.ok ? "" : ` — ${result.detail}`}`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    stderr(`❌ 生产冒烟失败 ${failed.length}/${results.length} 条：${failed.map((f) => f.name).join("；")}`);
    stderr("   先确认部署是否真的跟上 main（配额限流会让生产停在旧构建），再看是不是站内回归。");
    return 1;
  }
  stdout(`✅ 生产冒烟通过（${results.length} 条全部符合预期）`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run();
}
