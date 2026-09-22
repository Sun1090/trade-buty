/**
 * 回放历史台账的保留轮数——隐私页「行情回放历史仅保留最近 N 轮」承诺的就是这个数
 * （`src/app/[locale]/privacy/privacy-endpoints.test.ts` 把它和文案钉在一起）。
 *
 * 单独成模块是因为两处都要用而依赖方向相反：本机写入裁在 `replay-store.ts`，
 * 云端合并裁在 `sync-layer.ts`，而前者 import 后者——上限定义在任何一边都会造出循环。
 */
export const REPLAY_HISTORY_KEEP = 100;
