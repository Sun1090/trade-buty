import { describe, expect, it } from "vitest";
import {
  auditSeoSurface,
  compileRobotsPattern,
  extractCanonical,
  extractMetaRobots,
  isNoindex,
  isRobotsDisallowed,
  loadSeoSurface,
  matchesRobotsRule,
  parseRobotsTxt,
  parseSitemapXml,
  validateDeclaration,
} from "./seo-surface-lib.mjs";

const BASE = "https://example.test";
const NOW = new Date("2026-09-12T00:00:00Z");

const declaration = {
  indexable: [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/path", changeFrequency: "weekly", priority: 0.9 },
  ],
  noindex: ["/stats"],
  robotsDisallow: ["/api/", "/*/auth"],
};

function goodFixture() {
  return {
    siteUrl: BASE,
    declaration,
    sitemap: {
      urls: [`${BASE}/zh`, `${BASE}/en`, `${BASE}/zh/path`, `${BASE}/en/path`],
      lastmods: new Map(),
      duplicates: [],
    },
    robotsTxt: {
      userAgents: ["*"],
      allow: ["/"],
      disallow: ["/api/", "/*/auth"],
      sitemap: [`${BASE}/sitemap.xml`],
    },
    pages: [
      { pathname: "/zh", robots: null, canonical: `${BASE}/zh` },
      { pathname: "/en", robots: null, canonical: `${BASE}/en` },
      { pathname: "/zh/path", robots: null, canonical: `${BASE}/zh/path` },
      { pathname: "/en/path", robots: null, canonical: `${BASE}/en/path` },
      { pathname: "/zh/stats", robots: "noindex, nofollow", canonical: null },
      { pathname: "/en/stats", robots: "noindex, nofollow", canonical: null },
    ],
    now: NOW,
  };
}

const run = (patch) => {
  const f = goodFixture();
  const merged = { ...f, ...patch };
  return auditSeoSurface(merged);
};

describe("validateDeclaration", () => {
  it("接受合法声明", () => {
    expect(validateDeclaration(declaration).indexable).toHaveLength(2);
  });

  it("拒绝 indexable / noindex 重叠", () => {
    expect(() =>
      validateDeclaration({ ...declaration, noindex: ["/path", "/stats"] }),
    ).toThrow(/不能同时可索引/);
  });

  it("拒绝非法 changeFrequency 与 priority 越界", () => {
    expect(() =>
      validateDeclaration({
        ...declaration,
        indexable: [{ path: "/x", changeFrequency: "fortnightly", priority: 2 }],
      }),
    ).toThrow(/changeFrequency 非法/);
  });

  it("拒绝重复路径", () => {
    expect(() =>
      validateDeclaration({
        ...declaration,
        noindex: ["/stats", "/stats"],
      }),
    ).toThrow(/重复/);
  });
});

describe("robots 模式匹配", () => {
  it("锚定开头且 * 为通配", () => {
    expect(compileRobotsPattern("/api/").test("/api/ai/plan")).toBe(true);
    expect(compileRobotsPattern("/api/").test("/zh/api/")).toBe(false);
  });

  it("/*/auth 命中两个 locale 的 auth 路由", () => {
    expect(matchesRobotsRule("/*/auth", "/zh/auth")).toBe(true);
    expect(matchesRobotsRule("/*/auth", "/en/auth/callback")).toBe(true);
    expect(matchesRobotsRule("/*/auth", "/zh/author")).toBe(true); // 前缀匹配是 robots 规范行为
    expect(matchesRobotsRule("/*/auth", "/zh/path")).toBe(false);
  });

  it("isRobotsDisallowed 汇总任意命中", () => {
    expect(isRobotsDisallowed(["/api/", "/offline.html"], "/offline.html")).toBe(true);
    expect(isRobotsDisallowed(["/api/"], "/zh/faq")).toBe(false);
  });

  it("转义正则元字符", () => {
    expect(compileRobotsPattern("/a+b").test("/a+b")).toBe(true);
    expect(compileRobotsPattern("/a+b").test("/aab")).toBe(false);
  });
});

describe("parseRobotsTxt", () => {
  it("解析指令、忽略注释与空行，大小写不敏感", () => {
    const parsed = parseRobotsTxt(
      [
        "# 说明",
        "User-Agent: *",
        "Allow: /",
        "Disallow: /api/",
        "disallow:/*/auth",
        "",
        "Sitemap: https://example.test/sitemap.xml",
      ].join("\n"),
    );
    expect(parsed.userAgents).toEqual(["*"]);
    expect(parsed.allow).toEqual(["/"]);
    expect(parsed.disallow).toEqual(["/api/", "/*/auth"]);
    expect(parsed.sitemap).toEqual(["https://example.test/sitemap.xml"]);
  });
});

describe("parseSitemapXml", () => {
  it("提取 URL / lastmod 并识别重复", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://example.test/zh</loc><lastmod>2026-09-12T00:00:00.000Z</lastmod></url>
      <url><loc>https://example.test/zh</loc></url>
      <url><loc>https://example.test/en</loc></url>
    </urlset>`;
    const parsed = parseSitemapXml(xml);
    expect(parsed.urls).toEqual([
      "https://example.test/zh",
      "https://example.test/zh",
      "https://example.test/en",
    ]);
    expect(parsed.duplicates).toEqual(["https://example.test/zh"]);
    expect(parsed.lastmods.get("https://example.test/zh")).toBe("2026-09-12T00:00:00.000Z");
  });
});

describe("HTML meta 提取", () => {
  it("robots meta 属性顺序与大小写无关", () => {
    expect(extractMetaRobots('<meta content="noindex" name="robots">')).toBe("noindex");
    expect(extractMetaRobots('<META NAME="ROBOTS" CONTENT="noindex, nofollow"/>')).toBe(
      "noindex, nofollow",
    );
    expect(extractMetaRobots('<meta name="description" content="x">')).toBeNull();
  });

  it("canonical 提取", () => {
    expect(extractCanonical('<link rel="canonical" href="https://example.test/zh">')).toBe(
      "https://example.test/zh",
    );
    expect(extractCanonical("<html></html>")).toBeNull();
  });

  it("isNoindex 只认可独立 token", () => {
    expect(isNoindex("noindex")).toBe(true);
    expect(isNoindex("noindex, nofollow")).toBe(true);
    expect(isNoindex("noindex,follow")).toBe(true);
    expect(isNoindex("nonoindex")).toBe(false);
    expect(isNoindex(null)).toBe(false);
  });
});

describe("auditSeoSurface", () => {
  it("自洽的产物没有报错", () => {
    expect(run({}).errors).toEqual([]);
  });

  it("可索引页面漏收 sitemap 会被抓出来", () => {
    const result = run({
      sitemap: { urls: [`${BASE}/zh`, `${BASE}/en`], lastmods: new Map(), duplicates: [] },
    });
    expect(result.errors.join("\n")).toMatch(/可索引页面未进 sitemap：\/zh\/path/);
  });

  it("可索引页面带 noindex 会被抓出来", () => {
    const f = goodFixture();
    f.pages = f.pages.map((p) =>
      p.pathname === "/zh/path" ? { ...p, robots: "noindex" } : p,
    );
    expect(auditSeoSurface(f).errors.join("\n")).toMatch(/却带了 noindex/);
  });

  it("canonical 指向别处会被抓出来", () => {
    const f = goodFixture();
    f.pages = f.pages.map((p) => (p.pathname === "/zh" ? { ...p, canonical: `${BASE}/en` } : p));
    expect(auditSeoSurface(f).errors.join("\n")).toMatch(/canonical 必须指向自身/);
  });

  it("noindex 页面进了 sitemap 会被抓出来", () => {
    const result = run({
      sitemap: {
        urls: [...goodFixture().sitemap.urls, `${BASE}/zh/stats`],
        lastmods: new Map(),
        duplicates: [],
      },
    });
    expect(result.errors.join("\n")).toMatch(/noindex 页面被 sitemap 收录：\/zh\/stats/);
  });

  it("声明 noindex 但页面没有 meta 会被抓出来", () => {
    const f = goodFixture();
    f.pages = f.pages.map((p) => (p.pathname === "/en/stats" ? { ...p, robots: null } : p));
    expect(auditSeoSurface(f).errors.join("\n")).toMatch(/缺少 noindex meta：\/en\/stats/);
  });

  it("robots Disallow 与声明不一致会被抓出来", () => {
    const result = run({
      robotsTxt: {
        userAgents: ["*"],
        allow: ["/"],
        disallow: ["/api/"],
        sitemap: [`${BASE}/sitemap.xml`],
      },
    });
    expect(result.errors.join("\n")).toMatch(/Disallow 与 seo-surface.json 不一致/);
  });

  it("缺少 Sitemap 指令会被抓出来", () => {
    const result = run({
      robotsTxt: { userAgents: ["*"], allow: ["/"], disallow: ["/api/", "/*/auth"], sitemap: [] },
    });
    expect(result.errors.join("\n")).toMatch(/必须声明 Sitemap/);
  });

  it("sitemap 收录被 Disallow 的路径会被抓出来", () => {
    const result = run({
      sitemap: {
        urls: [...goodFixture().sitemap.urls, `${BASE}/zh/auth/callback`],
        lastmods: new Map(),
        duplicates: [],
      },
    });
    expect(result.errors.join("\n")).toMatch(/收录了被 robots.txt Disallow 的路径/);
  });

  it("重复 URL / 非法 lastmod / 未来 lastmod 都会被抓出来", () => {
    const urls = [...goodFixture().sitemap.urls, `${BASE}/zh`];
    const result = run({
      sitemap: {
        urls,
        lastmods: new Map([
          [`${BASE}/zh`, "not-a-date"],
          [`${BASE}/en`, "2099-01-01T00:00:00.000Z"],
        ]),
        duplicates: [`${BASE}/zh`],
      },
    });
    const joined = result.errors.join("\n");
    expect(joined).toMatch(/重复 URL/);
    expect(joined).toMatch(/不是合法时间/);
    expect(joined).toMatch(/位于未来/);
  });

  it("非 https 或跨站 URL 会被抓出来", () => {
    const result = run({
      sitemap: {
        urls: [...goodFixture().sitemap.urls, "http://example.test/zh/about", "https://other.test/x"],
        lastmods: new Map(),
        duplicates: [],
      },
    });
    const joined = result.errors.join("\n");
    expect(joined).toMatch(/必须是 https 绝对地址/);
    expect(joined).toMatch(/不在站点根下/);
  });

  it("未声明的产物页面会被抓出来", () => {
    const f = goodFixture();
    f.pages = [...f.pages, { pathname: "/zh/new-page", robots: null, canonical: `${BASE}/zh/new-page` }];
    expect(auditSeoSurface(f).errors.join("\n")).toMatch(/未声明的可索引表面：\/zh\/new-page/);
  });

  it("知识库页面必须可索引、进 sitemap 且 canonical 指向自身", () => {
    const f = goodFixture();
    f.isKnowledgePage = (p) => p.startsWith("/zh/knowledge/");
    f.pages = [
      ...f.pages,
      {
        pathname: "/zh/knowledge/basics",
        robots: "noindex",
        canonical: `${BASE}/zh/knowledge/other`,
      },
    ];
    const joined = auditSeoSurface(f).errors.join("\n");
    expect(joined).toMatch(/知识库页面不应 noindex：\/zh\/knowledge\/basics/);
    expect(joined).toMatch(/知识库页面未进 sitemap：\/zh\/knowledge\/basics/);
    expect(joined).toMatch(/知识库页面 canonical 必须指向自身/);
  });

  // 唯一例外：auth 回调带 OAuth 凭据，宁可挡住爬虫也不让它进索引队列。
  const CRAWL_BLOCKED_BY_DESIGN = ["/auth", "/auth/callback"];

  it("除了故意挡爬虫的 auth，noindex 页面都不会被 Disallow（否则爬虫读不到 noindex）", () => {
    const decl = loadSeoSurface(process.cwd());
    for (const locale of ["zh", "en"]) {
      for (const p of decl.noindex) {
        const pathname = `/${locale}${p}`;
        const expected = CRAWL_BLOCKED_BY_DESIGN.includes(p);
        expect(
          isRobotsDisallowed(decl.robotsDisallow, pathname),
          `${pathname} 的 Disallow 状态与预期不符`,
        ).toBe(expected);
      }
      for (const surface of decl.indexable) {
        const pathname = `/${locale}${surface.path}`;
        expect(isRobotsDisallowed(decl.robotsDisallow, pathname)).toBe(false);
      }
    }
  });

  it("知识库页面缺 canonical 视为运行时 fallback（提示重新 build）", () => {
    const f = goodFixture();
    f.isKnowledgePage = (p) => p.startsWith("/zh/knowledge/");
    f.pages = [
      ...f.pages,
      { pathname: "/zh/knowledge/nonexistent-chapter", robots: "noindex", canonical: null },
    ];
    const joined = auditSeoSurface(f).errors.join("\n");
    expect(joined).toMatch(/非预渲染的知识库页面：\/zh\/knowledge\/nonexistent-chapter/);
    expect(joined).toMatch(/重新 npm run build/);
    // fallback 页只报一条，不再叠加 sitemap / meta 的次级噪音
    expect(joined).not.toMatch(/知识库页面未进 sitemap/);
  });

  it("自身声明文件可加载且结构合法", () => {
    const decl = loadSeoSurface(process.cwd());
    expect(decl.indexable.length).toBeGreaterThan(0);
    expect(decl.noindex).toContain("/stats");
    expect(decl.robotsDisallow).toContain("/api/");
    expect(decl.robotsDisallow).not.toContain("/*/ai"); // ai 页改用 noindex，不再 Disallow
  });
});
