import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

/**
 * 320px 移动端溢出回归：起生产服务，逐页检查横向滚动条。
 * 用法: npm run build && npm run check:mobile
 * 任一页面 scrollWidth > 320 即失败（CI 阻断）。
 */
const PORT = 3210;
const BASE = `http://localhost:${PORT}`;

const ROUTES = [
  "/zh",
  "/en",
  "/zh/path",
  "/en/path",
  "/zh/search",
  "/zh/chart",
  "/zh/replay",
  "/zh/review",
  "/zh/knowledge/getting-started",
  "/zh/knowledge/getting-started/market-overview",
  "/en/knowledge/getting-started/market-overview",
  "/zh/knowledge/technical-analysis/chart-patterns",
];

function waitForServer(proc) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server start timeout")), 60000);
    proc.stdout.on("data", (d) => {
      if (String(d).includes("Ready in")) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

async function main() {
  const proc = spawn("npx", ["next", "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let failures = [];
  try {
    await waitForServer(proc);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
    for (const route of ROUTES) {
      try {
        await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
      } catch {
        failures.push(`${route}（加载超时）`);
        continue;
      }
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        return de.scrollWidth - de.clientWidth;
      });
      if (overflow > 1) {
        failures.push(`${route}（溢出 ${overflow}px）`);
        console.log(`[mobile] ✗ ${route} 溢出 ${overflow}px`);
      } else {
        console.log(`[mobile] ✓ ${route}`);
      }
    }
    await browser.close();
  } finally {
    proc.kill("SIGTERM");
  }
  if (failures.length > 0) {
    console.error(`[mobile] ${failures.length} 个页面横向溢出，构建阻断`);
    process.exit(1);
  }
  console.log("[mobile] ✓ 12 个关键页面 320px 无溢出");
}

main().catch((e) => {
  console.error("[mobile]", e.message);
  process.exit(1);
});
