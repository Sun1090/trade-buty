/**
 * 隐私页必须说清「未登录时到底有什么请求离开浏览器」。
 *
 * 浏览器能打到的同源接口是从客户端源码里扫出来的，不是手写清单：新增一条调用却没在
 * 隐私页点名，这里就红。过去的文案写的是「除非登录否则不会向服务器发送任何数据」，
 * 而 /api/ai/* 游客可用、/api/error-reports 匿名可写——那是一句假话。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PAGE_FILE = path.resolve(
  process.cwd(),
  "src/app/[locale]/privacy/page.tsx",
);

/** 遍历客户端源码（服务端路由自身除外），收集写在字符串里的 /api 调用目标 */
function clientApiTargets(dir: string, out = new Set<string>()): Set<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full !== path.join(process.cwd(), "src/app/api")) clientApiTargets(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || entry.name.includes(".test.")) continue;
    for (const m of fs.readFileSync(full, "utf8").matchAll(/["'`](\/api\/[a-z0-9/-]+)/g)) {
      out.add(m[1]);
    }
  }
  return out;
}

/** 隐私页文案点名的接口（`/api/ai/*` 这类通配写法转成前缀） */
function disclosedPrefixes(): string[] {
  const copy = fs.readFileSync(PAGE_FILE, "utf8");
  return [...copy.matchAll(/\/api\/[a-z0-9/-]*\*?/g)]
    .map((m) => m[0].replace(/\*$/, ""))
    .filter((m) => m.length > 0);
}

/** 本站自己写下的 cookie 名（服务端路由与测试文件除外） */
function firstPartyCookieNames(dir: string, out = new Set<string>()): Set<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full !== path.join(process.cwd(), "src/app/api")) firstPartyCookieNames(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || entry.name.includes(".test.")) continue;
    const src = fs.readFileSync(full, "utf8");
    for (const m of src.matchAll(/document\.cookie\s*=\s*["'`]([a-z0-9-]+)=/gi)) {
      out.add(m[1]);
    }
    for (const m of src.matchAll(/cookies\(\)\.set\(\s*["'`]([a-z0-9-]+)/gi)) {
      out.add(m[1]);
    }
  }
  return out;
}

describe("隐私页与真实网络面一致", () => {
  it("客户端确实会打到每一个同源接口都被隐私页点名", () => {
    const targets = [...clientApiTargets(path.join(process.cwd(), "src"))];
    // 扫描本身不能是空转
    expect(targets.length).toBeGreaterThan(0);
    const prefixes = disclosedPrefixes();

    for (const target of targets) {
      // 登录/登出/删号本身就是「以账户身份行动」的动作，隐私页按流程而非路径披露
      if (target.startsWith("/api/auth/")) continue;
      expect(prefixes.some((p) => target.startsWith(p)), target).toBe(true);
    }
  });

  it("中英文文案都各自点名了游客可达的两类请求", () => {
    const copy = fs.readFileSync(PAGE_FILE, "utf8");
    // 每个接口在 zh / en 两条字符串里各出现一次：只改一种语言就红
    expect((copy.match(/\/api\/ai\//g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((copy.match(/\/api\/error-reports/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("本站自己写的每一个 cookie 都在隐私页里点过名", () => {
    const names = [...firstPartyCookieNames(path.join(process.cwd(), "src"))];
    expect(names.length).toBeGreaterThan(0);
    const copy = fs.readFileSync(PAGE_FILE, "utf8");
    for (const name of names) expect(copy, name).toContain(name);
  });

  it("AI 上游降级链里的每一家模型商都在隐私页点名", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/ai/client.ts"),
      "utf8",
    );
    const chain = /const chain = \[([^\]]+)\]/.exec(source)?.[1] ?? "";
    const vendors = [...new Set([...chain.matchAll(/"([a-z]+)-/gi)].map((m) => m[1].toLowerCase()))];
    // 解析不出链条时不许静默变成「全绿」
    expect(vendors.length).toBeGreaterThanOrEqual(3);

    const copy = fs.readFileSync(PAGE_FILE, "utf8").toLowerCase();
    for (const vendor of vendors) {
      expect(copy, `隐私页第三方一节应点名 ${vendor}`).toContain(vendor);
    }
  });

  it("不再声称未登录时零请求到达服务器", () => {
    const copy = fs.readFileSync(PAGE_FILE, "utf8");
    expect(copy).not.toMatch(/除非你选择登录/);
    expect(copy).not.toMatch(/唯一在无账户时到达服务器的请求/);
    expect(copy).not.toMatch(/No data is sent to our servers unless/);
    expect(copy).not.toMatch(/the only request that reaches us without an account/);
  });
});

/** 迁移里「账户删除后转为匿名行保留」的表（FK 指向 auth.users 且 on delete set null） */
function accountDetachedTables(): string[] {
  const dir = path.join(process.cwd(), "supabase/migrations");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .flatMap((f) => {
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      return [...sql.matchAll(/create table (?:if not exists )?[`"']?([\w.]+)[`"']?\s*\(([\s\S]*?)\n\);/gi)].filter(
        (m) =>
          m[2]
            .split("\n")
            .some(
              (line) =>
                /references\s+auth\.users/i.test(line) && /on delete set null/i.test(line),
            ),
      ).map((m) => m[1].toLowerCase());
    });
}
describe("账户删除后的留存边界也被披露", () => {
  it("讲「删除账户」的那一段，同时说清哪张表会转为匿名行留下", () => {
    const disclosed: Record<string, string[]> = {
      "ai_citation_clicks": ["引用", "citation"],
    };
    const tables = accountDetachedTables();
    expect(tables.length).toBeGreaterThan(0);

    const copy = fs.readFileSync(PAGE_FILE, "utf8");
    // 只看那一段：全文找「引用」这种关键词会永远命中，等于没有门禁
    const paragraph = copy
      .split(/<\/p>/)
      .find((chunk) => /delete account/i.test(chunk) && /删除账户/.test(chunk));
    expect(paragraph, "隐私页必须有一段同时用中英讲删除账户").toBeTruthy();

    for (const table of tables) {
      const keywords = disclosed[table];
      expect(keywords, `新增匿名留存表 ${table}：先在删除账户那一段说明它留下什么，再补进这张表`).toBeTruthy();
      for (const keyword of keywords) expect(paragraph!.toLowerCase(), `${table} → ${keyword}`).toContain(keyword);
    }
  });
});
