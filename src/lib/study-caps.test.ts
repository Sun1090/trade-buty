/**
 * R16.320：时长防呆的上限有四个夹点、两类语义，而那句「与 study-time 防呆一致」没有主人。
 *
 * 病灶不是笔误，是三处实测：
 * 1. `study-time.ts` 里同一个上限被夹**两次**（累加处、`readLedger` 读旧台账时）。
 *    两道闸互为备份，所以任何一道单独失效都不可观察——把任一处改成 `12 * 3600`，
 *    当时本模块 12 条用例全绿（R16.320 修复前；条数会随用例增删变，别当现状读）。
 * 2. `replay-trainer.tsx` 存档前自己夹一次，`replay-time-trend.ts` 聚合时再夹一次，
 *    后者的注释写着「与 study-time 防呆一致」。把 trainer 那处改成 `12 * 3600`，
 *    那四个相关文件（trainer / trend / duration-claims / study-time）**当时 71 条全绿**。
 * 3. 全仓没有任何测试断言过这两个上限之间的关系。
 *
 * R16.322 把同一族病再挖一层，量出**两处新的**：
 * 4. `quiz.tsx` 交卷时行内夹一个 `4 * 3600`，而 `study-time.ts` 的注释**明写**
 *    「单次调用没有上限……旧注释里的『单次 ≤4h』在代码里不存在」。那句订正本身是错的：
 *    它只翻了 `study-time.ts` 一个文件，没看调用点。实测把它改成 `12 * 3600`，
 *    只有 `quiz.test.tsx` 那一条红（它钉的是数值，不是「这个数有主人」）。
 * 5. 「1 题记 1 分钟」这条政策长在两处（`review-client.tsx` 与 `ai-quiz.tsx`），
 *    都写 `addStudyTime("quiz", 60)`。实测把 `ai-quiz.tsx` 那处改成 120，
 *    **该文件当时全部照绿**——复习页那两处有 `review-client.test.tsx` 钉着，AI 变体题那一处零覆盖。
 *
 * 于是 `study-caps.ts` 现在有四个名字：`DAILY_SOURCE_CAP_SEC` / `REPLAY_ROUND_CAP_SEC` /
 * `QUIZ_SESSION_CAP_SEC` / `REVIEW_CREDIT_SEC`。最后一个是**计价**不是夹子，
 * 而且与 `weekly-summary.ts` 的 `ACTIVE_DAY_MIN_SECONDS`（都是 60）不是一件事。
 *
 * **要紧的不是两个数相等，而是单轮 ≤ 当日每源**。一旦超过，同一轮回放会在
 * `/stats` 同一张页面上说两个数：「回放时长」那块读记录里的 `durationSec`
 * （只被单轮闸夹），「总学习时长」读台账（还要被当日闸夹一次）。
 * 所以下面第一条是**行为**判据——把同一笔超限值分别喂给两个聚合器，要求它们
 * 给出同一个数；它不是「比两个常数」的恒等式（探针 M2 证明：单轮闸改大它就红）。
 *
 * 运行：`npx vitest run src/lib/study-caps.test.ts`（跟随 `npm test`）
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { stripComments } from "../../scripts/error-report-privacy.mjs";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal("window", { dispatchEvent: () => {} });

const { DAILY_SOURCE_CAP_SEC, REPLAY_ROUND_CAP_SEC } = await import("./study-caps");
const { addStudyTime, getStudySeconds } = await import("./study-time");
const { buildReplayTimeTrend } = await import("./replay-time-trend");

beforeEach(() => store.clear());

describe("时长防呆的上限只有一个主人", () => {
  /**
   * 行为侧：一轮做到「单轮上限」那么长时，回放时长那块与学习台账必须报同一个数。
   * 这条判据的靶子是**两个上限的关系**，不是它们的值：把单轮上限调到高于当日上限，
   * 同一轮在两条路上就会给出两个数，这条当场红。
   */
  it("做满一单轮上限的回放，两张卡报同一个秒数", () => {
    const day = "2026-09-05";
    const at = new Date(2026, 8, 5, 12).getTime();
    // trainer 存档那一步等价：elapsed 已被单轮闸夹过
    const elapsed = Math.min(99 * 3600, REPLAY_ROUND_CAP_SEC);
    addStudyTime("replay", elapsed, day);
    const trend = buildReplayTimeTrend({
      history: [{ at, symbol: "BTCUSDT", interval: "1h", total: 5, correct: 4, durationSec: elapsed }],
      days: 7,
      // 聚合器收的是本地日历日字符串（不是 Date），传错形状会被静默忽略、
      // 退化成「以墙钟今天为准」，那条用例就会随运行日期飘。
      today: day,
    });

    expect(trend.allTime.totalDurationSec, "回放时长那块没按单轮上限夹").toBe(elapsed);
    expect(
      getStudySeconds(day).replay,
      `同一轮回放在两张卡上说了两个数：回放时长 ${elapsed}s vs 学习台账 ${getStudySeconds(day).replay}s（单轮上限 ${REPLAY_ROUND_CAP_SEC} 超过了当日上限 ${DAILY_SOURCE_CAP_SEC}）`,
    ).toBe(trend.allTime.totalDurationSec);
  });

  it("两个上限的关系：单轮不大于当日每源", () => {
    expect(
      REPLAY_ROUND_CAP_SEC <= DAILY_SOURCE_CAP_SEC,
      `单轮上限（${REPLAY_ROUND_CAP_SEC}s）大于当日每源上限（${DAILY_SOURCE_CAP_SEC}s）时，上面那条行为判据会红——两张卡开始说两个数`,
    ).toBe(true);
    // 两个数各自都得是个「能说完一天」的量级，否则防呆形同虚设
    expect(DAILY_SOURCE_CAP_SEC).toBeGreaterThanOrEqual(3600);
    expect(REPLAY_ROUND_CAP_SEC).toBeGreaterThanOrEqual(3600);
  });

  /**
   * 静态侧：四个夹点必须真的读常量。为什么光有行为判据不够——
   * 有人可以把两处都改回字面量而数值仍然相同，那时上面两条全绿，
   * 而「改一处另一处跟着红」这件事又回到了没人守的状态（本轮的原始病灶）。
   */
  it("四处夹点都读 study-caps 的常量，没有一处还写着字面量", () => {
    const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
    const SITES: Array<[string, RegExp, string]> = [
      ["src/lib/study-time.ts", /Math\.min\(value,\s*DAILY_SOURCE_CAP_SEC\)/, "读旧台账那道闸"],
      ["src/lib/study-time.ts", /Math\.min\(\(entry\[source\] \?\? 0\) \+ seconds,\s*DAILY_SOURCE_CAP_SEC\)/, "累加那道闸"],
      ["src/lib/replay-time-trend.ts", /Math\.min\(REPLAY_ROUND_CAP_SEC,\s*Math\.round\(n\)\)/, "回放时长聚合"],
      ["src/components/replay-trainer.tsx", /REPLAY_ROUND_CAP_SEC\)/, "trainer 存档前夹一次"],
      // R16.322：会话级与「一题记多少」这两族以前没有主人
      ["src/components/quiz.tsx", /QUIZ_SESSION_CAP_SEC\)/, "交卷时夹会话 elapsed"],
      ["src/components/review-client.tsx", /addStudyTime\("quiz",\s*REVIEW_CREDIT_SEC\)/, "复习页一题记多少"],
      ["src/components/ai-quiz.tsx", /addStudyTime\("quiz",\s*REVIEW_CREDIT_SEC\)/, "AI 变体题一题记多少（此前零覆盖）"],
    ];
    for (const [rel, re, label] of SITES) {
      expect(read(rel), `${rel} 里的「${label}」不再读常量了`).toMatch(re);
    }
    // 地板：夹点数就是 7，少一个说明有夹点被搬走或改名，上面那圈会静默少判
    expect(SITES.length, "夹点清单本身不能缩水").toBe(7);

    // 非空转：旧写法（字面量）必须被上面那圈抓住
    const LEGACY = [
      "        entry[source] = Math.min(value, 8 * 3600);",
      "    entry[source] = Math.min((entry[source] ?? 0) + seconds, 8 * 3600);",
      "  return Math.min(MAX_ROUND_SEC, Math.round(n));",
      "        ? Math.min(Math.round((Date.now() - roundStartRef.current) / 1000), 8 * 3600)",
      "      const elapsed = Math.min(Math.round((Date.now() - startedAtRef.current) / 1000), 4 * 3600);",
      '    addStudyTime("quiz", 60);',
    ];
    const caught = LEGACY.filter((line) => SITES.some(([, re]) => re.test(line)));
    expect(caught.length, `${LEGACY.length} 条旧写法里有 ${LEGACY.length - caught.length} 条逃过了判据`).toBe(0);
  });

  /**
   * 上限与记分不许被第二处「自己算一遍」：全仓非测试源码里这几个字面形状
   * 只允许住在 `study-caps.ts`（定义处）。`binance.ts` 那一处是**位移量**
   * （`DISPLAY_TZ_OFFSET_SEC`，R16.39/R16.47 管它），与时长防呆无关，故豁免。
   *
   * 三条形状分别对应三个主人：`8 * 3600`（当日 / 单轮）、`4 * 3600`（一次测验会话）、
   * `addStudyTime("<源>", <字面量>)`（复习一题记多少、阅读一次喂多少）。
   * 第三条是本轮新长的：以前只扫秒数乘式，`addStudyTime("quiz", 60)` 这种
   * 「计价写在调用点」的形状扫不到——而它正是 R16.322 那处零覆盖副本的写法。
   */
  it("别处不再自己写一遍时长上限与复习记分", () => {
    const SHAPES: Array<[RegExp, string]> = [
      [/(?<![\d_])8\s*\*\s*3600(?![\d_])/, "8 * 3600（当日 / 单轮上限）"],
      [/(?<![\d_])4\s*\*\s*3600(?![\d_])/, "4 * 3600（一次测验会话上限）"],
      [/addStudyTime\(\s*"(?:read|quiz|replay)"\s*,\s*\d/, 'addStudyTime("源", 字面秒数)'],
    ];
    const ALLOWED = new Set(["src/lib/study-caps.ts", "src/lib/binance.ts"]);
    const hits: string[] = [];
    // 与 check:secrets 同口径：`--cached --others` 才是「已跟踪 ∪ 未跟踪」。
    // 只写 `--others` 是「仅未跟踪」（git 的语义不是叠加），扫描面会缩到 1 份文件而判据照样绿。
    const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test."));
    expect(files.length, "没扫到源码文件就是扫描器坏了").toBeGreaterThan(100);
    for (const rel of files) {
      if (ALLOWED.has(rel)) continue;
      // 注释里**描述**这些数字是本轮台账的正文，不是副本：只扫代码
      const code = stripComments(readFileSync(path.join(process.cwd(), rel), "utf8"));
      for (const line of code.split("\n")) {
        for (const [re, label] of SHAPES) {
          if (re.test(line)) hits.push(`${label} → ${rel}: ${line.trim().slice(0, 80)}`);
        }
      }
    }
    expect(hits, `时长上限或复习记分又长出私有副本：\n${hits.join("\n")}`).toEqual([]);

    // 非空转：三条形状各配一条自证，否则「扫不到」与「没有副本」读起来一样
    const SELF_TEST = [
      "      const elapsed = Math.min(Math.round((Date.now() - startedAtRef.current) / 1000), 4 * 3600);",
      '    addStudyTime("quiz", 60);',
      "    entry[source] = Math.min((entry[source] ?? 0) + seconds, 8 * 3600);",
    ];
    const caught = SELF_TEST.filter((line) => SHAPES.some(([re]) => re.test(line)));
    expect(caught.length, `三条自证里有 ${SELF_TEST.length - caught.length} 条扫不出来`).toBe(SELF_TEST.length);
    // 反向自证：`binance.ts` 那种 `7 * 24 * 3600_000` 不许被乘式形状误伤（豁免表若被删，这条会红）
    expect(/(?<![\d_])4\s*\*\s*3600(?![\d_])/.test("  const maxEnd = anchor - 7 * 24 * 3600_000;")).toBe(false);
  });

  /**
   * R16.322：`REVIEW_CREDIT_SEC` 与 `ACTIVE_DAY_MIN_SECONDS` 都是 60，但**不是同一件事**
   * （前者「答一题记多少进台账」，后者「一天凑够多少秒算一个活跃学习日」）。
   * 这条钉住它们目前同值但各自独立——若哪天有人合并成一个常量，这条会指出合并的代价。
   */
  it("复习记分与活跃日门槛同值但不同事，不许合并成一个常量", () => {
    const caps = readFileSync(path.join(process.cwd(), "src/lib/study-caps.ts"), "utf8");
    const weekly = readFileSync(path.join(process.cwd(), "src/lib/weekly-summary.ts"), "utf8");
    expect(caps).toMatch(/export const REVIEW_CREDIT_SEC = (\d+);/);
    expect(weekly).toMatch(/export const ACTIVE_DAY_MIN_SECONDS = (\d+);/);
    const credit = Number(/export const REVIEW_CREDIT_SEC = (\d+)/.exec(caps)![1]);
    const threshold = Number(/export const ACTIVE_DAY_MIN_SECONDS = (\d+)/.exec(weekly)![1]);
    // 两个名字必须都住在自己的文件里（合并成一个 import 就是丢掉一个语义）
    expect(credit, "复习记分得是个能说完「1 分钟」的整数秒").toBeGreaterThanOrEqual(60);
    expect(threshold, "活跃日门槛得是个能说完「1 分钟」的整数秒").toBeGreaterThanOrEqual(60);
    // 判据看**代码**：文件头的散文里点名对方是必要的说明，不算引用
    expect(stripComments(weekly).includes("REVIEW_CREDIT_SEC"), "weekly-summary 改读复习记分，就是把两件事合并了").toBe(false);
    expect(stripComments(caps).includes("ACTIVE_DAY_MIN_SECONDS"), "study-caps 改读活跃日门槛，两件事被绑死了").toBe(false);
  });
});
