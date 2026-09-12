import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import { SERVICE_WORKER_CACHE_POLICY } from "../../next.config";

const OFFLINE_HTML = readFileSync(
  path.resolve(process.cwd(), "public/offline.html"),
  "utf8"
);
const SW_SOURCE = readFileSync(
  path.resolve(process.cwd(), "public/sw.js"),
  "utf8"
);
// 去掉块注释后再做「不触碰内容产物」断言，注释里说明边界不算违规。
const SW_CODE = SW_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");

describe("PWA manifest（R13.13）", () => {
  it("声明稳定的 app 身份、作用域与中文默认入口", () => {
    const m = manifest();
    expect(m.id).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.start_url).toBe("/zh");
    expect(m.lang).toBe("zh-CN");
    expect(m.dir).toBe("ltr");
  });

  it("保持可安装性与图标契约", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#0a0d14");
    expect(m.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
    expect(m.icons?.some((icon) => icon.sizes === "512x512")).toBe(true);
  });

  it("start_url 指向真实存在的本地化路由", () => {
    expect(manifest().start_url).toMatch(/^\/(zh|en)$/);
  });

  it("robots 不收录离线兜底页", () => {
    const rules = robots().rules;
    const disallow = Array.isArray(rules)
      ? rules.flatMap((rule) => rule.disallow ?? [])
      : (rules.disallow ?? []);
    expect(disallow).toContain("/offline.html");
  });
});

describe("离线页（R13.13）", () => {
  it("自带全部样式脚本，不依赖外部资源", () => {
    expect(OFFLINE_HTML).not.toMatch(/<link[^>]+href="https?:/i);
    expect(OFFLINE_HTML).not.toMatch(/<script[^>]+src=/i);
    expect(OFFLINE_HTML).not.toMatch(/url\(\s*["']?https?:/i);
  });

  it("是中英双语、可重试、且不被搜索引擎收录", () => {
    expect(OFFLINE_HTML).toContain('name="robots" content="noindex"');
    expect(OFFLINE_HTML).toContain("离线");
    expect(OFFLINE_HTML).toContain('lang="en"');
    expect(OFFLINE_HTML).toContain('id="retry"');
    expect(OFFLINE_HTML).toContain('role="status"');
    expect(OFFLINE_HTML).toContain('aria-live="polite"');
  });

  it("明确说明本地学习数据保留、联网能力受限（不承诺收益/离线可用）", () => {
    expect(OFFLINE_HTML).toContain("保存在本机");
    expect(OFFLINE_HTML).toContain("需要联网");
  });
});

describe("离线缓存边界（R13.13 + R10.24）", () => {
  it("service worker 脚本禁止被 HTTP 缓存拖住", () => {
    expect(SERVICE_WORKER_CACHE_POLICY.source).toBe("/sw.js");
    expect(SERVICE_WORKER_CACHE_POLICY.headers[0]).toEqual({
      key: "Cache-Control",
      value: "no-cache",
    });
  });

  it("worker 只做导航兜底，不触碰内容产物缓存", () => {
    expect(SW_SOURCE).toContain('request.mode !== "navigate"');
    expect(SW_CODE).not.toContain("search-index.json");
    expect(SW_CODE).not.toContain("knowledge-assets");
    expect(SW_SOURCE).toContain("docs/caching.md");
  });
});
