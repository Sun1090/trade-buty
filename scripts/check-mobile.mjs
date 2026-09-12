import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

/**
 * 320px 移动端溢出回归：起生产服务，逐页检查横向滚动条。
 * 用法: npm run build && npm run check:mobile
 * 任一页面 scrollWidth > 320 即失败（CI 阻断）。
 */
const PORT = 3210;
const BASE = `http://localhost:${PORT}`;
const NEXT_BIN = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

const ROUTES = [
  "/zh",
  "/en",
  "/zh/path",
  "/en/path",
  "/zh/search",
  "/zh/chart",
  "/zh/replay",
  "/zh/review",
  // R12.21：统计页移动布局门禁（新趋势组件/时间范围筛选必须在 320px 不溢出）
  "/zh/stats",
  "/en/stats",
  "/zh/knowledge/getting-started",
  "/zh/knowledge/getting-started/market-overview",
  "/en/knowledge/getting-started/market-overview",
  "/zh/knowledge/technical-analysis/chart-patterns",
];

function waitForServer(proc) {
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      proc.stdout.off("data", onStdout);
      proc.stderr.off("data", onStderr);
      proc.off("exit", onExit);
      proc.off("error", onError);
      callback(value);
    };
    const onStdout = (data) => {
      output += String(data);
      if (output.includes("Ready in")) finish(resolve);
    };
    const onStderr = (data) => {
      output += String(data);
    };
    const onExit = (code, signal) => {
      finish(reject, new Error(`server exited before ready (code=${code}, signal=${signal})\n${output}`));
    };
    const onError = (error) => {
      finish(reject, new Error(`server spawn failed: ${error.message}`));
    };

    timer = setTimeout(() => {
      finish(reject, new Error(`server start timeout\n${output}`));
    }, 60000);
    proc.stdout.on("data", onStdout);
    proc.stderr.on("data", onStderr);
    proc.on("exit", onExit);
    proc.on("error", onError);
  });
}

async function main() {
  const proc = spawn(process.execPath, [NEXT_BIN, "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let failures = [];
  let browser;
  try {
    await waitForServer(proc);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
    for (const route of ROUTES) {
      try {
        await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
        // networkidle 在 CI 的长期连接下可能永远不触发；等待 load 有上限并继续检查最终布局。
        await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});
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
  } finally {
    await browser?.close().catch(() => {});
    proc.kill("SIGTERM");
  }
  if (failures.length > 0) {
    console.error(`[mobile] ${failures.length} 个页面横向溢出，构建阻断`);
    process.exit(1);
  }
  console.log(`[mobile] ✓ ${ROUTES.length} 个关键页面 320px 无溢出`);
}

main().catch((e) => {
  console.error("[mobile]", e.message);
  process.exit(1);
});
