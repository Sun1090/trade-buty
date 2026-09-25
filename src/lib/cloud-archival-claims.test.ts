/**
 * 「已经存到云上」这句话只有一个判据。
 *
 * R16.59 把首页那枚 ☁ 与统计页的数据来源标签从「登录了」收成「登录了且没有待传的写」，
 * 但那时「待传的写」= 队列长度。R16.139 查出来队列不够：`trimQueue` 超过 `MAX_QUEUE`
 * 时丢的正是**还没上传成功**的条目，剩下的传完后队列归零，两个界面就会重新宣称
 * 「已云端存档，换设备不丢」/「本机 + 云端」。判据因此上收到 `getUnarchivedWriteCount()`
 * （队列里等传的 + 被挤掉的），这里钉的是「没有第二把尺子」。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDict } from "./i18n";
import { STATS_DICTS } from "./i18n-stats";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

/** 会印出「已云端存档 / 本机 + 云端」这类完成时说法的两处界面 */
const CLAIMING_SURFACES = [
  "src/components/global-read-stat.tsx",
  "src/components/stats-client.tsx",
];

describe("「已云端存档」的判据只有一个 owner", () => {
  it("两处界面都用同一个函数，谁都不许退回队列长度", () => {
    expect(CLAIMING_SURFACES.length, "扫描面缩水就等于门禁没在管事了").toBe(2);
    for (const rel of CLAIMING_SURFACES) {
      const source = read(rel);
      expect(source, `${rel} 没在问「还有几条没到云上」`).toContain("getUnarchivedWriteCount");
      expect(source, `${rel} 又拿队列长度当判据：被上限挤掉的那些不在队列里`).not.toMatch(/\bgetQueueLength\b/);
    }
  });

  it("判据函数自己把两笔账都算进去", () => {
    const store = read("src/lib/sync-queue-store.ts");
    const body = /export function getUnarchivedWriteCount\(\)[\s\S]*?\n}/.exec(store)?.[0] ?? "";
    expect(body, "找不到判据函数本体").not.toBe("");
    expect(body).toContain("getQueueLength()");
    expect(body).toContain("getDroppedWrites()");
  });

  it("被挤掉的写入有账可查，且账随队列一起清", () => {
    const store = read("src/lib/sync-queue-store.ts");
    expect(store).toContain("tb-sync-queue-dropped");
    // 换账号 / 注销时把上一个账号欠的账留在那儿，会把新账号的标记一直压着
    const wipeCount = (store.match(/removeItem\(QUEUE_DROPPED_KEY\)/g) ?? []).length;
    expect(wipeCount, "队列的两个清理入口都得清这本账").toBe(2);
  });

  it("说这句「已云端存档」的文案确实存在，扫描不是对着空气立规矩", () => {
    expect(getDict("zh").home.syncedLabel).toMatch(/云端存档/);
    expect(STATS_DICTS.zh.sourceCloud).toBe("本机 + 云端");
    expect(STATS_DICTS.en.sourceCloudPending).toMatch(/awaiting upload/i);
  });

  // R16.210：「换设备不丢」这句话站里已经判过要有条件（上面两条），而登录页那句是无条件的：
  // 站在那里的人还没登录，拿不到 `getUnarchivedWriteCount()`，偏偏游客态离线攒写入的人最容易
  // 撞上「队列满 200 条挤掉最旧那条」。它许诺的那件东西，这一屏根本没有判据可言。
  it("「换设备不丢」只在拿得到未上传计数的界面上说", () => {
    // 正面：☁ 那枚徽标确实还在说这句话（它有判据），禁令不是对着空气立规矩
    expect(getDict("zh").home.syncedLabel).toMatch(/换设备不丢/);
    expect(getDict("en").home.syncedLabel).toMatch(/cloud/i);

    for (const locale of ["zh", "en"] as const) {
      expect(
        getDict(locale).auth.subtitle,
        `${locale}：登录页在拿不到判据的地方许诺「不丢」`,
      ).not.toMatch(/不丢|never lose/i);
    }

    // 正向对照：退役的那两句喂给同一个禁令，必须条条报红
    const legacy = [
      "输入邮箱，我们发送登录链接。登录后进度自动云端存档，换设备不丢。",
      "Enter your email and we'll send a login link. Your progress syncs to the cloud after login — never lose it across devices.",
    ];
    const missed = legacy.filter((s) => !/不丢|never lose/i.test(s));
    expect(missed, `这些旧写法没被抓到：${missed.join(" / ")}`).toEqual([]);
  });
});
