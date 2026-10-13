/**
 * 时长防呆的上限：谁管哪一段，以及为什么是四个名字而不是一个常量。
 *
 * | 名字 | 管什么 | 夹在哪 |
 * | --- | --- | --- |
 * | `DAILY_SOURCE_CAP_SEC` | 一天里**某一源**的合计 | `study-time.ts` 两处（累加、读旧台账） |
 * | `REPLAY_ROUND_CAP_SEC` | **单轮回放** | `replay-trainer.tsx` 存档前、`replay-time-trend.ts` 聚合时 |
 * | `QUIZ_SESSION_CAP_SEC` | **一次测验会话** | `quiz.tsx` 交卷时 |
 * | `REVIEW_CREDIT_SEC` | **一道复习应答**记多少 | `review-client.tsx`、`ai-quiz.tsx` |
 *
 * 前三个都是「夹子」，第四个是「计价」——它们数值两两有巧合（前两个都是 8 小时，
 * 第四个与 `weekly-summary.ts` 的 `ACTIVE_DAY_MIN_SECONDS` 都是 60 秒），但**不是同一件事**，
 * 所以不合并——与 R16.319 那条「趋势区间档位那个 7 与窗口长度同值但不同事」同理。
 * 尤其 `REVIEW_CREDIT_SEC` 与 `ACTIVE_DAY_MIN_SECONDS`：前者是「答一道题记多少进台账」，
 * 后者是「一天凑够多少秒才算一个活跃学习日」。合并成一个常量，将来改活跃门槛就会顺手改掉记分。
 *
 * 为什么两处都要有主人（下面四组读数都是**修复前**当场量的，R16.320 / R16.322 立判据之前的状态；
 * 每条都标了「现在谁守着」——那些读数会随用例增删而变，不标时间就会变成假话，见 R16.323）：
 * - `DAILY_SOURCE_CAP_SEC` 在 `study-time.ts` 里被夹**两次**（累加处一次、`readLedger` 读旧台账时再一次）。
 *   修复前：两道闸互为备份，把**任一处**改成 12h，`study-time.test.ts` 当时 12 条全绿。
 *   现在：读侧那处一改，`study-time.test.ts` 红 2 条（「外部写坏的超限值由读侧夹回上限」+
 *   「上限只有一个主人」）；写侧那处一改行为侧仍绿（当日闸兜着），但 `study-caps.test.ts`
 *   的静态判据会点名「累加那道闸不再读常量了」。**两侧都不再是无人守的状态。**
 * - `REPLAY_ROUND_CAP_SEC` 长在两份地方：`replay-trainer.tsx` 存档前夹一次（它同时决定写进
 *   学习台账的那一截和记录里的 `durationSec`），`replay-time-trend.ts` 聚合时再夹一次，
 *   而后者的注释写着「与 study-time 防呆一致」。修复前：那句话没有任何东西核对，把 trainer
 *   那份改成 12h，那四个相关文件当时 71 条全绿。现在：同一改动被 `study-caps.test.ts` 抓到
 *   （它比那四个文件多一个），而那四个文件本身仍绿——行为侧要靠静态侧补。
 * - `QUIZ_SESSION_CAP_SEC` 此前是 `quiz.tsx` 里一个行内的 `4 * 3600`，而 `study-time.ts` 的注释
 *   **明明白白写着「单次调用没有上限……在代码里不存在」**。那句订正（`148389d`）本身是错的：
 *   它只翻了 `study-time.ts` 一个文件，没看调用点（R16.322）。修复前：把它改成 `12 * 3600`，
 *   只有 `quiz.test.tsx` 那一条「caps … at four hours」红——它钉的是数值，不是「这个数有主人」。
 *   现在：静态判据同样会红，因为那一处改读常量了。
 * - `REVIEW_CREDIT_SEC` 长在两处（复习页与 AI 变体题），两边注释都写「1 题记 1 分钟」。
 *   修复前：把 `ai-quiz.tsx` 那处改成 120，该文件当时 14 条全绿——同一个政策的两份副本，
 *   其中一份零覆盖。现在：`ai-quiz.test.tsx` 有一条走真实台账的行为判据守着它（R16.322 补的），
 *   同一改动当场红 1 条。
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

/** 一次测验会话封顶秒数：交卷时按墙钟算出的 elapsed 先被它夹，再进当日那道闸 */
export const QUIZ_SESSION_CAP_SEC = 4 * 3600;

/** 每道复习应答（复习页与 AI 变体题）记进台账 quiz 源的秒数：R5.8「1 题记 1 分钟」 */
export const REVIEW_CREDIT_SEC = 60;
