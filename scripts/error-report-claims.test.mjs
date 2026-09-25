/**
 * R16.265：`docs/error-reporting.md` §服务端校验 那一格把「方法」和「媒体类型」合并成一条，
 * 并给两者同一个状态码：「仅 `POST` + `Content-Type: application/json`，否则 `415`」。
 *
 * 2026-09-26 拿本地生产构建（`BUILD_ID PTbPuR9QgU_6gmtvSYefd`，`next start -p 3155`）逐条量过：
 * `GET` / `PUT`（带 json）/ `DELETE` → **405**（响应体空、无 `Allow` 头），
 * `POST` + `text/plain` 或干脆没有 Content-Type → **415**，`POST` + json → **202**。
 * 所以 415 只属于媒体类型那一半；而 405 出自 Next 的路由层——`route.ts` 只有一个方法导出、
 * 源码里没有任何 405 分支，单元测试直接调导出的 `POST()` 也走不到那条路径，因此方法那一半
 * **没有**自动化断言可钉，文档必须自己说清这一点。次序同样是读不出来的：限流判在
 * `route.ts:69`、媒体类型判在 `:77`，配额耗尽时坏 Content-Type 先拿到 429。
 *
 * 本文件不起重启服务器（CI 里那样做只会把裁决权交给端口），钉的是「文档的说法与源码的形状
 * 对得上」这一类可静态推导的事实；实测数字写在文档里并标明日期，判据钉的是它的**归属**。
 * 规矩沿用前几轮：数字现读、每把尺子指向它的持有者、被证伪的旧拼写不许用反引号出现在文档里。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const doc = read("docs/error-reporting.md");
const route = read("src/app/api/error-reports/route.ts");
const client = read("src/lib/error-report.ts");

const section = (from, to) => {
  const a = doc.indexOf(from);
  expect(a, `文档里找不到「${from}」`).toBeGreaterThan(-1);
  const b = to ? doc.indexOf(to, a) : -1;
  return doc.slice(a, b === -1 ? undefined : b);
};
/** 折行会让中文正文里的同一句话跨行，比对前先压平 */
const flat = (s) => s.replace(/\n+/g, "").replace(/\s+/g, " ");
/** `file.ts:12` 或 `file.ts:12-13` → 该区间内的源码 */
const lines = (rel, from, to) =>
  read(rel)
    .split("\n")
    .slice(from - 1, to ?? from)
    .join("\n");

describe("源码形状：405 归框架、415 归这段代码", () => {
  it("route.ts 只有一个方法导出，且它是 POST", () => {
    const handlers = [...route.matchAll(/^export (?:async )?function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/gm)].map(
      (m) => m[1],
    );
    expect(handlers, "方法导出不止一个，§「方法」那句要重看").toEqual(["POST"]);
  });

  it("route.ts 里没有 405 分支——所以方法那一半不可能有代码级断言", () => {
    expect(route, "这段代码开始自己答 405 了，文档那句『由 Next 的路由层挡下』要重看").not.toMatch(/\b405\b/);
    expect(route).toContain('{ status: 415 }');
    expect(route).toContain('{ status: 429');
    expect(route).toContain('{ status: 413 }');
    expect(route).toContain("{ status: 202");
  });

  it("限流判在媒体类型之前，所以超限时坏 Content-Type 也先拿到 429", () => {
    const limit = route.indexOf("errorReportLimiter.check(");
    const media = route.indexOf('"Unsupported media type"');
    expect(limit).toBeGreaterThan(-1);
    expect(media).toBeGreaterThan(-1);
    expect(limit, "媒体类型判定挪到了限流之前，文档那句次序要重看").toBeLessThan(media);
  });

  it("415 的判据就是 Content-Type 里有没有 application/json", () => {
    expect(route, "媒体类型判定换了写法，文档与用例都要重看").toMatch(
      /if \(!req\.headers\.get\("content-type"\)\?\.includes\("application\/json"\)\) \{/,
    );
  });
});

describe("文档说法：一格拆成两条，各自的状态码与归属", () => {
  const t = () => flat(section("## 服务端校验", "## 传输策略"));

  it("不再把方法与媒体类型混成一条、共担一个 415", () => {
    expect(t(), "又回到『方法 / 媒体类型』合并的写法").not.toContain("方法 / 媒体类型");
    expect(t(), "又给『否则』配了个 415（方法不对其实是 405）").not.toMatch(/否则\s*415/);
  });

  it("两个码都出现，且 405 的归属写清是路由层", () => {
    expect(t(), "方法那一半没了").toContain("405");
    expect(t(), "媒体类型那一半没了").toContain("415");
    expect(t(), "405 没交代是谁答的（不是这段代码）").toMatch(/其余方法由 Next\s*的路由层挡下/);
    expect(t(), "405 是否带 Allow 没交代，读者会按 HTTP 教科书预期").toContain("Allow");
  });

  it("交代了方法那一半没有自动化断言", () => {
    expect(t(), "又暗示方法分支有用例覆盖").not.toMatch(/方法[^。]*用例会?覆盖/);
    expect(t(), "没说明这一半只有实测、没有断言").toContain("没有自动化断言");
  });

  it("媒体类型那条点名了真正覆盖它的用例", () => {
    expect(t(), "415 不再引用 route.test.ts 里那条用例").toMatch(/route\.test\.ts:\d+/);
  });
});

/** 文档里引用的 `route.ts:A` / `route.ts:A-B` 行号（含带目录前缀的写法） */
const routeCites = () =>
  [...section("## 服务端校验", "## 传输策略").matchAll(/route\.ts:(\d+)(?:-(\d+))?/g)].map(
    (m) => [Number(m[1]), m[2] ? Number(m[2]) : undefined],
  );

describe("被引用的行号与数字，指向的必须是现在的那一行、那把尺子", () => {
  it("三处行号各就各位：导出、限流、媒体类型", () => {
    const doc2 = section("## 服务端校验", "## 传输策略");
    expect(flat(doc2), "『只导出 POST』不再引用 route.ts:68").toContain("`src/app/api/error-reports/route.ts:68`");
    expect(flat(doc2), "限流与媒体类型的先后不再引用两个行号").toContain("route.ts:69");
    expect(flat(doc2), "415 不再引用 route.ts:77-78").toContain("route.ts:77-78");
    expect(lines("src/app/api/error-reports/route.ts", 68), "route.ts:68 已经不是那个方法导出了").toContain(
      "export async function POST",
    );
    expect(lines("src/app/api/error-reports/route.ts", 69), "route.ts:69 已经不是限流判定了").toContain(
      "errorReportLimiter.check(",
    );
    const mediaLines = lines("src/app/api/error-reports/route.ts", 77, 78);
    expect(mediaLines, "route.ts:77-78 已经不是媒体类型分支了").toContain("Unsupported media type");
    expect(mediaLines).toContain("{ status: 415 }");
  });

  it("引用的行号没有一个跑到文件外面", () => {
    const cites = routeCites();
    expect(cites.length, "§服务端校验 一条源码行号都不引用了，判据要跟着改").toBeGreaterThanOrEqual(3);
    for (const [a, b] of cites) {
      expect(lines("src/app/api/error-reports/route.ts", a, b), `route.ts:${a}-${b ?? a} 落在文件外`).not.toBe("");
    }
  });

  it("文档引用的 route.test.ts 行号就是那条 415 用例", () => {
    const cite = /route\.test\.ts:(\d+)/.exec(section("## 服务端校验", "## 传输策略"));
    expect(cite, "§服务端校验 不再引用用例行号").toBeTruthy();
    const at = lines("src/app/api/error-reports/route.test.ts", Number(cite[1]));
    expect(at, `route.test.ts:${cite[1]} 已经不是那条媒体类型用例了（文档说它证 415）`).toContain(
      "非 application/json 返回 415",
    );
  });

  it("body 上限与限流参数各归其主，数字对得上", () => {
    const t = flat(section("## 服务端校验", "## 传输策略"));
    const cap = /MAX_ERROR_REPORT_BYTES = (\d[\d_]*)/.exec(t);
    expect(cap, "文档不再写 body 上限的数值").toBeTruthy();
    const codeCap = /MAX_ERROR_REPORT_BYTES = ([\d_]+)/.exec(client);
    expect(codeCap, "`src/lib/error-report.ts` 里的常量写法变了，判据要跟着改").toBeTruthy();
    expect(Number(cap[1].replace(/_/g, "")), "文档的 body 上限与 `src/lib/error-report.ts` 的常量不一致").toBe(
      Number(codeCap[1].replace(/_/g, "")),
    );
    expect(route, "限流不再由 route.ts 的两个常量决定，文档那句『每 IP 每分钟 100 次』要重看").toMatch(
      /PER_MINUTE_LIMIT = 100/,
    );
    expect(route).toMatch(/WINDOW_MS = 60_000/);
    expect(t, "文档不再写每分钟配额").toContain("每分钟 100 次");
  });
});
