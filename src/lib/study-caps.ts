/**
 * 时长防呆的两个上限：一个管**一天里某一源**，一个管**单轮回放**。
 *
 * 它们数值相同（都是 8 小时），但**不是同一件事**，所以是两个名字——与 R16.319
 * 那条「趋势区间档位那个 7 与窗口长度同值但不同事，不许合并」同理。
 *
 * 为什么两处都要有主人：
 * - `DAILY_SOURCE_CAP_SEC` 在 `study-time.ts` 里被夹**两次**（累加处一次、
 *   `readLedger` 读旧台账时再一次）。两道闸互为备份，所以任何一道单独失效都
 *   不可观察——实测把任一处改成 12h，`study-time.test.ts` 12 条全绿。
 * - `REPLAY_ROUND_CAP_SEC` 长在两份地方：`replay-trainer.tsx` 存档前夹一次
 *   （它同时决定写进学习台账的那一截和记录里的 `durationSec`），
 *   `replay-time-trend.ts` 聚合时再夹一次，而后者的注释写着「与 study-time 防呆一致」。
 *   那句话此前没有任何东西核对：把 trainer 那份改成 12h，四个相关文件 71 条全绿。
 *
 * **真正要紧的是两者的关系，不是它们相等**：单轮上限必须 ≤ 当日每源上限。
 * 一旦超过，同一轮回放在 `/stats` 那一张页面上会说两个数——「回放时长」那块
 * 读 `durationSec`（只被单轮闸夹），「总学习时长」读台账（还要被当日闸夹一次），
 * 于是做完一轮 12 小时的人看到「回放 12h」与「共学 8h」。这条由
 * `study-caps.test.ts` 钉住，并且有行为侧证据（不是只比两个常数）。
 */

/** 当日单源（read / quiz / replay 各自）封顶秒数 */
export const DAILY_SOURCE_CAP_SEC = 8 * 3600;

/** 单轮回放封顶秒数：必须不大于 `DAILY_SOURCE_CAP_SEC`，理由见文件头 */
export const REPLAY_ROUND_CAP_SEC = 8 * 3600;
