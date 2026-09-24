/**
 * 隐私页必须说清「未登录时到底有什么请求离开浏览器」。
 *
 * 浏览器能打到的同源接口是从客户端源码里扫出来的，不是手写清单：新增一条调用却没在
 * 隐私页点名，这里就红。扫描读的是**源码文本**而不是 AST，所以注释里也别写
 * 「反引号或引号紧接 /api/…」的形状——那会被当成一条真实调用（2026-09-24 实测：
 * `binance.ts` 的一句注释里的 ping 端点就这么被判成了未披露的接口）。过去的文案写的是「除非登录否则不会向服务器发送任何数据」，
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

    // R16.162：以前这里读的是整页源码——把某一家挪到 Cookie 段、甚至挪进注释里都照样绿，
    // 而断言消息说的是「第三方一节应点名」。用同文件已有的 paragraph() 把射程收到那一节。
    const sectionText = section("Third-Party Services", "第三方服务").toLowerCase();
    for (const vendor of vendors) {
      expect(sectionText, `隐私页第三方一节应点名 ${vendor}`).toContain(vendor);
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

/**
 * 一段 `<p>{locale === "en" ? "…" : "…"}</p>` 里的两条文案。
 * 只取足够长的字面量，避免把 `locale === "en"` 之类的短串当成文案。
 */
function localeStringsIn(chunk: string): string[] {
  return [...chunk.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).filter((s) => s.length >= 40);
}

/** 隐私页里同时含中英两个关键字的那一段 */
function paragraph(zhMark: string | RegExp, enMark: RegExp): string {
  const test = typeof zhMark === "string" ? (c: string) => c.includes(zhMark) : (c: string) => zhMark.test(c);
  const chunk = fs.readFileSync(PAGE_FILE, "utf8").split(/<\/p>/).find((c) => test(c) && enMark.test(c));
  expect(chunk, `隐私页需要一段同时用中英讲「${String(zhMark)}」`).toBeTruthy();
  return chunk as string;
}

/** 隐私页某一节的源码文本：按 `</section>` 切，再要求两种语言的**节标题**都在其中。
 *  不能只按 `</p>` 找关键字——AI 那一段正文就写着「“第三方服务”一节 / named under
 *  Third-Party Services」，按关键字先命中的是它，而它不点名任何一家模型商。 */
function section(titleEn: string, titleZh: string): string {
  const chunk = fs
    .readFileSync(PAGE_FILE, "utf8")
    .split(/<\/section>/)
    .find((c) => c.includes(`"${titleEn}"`) && c.includes(`"${titleZh}"`));
  expect(chunk, `隐私页缺「${titleZh}」这一节`).toBeTruthy();
  return chunk as string;
}

/** 迁移里随账户删除一起级联消失的表（FK 指向 auth.users 且 on delete cascade） */
function accountCascadeTables(): string[] {
  const dir = path.join(process.cwd(), "supabase/migrations");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .flatMap((f) => {
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      return [...sql.matchAll(/create table (?:if not exists )?[`"']?([\w.]+)[`"']?\s*\(([\s\S]*?)\n\);/gi)]
        .filter((m) =>
          m[2].split("\n").some((line) => /references\s+auth\.users/i.test(line) && /on delete cascade/i.test(line)),
        )
        .map((m) => m[1].toLowerCase());
    });
}

/** 代码里真实写进 sessionStorage 的键 */
function sessionStorageKeys(dir: string, out = new Set<string>()): Set<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sessionStorageKeys(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
      const src = fs.readFileSync(full, "utf8");
      for (const m of src.matchAll(/sessionStorage\s*\.\s*setItem\(\s*["'`]([\w-]+)/g)) out.add(m[1]);
    }
  }
  return out;
}

describe("离线写入队列的真实边界被披露", () => {
  it("队列长度上限写的是 sync-queue.ts 里的那个常量，不是另一个数", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/sync-queue.ts"), "utf8");
    const cap = src.match(/export const MAX_QUEUE\s*=\s*(\d+)/);
    expect(cap, "MAX_QUEUE 必须是具名常量，隐私页才有唯一可引用的数").toBeTruthy();

    const chunk = paragraph("队列", /queue|writes? (?:are|is) retried/i);
    const strings = localeStringsIn(chunk);
    expect(strings.length, "这一段必须有中英两条文案").toBeGreaterThanOrEqual(2);
    for (const text of strings) {
      expect(text, `文案里的队列上限必须是 ${cap![1]}（与 MAX_QUEUE 同源）`).toContain(cap![1]);
    }
  });

  it("超出上限丢最旧、换账户清空未同步写入——两种「不会再同步」都写到", () => {
    const chunk = paragraph("队列", /queue/i);
    for (const text of localeStringsIn(chunk)) {
      const lower = text.toLowerCase();
      // 丢弃最旧 / 超出上限
      expect(lower).toMatch(/最旧|oldest|drop|discard|挤掉|超出/);
      // 同一设备换账户会清掉待同步队列
      expect(lower).toMatch(/换账户|切换.{0,4}账户|另一个账户|switch(?:ing)? (?:accounts|to another)|another account|account switch/i);
      expect(lower).toMatch(/清空|清除|不会.{0,6}补传|discard|drop|clear|will not be (?:re)?sent|never (?:re)?sent|not retried/i);
    }
  });

  it("本机存储不止 localStorage：写了 sessionStorage 就不能说「只存活于 localStorage」", () => {
    const keys = sessionStorageKeys(path.join(process.cwd(), "src"));
    expect(keys.size, "客户端确实在用 sessionStorage，隐私页必须承认这一点").toBeGreaterThan(0);

    const chunk = paragraph("本机", /local storage|localStorage/i);
    for (const text of localeStringsIn(chunk)) {
      expect(text.toLowerCase(), "提到本地存储时要把 sessionStorage 那一并算进来").toContain("sessionstorage");
    }
  });
});

describe("删除账户时被级联删除的每张表都在文案里点名", () => {
  // 新增一张挂 auth.users 的表时，这里会红：先补文案，再补这张表的中文/英文关键字
  const disclosed: Record<string, string[]> = {
    progress: ["进度", "progress"],
    wrongbook: ["错题", "mistake"],
    quiz_scores: ["测验", "quiz"],
    replay_history: ["回放", "replay"],
    replay_best: ["连胜", "streak"],
    ai_conversations: ["对话", "conversation"],
    ai_feedback: ["评分", "rating"],
    user_settings: ["设置", "setting"],
  };

  it("删除账户那一段列出了全部会随账户消失的表", () => {
    const tables = accountCascadeTables();
    expect(tables.length).toBeGreaterThan(0);

    const chunk = paragraph("删除账户", /delete account/i);
    const lower = chunk.toLowerCase();
    for (const table of tables) {
      const keywords = disclosed[table];
      expect(
        keywords,
        `表 ${table} 会随账户删除而级联消失，但隐私页没说清它是什么：请先用中英两种语言写出这一类数据，再补进这张表的关键字`,
      ).toBeTruthy();
      for (const keyword of keywords) {
        expect(lower, `${table} → ${keyword} 必须出现在删除账户那一段`).toContain(keyword);
      }
    }
  });
});

/** 从源码里读出的具名数字常量（隐私页要引用的就是这一个数，不是文案里的第二个数） */
function numericConst(file: string, name: string): string {
  const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const m = src.match(new RegExp(`export const ${name}\\s*=\\s*(\\d+)`));
  expect(m, `${file} 里的 ${name} 必须是具名数字常量，隐私页才有唯一可引用的数`).toBeTruthy();
  return m![1];
}

describe("本机保留窗口的数与代码同源", () => {
  it("学习时长台账的天数、回放历史的轮数都取自常量", () => {
    const keepDays = numericConst("src/lib/study-time.ts", "STUDY_LEDGER_KEEP_DAYS");
    const keepRounds = numericConst("src/lib/replay-history-limit.ts", "REPLAY_HISTORY_KEEP");

    const chunk = paragraph(/保留最近/, /keeps the (?:most recent|latest)/i);
    const strings = localeStringsIn(chunk);
    expect(strings.length, "这一段必须有中英两条文案").toBeGreaterThanOrEqual(2);
    for (const text of strings) {
      expect(text, `台账窗口必须是 ${keepDays} 天（与 STUDY_LEDGER_KEEP_DAYS 同源）`).toContain(keepDays);
      expect(text, `回放轮数必须是 ${keepRounds} 轮（与 REPLAY_HISTORY_KEEP 同源）`).toContain(keepRounds);
    }
  });

  it("本地写入与云端合并共用同一个回放轮数上限", () => {
    // 两处各写各的数，就会「都保留最近 100 轮」却留着不同的 100 轮：
    // 合并那一步能把本机刚留下的几轮裁掉，云端取数也能比上限少拉几轮。
    numericConst("src/lib/replay-history-limit.ts", "REPLAY_HISTORY_KEEP");
    for (const file of ["src/lib/replay-store.ts", "src/lib/sync-layer.ts"]) {
      const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(src, `${file} 必须引用 REPLAY_HISTORY_KEEP`).toContain("REPLAY_HISTORY_KEEP");
      expect(
        [...src.matchAll(/\.slice\(-\d+\)|\.limit\(\d+\)/g)].map((m) => m[0]),
        `${file} 里不该再有写死的尾部截断 / 取数上限字面量`,
      ).toEqual([]);
    }
  });
});
