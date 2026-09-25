/**
 * 注释里点名的存储键，必须是那个键真正的主人写出来的。
 *
 * 两条已修的事实错误（R16.228、R16.229）：
 * 1. `activity-calendar.ts` 的头写「数据来源：progress 的 at 时间? progress 没记时间。
 *    用阅读时长记录补充」——`progress` 记着时间（`tb-progress-completions` 每项带 `at`），
 *    而 `tb-reading-time` 从头到尾只被 `reading-time.ts` 读写，一分钱都没补进活动日历。
 * 2. `privacy-export.ts` 的头写「不包含 Supabase 服务端数据、用户邮箱或登录会话」——
 *    它唯一的剔除者是 `/^sb-/` 那一族会话键，用户在站内填的订阅邮箱 `tb-newsletter-email`
 *    作为本机数据原样导出；`docs/growth-copy-policy.md` 第 4 条写的本来就是「可导出」。
 *
 * 判据不抄字面量：键名从各模块自己的常量声明里抠出来，注释必须点名同一个字符串。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

/** 从一个模块里抠出它声明的 localStorage 键常量（`const X = "tb-…"`） */
function keysOwnedBy(rel: string): string[] {
  return [...read(rel).matchAll(/const \w+\s*=\s*"(tb-[^"]+)"/g)].map((m) => m[1]);
}

/** 文件顶部的块注释（第一个 `/** … *\/`） */
function headerComment(rel: string): string {
  const m = read(rel).match(/\/\*\*[\s\S]*?\*\//);
  expect(m, `${rel} 找不到头部块注释`).not.toBeNull();
  return m![0];
}

/** 假话的形状：把「另一个模块的键」说成自己的数据来源，却不点名那是谁的 */
const NOT_SOURCE_CLAIM = /没记时间|用阅读时长.{0,6}补充/;

describe("活动日历的注释说清谁写它、谁不写它", () => {
  const header = headerComment("src/lib/activity-calendar.ts");

  it("三个模块各自 owned 的键都取到了（取不到就是判据在空转）", () => {
    expect(keysOwnedBy("src/lib/activity-calendar.ts")).toContain("tb-activity");
    expect(keysOwnedBy("src/lib/progress.ts"), "progress.ts 声明不出键常量").toContain(
      "tb-progress-completions",
    );
    expect(keysOwnedBy("src/lib/reading-time.ts"), "reading-time.ts 声明不出键常量").toContain(
      "tb-reading-time",
    );
  });

  it("注释点名了那两份不归它管的存储，也认了唯一的写入者", () => {
    expect(header).toContain("tb-activity");
    expect(header, "注释没交代完成时间戳那份存储").toContain("tb-progress-completions");
    expect(header, "注释没把阅读时长那份排除掉").toContain("tb-reading-time");
    expect(header).toMatch(/recordActivity\(\)/);
    expect(header).toMatch(/touchStreak/);
  });

  it("写入者链条真的成立：touchStreak 里就调着 recordActivity", () => {
    expect(read("src/lib/streak.ts")).toMatch(/recordActivity\(\);/);
  });

  it("旧注释那句被抓得住（对照）", () => {
    const legacy =
      "/** 数据来源：progress 的 at 时间? progress 没记时间。用阅读时长记录补充。 */";
    expect(NOT_SOURCE_CLAIM.test(legacy), "禁令抓不住旧注释").toBe(true);
    expect(NOT_SOURCE_CLAIM.test(header), "注释还在说假话").toBe(false);
  });
});

describe("隐私导出的注释不再替「不含邮箱」作保", () => {
  const header = headerComment("src/lib/privacy-export.ts");

  it("订阅邮箱那个键确实归 newsletter.ts，注释点的就是它", () => {
    expect(keysOwnedBy("src/lib/newsletter.ts")).toContain("tb-newsletter-email");
    expect(header, "注释没交代本机订阅邮箱会一起出去").toContain("tb-newsletter-email");
  });

  it("导出唯一的剔除者确实是 sb- 那一族", () => {
    const filter = read("src/lib/privacy-export.ts").match(
      /const SESSION_STORAGE_KEY\s*=\s*(\/[^/\n]+\/)/,
    );
    expect(filter, "找不到导出时那条跳过规则").not.toBeNull();
    expect(filter![1]).toBe("/^sb-/");
  });

  it("旧那句被抓得住（对照）", () => {
    const legacy = " - 不包含 Supabase 服务端数据、用户邮箱或登录会话（`sb-*` 令牌）";
    expect(/不包含[^。]*邮箱/.test(legacy), "禁令抓不住旧注释").toBe(true);
    expect(/不包含[^。]*邮箱/.test(header), "注释还在替「不含邮箱」作保").toBe(false);
  });
});
