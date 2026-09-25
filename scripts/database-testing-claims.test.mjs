/**
 * R16.268：`docs/database-testing.md` 的每一格数字都要由工件自己说出来。
 *
 * 为什么要这份判据：这一篇是数据层门禁的唯一说明书，而它通篇是**可数的东西**——pgTAP 的
 * `plan(N)`、A 写了几张表、合法档位有几个、`pg_dump` 到底带不带 `--no-acl`、回滚演练做几支。
 * 本轮动手之前它就有 4 处对不上（原文见 docs/progress.md 的第三十五轮），其中一处是把
 * `pg_dump` 的旗子写成了 `--no-acl`，而恢复端**恰恰依赖 ACL 在备份里**。
 *
 * 判据的规矩沿用同族：每条都把文档里的一**段原文**绑到一个**派生量**上（读 SQL / 读脚本 /
 * 读目录），而不是「某个词在文件里出现过」。派生量与文档必须来自不同的两边：文档里的数字改一个
 * 字面量不会让判据跟着改（那是我自己重写期望值的老毛病）。
 *
 * 分工（第三十五轮自己踩出来的一条）：断言数的**数值**对不对，归 `scripts/db-assertion-counts.mjs`
 * （`npm run check:db-assertion-counts`，它把文档引用的数字对回 `select plan(N)`），本文件不重复比数值；
 * 本文件比的是那份门禁**射程之外**的东西——数字挂在哪儿它才读得到（见「断言数怎么挂」一节），
 * 以及表数、档位集合、角色名单、旗子、指纹项这些它根本不看的事实。
 * 而「哪一片文本算现行」也只有一份口径：本文件 import 那边的 `AUDITED_DOCS` / `CURRENT_SECTIONS`
 * / `pickSections`，扫的就是它看得到的那片——两遍各立一份，早晚会一份说台账不算数、一份把它当错。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUDITED_DOCS, CURRENT_SECTIONS, pickSections } from "./db-assertion-counts.mjs";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const DOC = "docs/database-testing.md";
const doc = read(DOC);
const rls = read("supabase/tests/rls_isolation.sql");
const sync = read("supabase/tests/sync_and_constraints.sql");
const emb = read("supabase/tests/embedding_generations.sql");
const dbTest = read("scripts/db-test.mjs");
const drill = read("scripts/backup-drill.mjs");
const mig0008 = read("supabase/migrations/0008_goal_tier_constraints.sql");

/** 一个 pgTAP 文件自己声明的断言数。 */
const planOf = (sql) => Number(/select plan\((\d+)\);/.exec(sql)?.[1] ?? NaN);

/** 截取两段分区注释之间的文本（这份 SQL 用注释分节，缺标记就当派生失败）。 */
function section(src, startMarker, endMarker) {
  const i = src.indexOf(startMarker);
  if (i === -1) return null;
  const j = src.indexOf(endMarker, i + startMarker.length);
  return j === -1 ? null : src.slice(i, j);
}

/** 文档里 `xxx` 形式的反引号片段，按出现顺序。 */
const ticks = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/** 文档里以 `- ` 开头的那一条（可能折行），取到下一条列表项或空行为止。 */
function bulletWith(src, needle) {
  const at = src.indexOf(needle);
  if (at === -1) return null;
  const lines = src.slice(src.lastIndexOf("\n", at) + 1).split("\n");
  const out = [lines[0]];
  for (const l of lines.slice(1)) {
    if (l.trim() === "" || /^(?:- |\d+\. |#{2,} )/.test(l)) break;
    out.push(l);
  }
  return out.join(" ").replace(/\s+/g, " ");
}

/** A 那一节：写了哪几张表、每张读回几行。 */
function aSectionReadout() {
  const block = section(rls, "用户 A：以自己的身份写入各表自有行", "用户 B：看不到 A 的行");
  if (!block) return null;
  const writes = [...block.matchAll(/^insert into ([a-z_]+)/gm)].map((m) => m[1]);
  const reads = [...block.matchAll(/select is\(\(select count\(\*\) from ([a-z_]+)[^)]*\), (\d+)::bigint/g)].map(
    (m) => ({ table: m[1], want: Number(m[2]) }),
  );
  return { writes, reads };
}

/** 迁移建出来的全部 public 业务表。 */
function tablesFromMigrations() {
  const out = new Set();
  for (const f of fs.readdirSync(path.join(root, "supabase/migrations")).filter((x) => x.endsWith(".sql"))) {
    const sql = read(path.join("supabase/migrations", f));
    for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?"?([a-z_0-9]+)"?/gi)) {
      out.add(m[1].toLowerCase());
    }
  }
  return out;
}

/** 备份演练夹具里点名的业务表。 */
const drillTables = () =>
  [...section(drill, "const DATA_TABLES = [", "];")?.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);

/** 从容器里跑某个二进制的 argv 里取旗子（丢掉 -U / -d 和它们的值）。 */
function flagsOf(src, binary) {
  const out = [];
  for (const m of src.matchAll(new RegExp(`"${binary}",([\\s\\S]*?)\\]`, "g"))) {
    const tokens = [...m[1].matchAll(/"([^"]*)"/g)]
      .map((t) => t[1])
      .filter((t) => t.startsWith("-"))
      .filter((t) => t !== "-U" && t !== "-d")
      .filter((t) => !/^(--list|--use-list=(?!\/tmp\/trade-buty\.list))/.test(t));
    if (tokens.length) out.push(tokens);
  }
  return out;
}

/** `schemaFingerprint` 对比了哪几项。 */
const fingerprintKeys = () => {
  const body = /function schemaFingerprint\(container\) \{([\s\S]*?)\n\}/.exec(drill);
  return [...body[1].matchAll(/^\s{4}([a-zA-Z]+): q\(/gm)].map((m) => m[1]);
};

/** 0008 里 CHECK 允许的档位集合。 */
function legalTiers() {
  const out = {};
  for (const m of mig0008.matchAll(/check \((daily_goal_min|weekly_goal_min) in \(([\d,\s]+)\)/g)) {
    out[m[1]] = m[2].split(",").map((n) => Number(n.trim()));
  }
  return out;
}

describe("§1 rls_isolation：文档里的表数由 SQL 自己说", () => {
  it("A 写 9 张、读回 8 张 1 行、第 9 张读回 0 行，全与文档一致", () => {
    const ro = aSectionReadout();
    expect(ro, "rls_isolation.sql 里那节分区注释没了，A 的形状无从派生").not.toBeNull();
    expect(new Set(ro.writes).size, "A 写入的表数与「写了哪几张」不一致（有表被插了两次？）").toBe(ro.writes.length);

    const bullet = bulletWith(doc, "用户 A 以自己的身份向");
    expect(bullet, "§1 那条讲 A 写/读几张的列表项不在了").not.toBeNull();
    const citedWrites = Number(/\*\*(\d+)\*\* 张用户表各写一行/.exec(bullet)?.[1] ?? NaN);
    expect(citedWrites, "§1 没写 A 往几张表里插了行").toBeGreaterThan(0);
    expect(citedWrites, "§1 说的「几张表各写一行」≠ SQL 里 A 那一节的 insert 数").toBe(ro.writes.length);

    const ones = ro.reads.filter((r) => r.want === 1 && r.table !== "kb_embeddings").map((r) => r.table);
    const zeros = ro.reads.filter((r) => r.want === 0).map((r) => r.table);
    expect(zeros, "A 那一节里「读回 0 行」的那张表应当恰好一张").toHaveLength(1);
    const citedOnes = Number(/其中 \*\*(\d+)\*\* 张当场读回 1 行/.exec(bullet)?.[1] ?? NaN);
    expect(citedOnes, "§1 没说 A 读回几张").toBeGreaterThan(0);
    expect(citedOnes, "§1 说的读回张数 ≠ SQL 里判 1 行的用户表数").toBe(ones.length);
    const zeroLine = /第 \*\*(\d+)\*\* 张 `([a-z_]+)` 读回 \*\*0\*\* 行/.exec(bullet);
    expect(zeroLine, "§1 没点名那张「能写不能读」的表").not.toBeNull();
    expect(Number(zeroLine[1]), "§1 说它是第几张，得正好等于写入的张数").toBe(ro.writes.length);
    expect(zeroLine[2], "§1 点名的那张读回 0 行的表 ≠ SQL 里真的断言 0 行的表").toBe(zeros[0]);
    // 「能写 ≠ 能读」这句要靠策略本身：那张表在迁移里只有 for insert。
    const allMigrations = fs
      .readdirSync(path.join(root, "supabase/migrations"))
      .map((f) => read(path.join("supabase/migrations", f)))
      .join("\n");
    const policy = new RegExp(`create policy "[^"]+" on ${zeros[0]}\\s*\\n\\s*for (\\w+)`, "m").exec(allMigrations);
    expect(policy, `${zeros[0]} 的策略形状读不出来`).not.toBeNull();
    expect(policy[1], `§1 说它「只有 for insert 策略」，可迁移里它写着 for ${policy[1]}`).toBe("insert");
  });

  it("B 看不到的那 8 张，与 B 冒名被拒的 9 次，都是 SQL 数的", () => {
    const invisible = [...rls.matchAll(/'B 看不到 A 的 ([a-z_]+)'/g)].map((m) => m[1]);
    const bullet = bulletWith(doc, "用户 B 看不到 A 的");
    expect(bullet, "§1 那条「B 看不到」的清单不在了").not.toBeNull();
    expect(ticks(bullet), "文档点名的表与 SQL 里的「B 看不到 A 的」断言不是同一串").toEqual(invisible);

    const bBlock = section(rls, "用户 B：看不到 A 的行", "匿名：无 JWT claim");
    expect(bBlock, "B 那一节的分区注释没了，冒名写入的次数无从派生").not.toBeNull();
    const spoof = (bBlock.match(/select throws_ok\(/g) ?? []).length;
    const spoofBullet = bulletWith(doc, "B 冒用 A 的");
    expect(spoofBullet, "§1 那条「冒用写入被拒」的列表项不在了").not.toBeNull();
    const cited = Number(/被拒（(\d+) 张表逐个试）/.exec(spoofBullet)?.[1] ?? NaN);
    expect(cited, "§1 没写「几张表逐个试」").toBeGreaterThan(0);
    expect(cited, "§1 说的逐个试的张数 ≠ B 那一节里 throws_ok 的次数").toBe(spoof);
  });

  it("「影响行数为 0」这一半只测过文档点名的那 3 处", () => {
    const derived = [...rls.matchAll(/select is_empty\(\s*\$\$ (update|delete)(?: from)? ([a-z_]+)/g)].map(
      (m) => `${m[1]} ${m[2]}`,
    );
    const bullet = bulletWith(doc, "B 改/删 A 的行影响行数为 0");
    expect(bullet, "§1 那条「影响行数为 0」的句子不在了").not.toBeNull();
    const listed = ticks(bullet).filter((t) => /^(update|delete) [a-z_]+$/.test(t));
    expect(listed.length, "文档这一句的清单条数 ≠ SQL 里 is_empty 的处数").toBe(derived.length);
    expect(listed, "文档点名的操作与 SQL 里真的跑了 is_empty 的操作不是一串").toEqual(derived);
    const cited = Number(/实测过 (\d+) 处/.exec(bullet)?.[1] ?? NaN);
    expect(cited, "文档说的处数 ≠ SQL 里真的跑了 is_empty 的处数").toBe(derived.length);
  });
});

describe("§2 档位约束：合法集合由迁移决定，逐个值都得真跑", () => {
  const legal = legalTiers();

  it("文档写的合法集合就是 0008 的 CHECK 允许的集合", () => {
    expect(Object.keys(legal).sort(), "0008 里的 CHECK 形状变了（读不到两列的 in 列表）").toEqual(
      ["daily_goal_min", "weekly_goal_min"],
    );
    const cited = /合法集合 `([\d/]+)`（每日）与 `([\d/]+)`（每周）/.exec(doc);
    expect(cited, "§2 那条「合法集合」的写法变了，判据要跟着改").not.toBeNull();
    expect(
      cited[1].split("/").map(Number).sort((a, b) => a - b),
      "文档每日档位与 0008 的 CHECK 不等",
    ).toEqual([...legal.daily_goal_min].sort((a, b) => a - b));
    expect(
      cited[2].split("/").map(Number).sort((a, b) => a - b),
      "文档每周档位与 0008 的 CHECK 不等",
    ).toEqual([...legal.weekly_goal_min].sort((a, b) => a - b));
  });

  it("每个合法档位都真的有一条 lives_ok 跑过它，不是只写在文档里", () => {
    for (const [column, values] of Object.entries(legal)) {
      for (const v of values) {
        const re = new RegExp(`lives_ok\\(\\s*\\$\\$ update user_settings set ${column} = ${v}\\b`);
        expect(re.test(sync), `文档说 ${column}=${v} 合法并「逐个走一遍」，可 SQL 里没有这条 lives_ok`).toBe(true);
      }
    }
    const lives = (sync.match(/lives_ok\(\s*\$\$ update user_settings set (daily|weekly)_goal_min/g) ?? []).length;
    expect(lives, "lives_ok 的条数不等于两列合法档位的总数——要么漏了一个，要么多了一个").toBe(
      legal.daily_goal_min.length + legal.weekly_goal_min.length,
    );
  });

  it("文档点名的非法值既被 23514 拒掉，也确实不在合法集合里", () => {
    const cited = /非法值 `daily=(\d+)` 与 `weekly=(\d+)` 以 `23514` 被拒/.exec(doc);
    expect(cited, "§2 那条非法值的写法变了").not.toBeNull();
    const bad = { daily_goal_min: Number(cited[1]), weekly_goal_min: Number(cited[2]) };
    for (const [column, v] of Object.entries(bad)) {
      expect(legal[column].includes(v), `文档把 ${column}=${v} 说成非法，可 0008 的 CHECK 里它合法`).toBe(false);
      const re = new RegExp(
        `throws_ok\\(\\s*\\$\\$ update user_settings set ${column} = ${v}[\\s\\S]{0,160}?\\n  23514, NULL`,
      );
      expect(re.test(sync), `SQL 里没有「${column}=${v} 以 23514 被拒」这条断言`).toBe(true);
    }
    const kept = /被拒之后原值不变/.test(doc);
    const keptAssertion = /select is\(\s*\(select daily_goal_min from user_settings[^)]*\),\s*(\d+), '非法更新被拒绝后原值保持不变'/
      .exec(sync.replace(/\s+/g, " "));
    expect(keptAssertion, "SQL 里没有「被拒之后原值不变」这条断言").not.toBeNull();
    expect(keptAssertion[1], "SQL 里原值不变那条断言比对的值不是最后一个合法档位 30").toBe("30");
    expect(kept, "SQL 里有「被拒之后原值不变」这条，文档却没说").toBe(true);
  });
});

describe("运行方式与镜像：文档说的就是脚本做的", () => {
  it("校验的角色名单与文档点名的四个一致", () => {
    const inSql = /rolname in \(([^)]+)\)/.exec(dbTest);
    expect(inSql, "db-test.mjs 里那句角色存在性校验的写法变了").not.toBeNull();
    const roles = [...inSql[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    const cited = /先校验 (\d+) 个\n?Supabase 角色存在（([^）]+)）/.exec(doc.replace(/\n/g, "\n"));
    expect(cited, "文档那句「校验几个角色、是哪几个」的写法变了").not.toBeNull();
    expect(Number(cited[1]), "文档说的个数 ≠ 脚本 IN 列表里的角色数").toBe(roles.length);
    expect(
      ticks(cited[2]).sort(),
      "文档点名的角色与脚本实际校验的那几个不是同一串",
    ).toEqual(roles);
    expect(roles, "authenticator 不该被当成可缺省的角色（脚本按 4 个判）").toContain("authenticator");
  });

  it("默认镜像 tag 与文档里两处覆盖示例同一条", () => {
    const a = /const IMAGE =\s*process\.env\.DB_TEST_IMAGE \?\?\s*"([^"]+)"/.exec(dbTest);
    const b = /const IMAGE =\s*\n?\s*process\.env\.BACKUP_DRILL_IMAGE \?\?\s*\n?\s*process\.env\.DB_TEST_IMAGE \?\?\s*\n?\s*"([^"]+)"/.exec(
      drill,
    );
    expect(a, "db-test.mjs 的默认镜像读不出来").not.toBeNull();
    expect(b, "backup-drill.mjs 的默认镜像读不出来").not.toBeNull();
    expect(b[1], "两支门禁的默认镜像不是一条").toBe(a[1]);
    const cites = [...doc.matchAll(/supabase\/postgres:(\S+) npm run (db:test|backup:drill)/g)].map((m) => m[1]);
    expect(cites.length, "文档里那两条覆盖镜像的示例少了一条").toBe(2);
    for (const c of cites) expect(c, "文档示例里的镜像 tag 与脚本默认值不是一条").toBe(a[1].split(":")[1]);
  });

  it("迁移与测试都按文件名升序全量执行，条数也与文档一致", () => {
    expect(/const migrationFiles = fs\.readdirSync\(MIGRATIONS_DIR\)[\s\S]{0,80}?\.sort\(\);/.test(dbTest), "db-test.mjs 不再对迁移排序，文档的「按字典序」就不成立了").toBe(
      true,
    );
    expect(/const testFiles = fs\.readdirSync\(TESTS_DIR\)[\s\S]{0,80}?\.sort\(\);/.test(dbTest), "db-test.mjs 不再对测试文件排序，文档的「按文件名升序全部执行」就不成立了").toBe(
      true,
    );
    const n = fs.readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).length;
    const cited = Number(/应用全部迁移（(\d+) 个）/.exec(doc)?.[1] ?? NaN);
    expect(cited, "§4 没写迁移个数").toBeGreaterThan(0);
    expect(cited, "文档说的迁移个数 ≠ supabase/migrations 里的 .sql 数").toBe(n);
    const t = fs.readdirSync(path.join(root, "supabase/tests")).filter((f) => f.endsWith(".sql")).length;
    const citedT = Number(/重跑全部 (\d+) 个 pgTAP 文件/.exec(doc)?.[1] ?? NaN);
    expect(citedT, "§4 没写出重跑几个 pgTAP 文件").toBe(t);
    expect(citedT, "文档说的 pgTAP 文件个数 ≠ supabase/tests 里的 .sql 数").toBe(t);
  });
});

describe("§3 / §4：回滚演练做几支、备份恢复用什么旗子", () => {
  it("supabase/rollback 下的每一支都被 db-test.mjs 真的读了，文档 §3 也点了名", () => {
    const files = fs.readdirSync(path.join(root, "supabase/rollback")).filter((f) => f.endsWith(".sql")).sort();
    expect(files.length, "回滚脚本目录空了，这条判据就没东西可查了").toBeGreaterThan(0);
    const cited = Number(/`supabase\/rollback\/` 下有 (\d+) 个回滚脚本/.exec(doc)?.[1] ?? NaN);
    expect(cited, "§3 写的回滚脚本支数 ≠ supabase/rollback 里的 .sql 数").toBe(files.length);
    for (const f of files) {
      expect(dbTest.includes(`"rollback", "${f}"`) || dbTest.includes(`rollback", "${f}"`), `文档与 §3 说每支都跑，可 db-test.mjs 里没有读 ${f}`).toBe(
        true,
      );
      const num = /^(\d{4})_/.exec(f)[1];
      expect(doc.includes(`**${num} `) || doc.includes(`**${num}`), `§3 没给 ${f} 单独一节（编号 ${num} 没出现）`).toBe(
        true,
      );
    }
    expect(doc.includes("两支都跑"), "§3 那句「两支都跑」被改成了别的口径").toBe(true);
  });

  it("pg_dump / pg_restore 的旗子逐个对上，尤其是没有 --no-acl", () => {
    const dump = flagsOf(drill, "pg_dump").find((f) => f.includes("-Fc"));
    expect(dump, "backup-drill.mjs 里找不到带 -Fc 的 pg_dump 调用").toBeTruthy();
    const citedDump = /用 `pg_dump -U postgres -d postgres ([^`]+)` 生成/.exec(doc);
    expect(citedDump, "§4 第 2 步那条 pg_dump 命令的写法变了").not.toBeNull();
    expect(
      citedDump[1].trim().split(/\s+/),
      `文档写的 pg_dump 旗子 ≠ 脚本真正用的 ${dump.join(" ")}`,
    ).toEqual(dump);
    expect(dump.includes("--no-acl"), "脚本要是哪天加了 --no-acl，文档那句「没有 --no-acl」就得跟着改").toBe(false);
    expect(doc.includes("**注意没有 `--no-acl`**"), "文档没再把「ACL 在备份里」这件事说明白").toBe(true);

    const restore = flagsOf(drill, "pg_restore").find((f) => f.some((x) => x.startsWith("--use-list")));
    expect(restore, "backup-drill.mjs 里找不到带 --use-list 的 pg_restore 调用").toBeTruthy();
    const citedRestore = /`pg_restore -U postgres -d postgres ([^`]+)` 恢复/.exec(doc.replace(/\s*\n\s*/g, " "));
    expect(citedRestore, "§4 第 4 步那条 pg_restore 命令的写法变了").not.toBeNull();
    expect(
      citedRestore[1].trim().split(/\s+/),
      `文档写的 pg_restore 旗子 ≠ 脚本真正用的 ${restore.join(" ")}`,
    ).toEqual(restore);
    expect(restore).toContain("--single-transaction");
    expect(restore).toContain("--exit-on-error");
  });

  it("清单里滤掉的两行、指纹的九项，都由脚本说话", () => {
    // 取脚本里 includes() 的**字面量**（带两端空格），文档的反引号片段要逐字相同——
    // 「滤掉 DEFAULT ACL」和「滤掉 " DEFAULT ACL "」在 pg_restore 清单里不是一回事。
    const filtered = [...drill.matchAll(/!line\.includes\(("[A-Za-z -]+")\)/g)].map((m) => m[1].slice(1, -1));
    expect(filtered.length, "探测器在 backup-drill.mjs 里一条清单过滤项都没读到").toBeGreaterThan(0);
    const citedFilter = /滤掉镜像级的 ([^（]+)（/.exec(doc.replace(/\s*\n\s*/g, " "));
    expect(citedFilter, "§4 第 4 步那句「滤掉哪两类清单行」的写法变了").not.toBeNull();
    expect(ticks(citedFilter[1]), "文档点名的清单类别与脚本 filter 的不是同一串").toEqual(filtered);

    const keys = fingerprintKeys();
    expect(keys.length, "schemaFingerprint 的项数掉了，这条判据要跟着改").toBeGreaterThanOrEqual(9);
    const citedLine = bulletWith(doc, "逐表对比恢复前后的数据指纹");
    expect(citedLine, "§4 第 5 步那条指纹清单不在了").not.toBeNull();
    const cited = /`schemaFingerprint` 的 (\d+) 项：\s*([\s\S]*)$/.exec(citedLine);
    expect(cited, "§4 第 5 步那份指纹清单的写法变了").not.toBeNull();
    expect(Number(cited[1]), "文档说的项数 ≠ schemaFingerprint 真的数了几项").toBe(keys.length);
    expect(ticks(cited[2]), "文档逐项列出的指纹 ≠ schemaFingerprint 的键").toEqual(keys);
  });

  it("夹具覆盖的 11 张就是迁移建出来的全部业务表", () => {
    const created = [...tablesFromMigrations()].sort();
    const seeded = drillTables().sort();
    expect(created.length, "迁移里 create table 数掉了，这条集合比对没意义").toBeGreaterThanOrEqual(11);
    expect(seeded, "夹具点名的表数 ≠ 迁移建出来的表数").toHaveLength(created.length);
    expect(seeded, "夹具漏了迁移建的某张表（backup-drill.mjs 的注释「覆盖全部业务表」就成了假话）").toEqual(created);
    const cited = Number(/写入覆盖 (\d+) 张业务表/.exec(doc)?.[1] ?? NaN);
    expect(cited, "§4 说的覆盖几张表 ≠ 迁移建出来的表数").toBe(created.length);
    const kb = Number(/这 (\d+) 张就是迁移建出来的全部 `public` 业务表/.exec(doc)?.[1] ?? NaN);
    expect(kb, "§4 第 1 步那句自证数量的写法变了").toBe(created.length);
  });
});

describe("断言数怎么挂：数字不在文件名后面、也不在聚合链里，对账门禁就看不见它", () => {
  /** supabase/tests 里真实存在的 pgTAP 文件（去后缀）。 */
  const names = fs
    .readdirSync(path.join(root, "supabase/tests"))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""))
    .sort();

  /**
   * 一行文档里的每一处「N 条断言」挂在哪：
   *  - `named`：同一行里，它前面最近的一处就是某个 pgTAP 文件名，中间没有别的数字——
   *    `check:db-assertion-counts` 取的正是「文件名后的第一个数字」，所以这一处它在场；
   *  - `chain`：它是 `44+34+8 断言` 这条聚合链的末项——那是那条门禁的第二种写法；
   *  - `bare`：两处都不是。第三十五轮之前的 roadmap Q2.8 行「RLS 越权 40 断言 + 双设备同步/约束
   *    30 断言」就是这种：数字与文件名中间隔着中文别名，那条门禁的两种写法都读不到它，
   *    于是它错到 44/34 也没人喊——这条判据钉的是「形态」，数值对错仍归那条门禁。
   */
  function citationsIn(line) {
    const out = [];
    for (const m of line.matchAll(/(\d{1,3})\s*条?断言/g) ?? []) {
      const before = line.slice(0, m.index);
      const chain = /((?:\d{1,3}\s*\+\s*)+)$/.exec(before);
      if (chain) {
        out.push({ n: Number(m[1]), kind: "chain", terms: (chain[1].match(/\d{1,3}/g) ?? []).length + 1 });
        continue;
      }
      const owners = names.map((nm) => before.lastIndexOf(nm));
      const i = Math.max(...owners);
      if (i < 0) {
        out.push({ n: Number(m[1]), kind: "bare", why: "这一行没有任何 pgTAP 文件名" });
        continue;
      }
      const owner = names[owners.indexOf(i)];
      const gap = before.slice(i + owner.length);
      out.push(
        /\d/.test(gap)
          ? { n: Number(m[1]), kind: "bare", why: `${owner} 与这个数字之间还夹着别的数字` }
          : { n: Number(m[1]), kind: "named", owner },
      );
    }
    return out;
  }

  /**
   * 按「一条列表项 / 一个标题 / 一段正文」切块：换行折下来的续行属于同一块（§4 第 6 步的
   * 断言数就折在它下一行），而 roadmap 那种挨着排的 `- [x]` 历史行各自是一块——按整段空白
   * 切会把 Lighthouse 的「6/6 断言」也卷进 pgTAP 的射程。
   */
  function units(text) {
    const out = [];
    let cur = null;
    for (const line of text.split("\n")) {
      if (line.trim() === "" || /^(?:- |\d+\. |#{2,} |> )/.test(line)) {
        if (cur) out.push(cur.join("\n"));
        cur = line.trim() === "" ? null : [line];
      } else if (cur) cur.push(line);
    }
    if (cur) out.push(cur.join("\n"));
    return out;
  }

  /**
   * 只扫**对账门禁自己看得到的那片文本**：范围由 `db-assertion-counts.mjs` 的
   * `AUDITED_DOCS` / `CURRENT_SECTIONS` 决定，这里 import 同一份，不另立一份口径。
   * 第三十五轮 R16.268 那行台账就是撞在这一点上——它把被改掉的旧数字原文引回来作证据，
   * 无论哪道门禁按整篇扫都会把一句真话报成错。
   */
  const auditedText = (file) => {
    const raw = read(file);
    const re = CURRENT_SECTIONS[file];
    return re ? pickSections(raw, re) : raw;
  };

  /** 现行文档里「报了 pgTAP 断言数」的那些块。 */
  function countBlocks(rel) {
    return units(auditedText(rel)).filter(
      (u) => /pgTAP|db:test|backup:drill|supabase\/tests/.test(u) && /\d{1,3}\s*条?断言/.test(u),
    );
  }

  it("两篇现行文档里每一处断言数都挂在文件名或聚合链上", () => {
    expect(names.length, "supabase/tests 里的 pgTAP 文件不到 3 个，这条判据的分母先塌了").toBeGreaterThanOrEqual(3);
    for (const n of names) {
      expect(Number.isFinite(planOf(read(`supabase/tests/${n}.sql`))), `${n}.sql 没有可读的 select plan(N)，对账门禁拿它没办法`).toBe(
        true,
      );
    }
    const scanned = AUDITED_DOCS.map((f) => [f, countBlocks(f)]);
    const total = scanned.reduce((a, [, ls]) => a + ls.length, 0);
    expect(total, "两处「报了断言数」的块加起来不到 3 块，这条判据已经无物可查").toBeGreaterThanOrEqual(3);
    for (const [file, blocks] of scanned) {
      expect(blocks.length, `${file} 在节选之后一块「报了断言数」的都没有——这一半等于没扫，不是没有不符`).toBeGreaterThanOrEqual(
        1,
      );
      for (const block of blocks) {
        for (const c of citationsIn(block)) {
          if (c.kind === "chain") {
            expect(
              c.terms,
              `${file} 的聚合断言链只列了 ${c.terms} 项，而 supabase/tests 有 ${names.length} 个文件——少列的那个没人对账`,
            ).toBe(names.length);
          } else if (c.kind === "bare") {
            expect(`${file}: ${c.why}`, `「${c.n} 断言」写成了对账门禁读不到的形态：${c.why}`).toBe("");
          }
        }
      }
    }
  });

  it("探测器自己：旧的写法判红，改坏数字不判红（那是另一道门禁的活）", () => {
    expect(
      citationsIn("跑通 RLS 越权 40 断言 + 双设备同步/约束 30 断言 + 回滚演练").map((c) => c.kind),
      "对账门禁读不到的那种写法，这条判据必须认出来",
    ).toEqual(["bare", "bare"]);
    const chain = citationsIn("重跑 pgTAP(44+34+8 断言)");
    expect(chain.map((c) => c.kind), "合法的聚合写法被判红了").toEqual(["chain"]);
    expect(chain[0].terms, "聚合链的项数读错了").toBe(3);
    expect(
      citationsIn("少列一项的聚合写法 pgTAP(44+34 断言)").map((c) => `${c.kind}:${c.terms}`),
      "少列一个文件的聚合链必须读成 2 项",
    ).toEqual(["chain:2"]);
    // 数值被改坏：形态仍然合法，这条判据不许伸手（对账由 check:db-assertion-counts 负责）
    expect(
      citationsIn("`rls_isolation.sql`（41 条断言）与 `embedding_generations.sql`（99 条断言）").map((c) => c.kind),
      "改坏数字就让这条判据红，两道门禁就重叠了",
    ).toEqual(["named", "named"]);
    expect(
      citationsIn("`sync_and_constraints.sql`（跨用户隔离，中间夹了 1 个别的数字，34 条断言）").map((c) => c.kind),
      "文件名与断言数之间夹了别的数字，对账门禁取到的就是那个错数",
    ).toEqual(["bare"]);
  });
});

describe("备份字节数是运行时读数，不是仓库的属性", () => {
  /** `backup-drill.mjs` 对 dump 体积唯一的那道判据。 */
  const dumpFloor = () => Number(/dump\.stdout\.length < (\d+)/.exec(drill)?.[1] ?? NaN);

  it("Q5.4 不许把某一次运行的字节数写成 `pg_dump` 的说明", () => {
    const row = pickSections(read("docs/roadmap.md"), CURRENT_SECTIONS["docs/roadmap.md"])
      .split("\n")
      .find((l) => l.includes("backup:drill"));
    expect(row, "roadmap 的 Q5.4 行不在现行节里了，这条判据无从可查").toBeTruthy();
    // 旧写法是 `pg_dump -Fc`(45,104 bytes，随语料增长)——把一次运行的读数当成工件属性。
    expect(
      /pg_dump[^）)]{0,12}[(（]\s*[\d,]{3,}\s*bytes/.test(row),
      "文档又写死了一个精确字节数：同一份代码在本地读到 45,104、CI 读到 45,105，这个数不属于仓库",
    ).toBe(false);
    expect(row.includes("字节数每次由脚本自己打印"), "文档没再说明这个数是运行时打印的").toBe(true);
    const cited = Number(/(\d+) 字节下限/.exec(row)?.[1] ?? NaN);
    expect(Number.isFinite(cited), "Q5.4 没写出脚本对备份体积的那道判据").toBe(true);
    expect(dumpFloor(), "探测器在 backup-drill.mjs 里读不到 dump 体积下限").toBeGreaterThan(0);
    expect(cited, "文档写的字节下限 ≠ backup-drill.mjs 真正判的那个数").toBe(dumpFloor());
  });

  it("两处读数都留着，各自标明是谁读到的", () => {
    const row = pickSections(read("docs/roadmap.md"), CURRENT_SECTIONS["docs/roadmap.md"])
      .split("\n")
      .find((l) => l.includes("backup:drill"));
    const nums = [...new Set([...row.matchAll(/\b(\d{2,3},\d{3})\b/g)].map((m) => m[1]))];
    expect(nums, "文档里的备份字节读数不再是两个不同的值——那正是「它随机器而变」的证据").toEqual(["45,104", "45,105"]);
    expect(/本地读到 45,104/.test(row), "第一个读数没标明是谁读到的").toBe(true);
    expect(/CI 读到 45,105/.test(row), "第二个读数没标明是谁读到的").toBe(true);
  });
});

describe("pgTAP 写法约定与探测器自检", () => {
  it("每条 throws_ok 都是显式 4 参数（SQLSTATE + NULL + 描述）", () => {
    for (const [name, sql] of [["rls_isolation", rls], ["sync_and_constraints", sync], ["embedding_generations", emb]]) {
      const calls = (sql.match(/select throws_ok\(/g) ?? []).length;
      const shaped = (
        sql.match(/throws_ok\(\s*\$\$[\s\S]*?\$\$,\s*(?:\d{5}|'[A-Za-z0-9]{5}'),\s*NULL,\s*'[^']*'\)/g) ?? []
      ).length;
      if (calls) {
        expect(shaped, `${name}.sql 里有 ${calls} 条 throws_ok，但只有 ${shaped} 条是文档说的 4 参数形状`).toBe(calls);
      }
    }
    expect(doc.includes("显式的 4 参数形式"), "「4 参数形式」这句约定被删了，上面那条判据的口径就没出处了").toBe(true);
  });

  it("探测器自己抓得住一处漂移（正向对照），也不放过空的派生", () => {
    expect(planOf("select plan(7);"), "planOf 解析器连 7 都读不出来").toBe(7);
    expect(planOf("-- 没有 plan"), "planOf 在缺 plan 的文件上应当报 NaN 而不是 0").toBeNaN();
    expect(section(rls, "不存在的标记", "另一个"), "section 找不到起点时必须给 null").toBeNull();
    expect(section(rls, "用户 A：以自己的身份写入各表自有行", "不存在的结束标记"), "section 找不到结束点时必须给 null").toBeNull();
    expect(tablesFromMigrations().has("progress"), "迁移解析器连最核心的一张表都没读到").toBe(true);
    expect(fingerprintKeys().length, "指纹解析器一条都没读到").toBeGreaterThan(0);
  });
});
