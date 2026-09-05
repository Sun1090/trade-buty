/**
 * R6.12：知识库外链健康巡检（月度 CI 定时）。
 * - 扫描全部 kb md 的 http(s) 外链
 * - HEAD（失败降级 GET）+ 10s 超时，失败重试一次
 * - 4xx/5xx → exit 1（巡检可见）
 * 用法：npm run ops:link-patrol
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

// 收集外链（去重，记录首次出处）
const links = new Map();
for (const file of walk(KB)) {
  const rel = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");
  const re = /\]\((https?:\/\/[^)\s]+)\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const url = m[1].replace(/[).,]+$/, "");
    if (!links.has(url)) links.set(url, rel);
  }
}

console.log(`🔗 共 ${links.size} 个外链，开始巡检…`);

async function check(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "trade-buty-link-patrol" },
      });
      clearTimeout(timer);
      if (res.status < 400) return null;
      if (res.status === 405 || res.status === 403) {
        // HEAD 不被允许 → 降级 GET（只取状态码）
        const res2 = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "user-agent": "trade-buty-link-patrol" } });
        clearTimeout(timer);
        if (res2.status < 400) return null;
        return `GET ${res2.status}`;
      }
      return `HEAD ${res.status}`;
    } catch (e) {
      clearTimeout(timer);
      if (attempt === 1) return e.name === "AbortError" ? "timeout(10s)" : e.message;
    }
  }
  return "unknown";
}

const broken = [];
const results = await Promise.all(
  [...links.entries()].map(async ([url, where]) => {
    const err = await check(url);
    return err ? `${where}  ${err.toUpperCase()}  ${url}` : null;
  }),
);
for (const r of results) if (r) broken.push(r);

if (broken.length > 0) {
  console.error(`❌ 失效外链 ${broken.length}/${links.size}：`);
  console.error(broken.join("\n"));
  process.exit(1);
}
console.log(`✅ 外链巡检通过（${links.size} 个全部健康）`);
