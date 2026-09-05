/**
 * R9.5：sync 队列的 localStorage 持久化层。
 *
 * 独立于 sync-layer 的纯函数层：
 * - sync-queue.ts 提供 enqueueUnique/flushQueueAsync 等纯函数
 * - 本文件负责 localStorage 读写 + nextId 单调递增（保证 id 唯一）
 *
 * 失败兜底：localStorage 读写抛错都吞掉（队列是最佳努力，不应影响主流程）。
 */

import {
  enqueueUnique,
  trimQueue,
  flushQueueAsync,
  readQueue,
  MAX_QUEUE,
  type QueueItem,
  type QueueKind,
} from "./sync-queue";

/** localStorage 队列键名 */
export const QUEUE_KEY = "tb-sync-queue";

/** nextId 键名（单调递增） */
export const QUEUE_NEXT_ID_KEY = "tb-sync-queue-next-id";

/** 读取队列 + nextId（供调用方构造新增条目） */
export function loadQueueAndNextId(): { queue: QueueItem[]; nextId: number } {
  let queue: QueueItem[] = [];
  let nextId = 1;
  try {
    queue = readQueue(globalThis.localStorage?.getItem(QUEUE_KEY));
    const idStr = globalThis.localStorage?.getItem(QUEUE_NEXT_ID_KEY);
    const parsed = idStr ? parseInt(idStr, 10) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) nextId = parsed;
  } catch {
    // localStorage 不可用（SSR / 隐私模式）→ 返回空
  }
  return { queue, nextId };
}

/** 原子写回队列 + nextId */
function persist(queue: QueueItem[], nextId: number): void {
  try {
    globalThis.localStorage?.setItem(QUEUE_KEY, JSON.stringify(queue));
    globalThis.localStorage?.setItem(QUEUE_NEXT_ID_KEY, String(nextId));
  } catch {
    // ignore — 队列是 best-effort
  }
}

/**
 * 入队一条（自动去重 + 截断 + 持久化）。
 * 调用方传 now（便于测试）。
 */
export function enqueueWrite(
  kind: QueueKind,
  payloadKey: string,
  payload: Record<string, unknown>,
  now: number = Date.now(),
): QueueItem[] {
  const { queue, nextId } = loadQueueAndNextId();
  const updated = enqueueUnique(queue, kind, payloadKey, payload, now, nextId);
  const trimmed = trimQueue(updated);
  // 若入队导致 id 推进到 nextId+1，更新持久化
  let persistedNextId = nextId;
  if (updated.length > queue.length) {
    persistedNextId = nextId + 1;
  }
  persist(trimmed, persistedNextId);
  return trimmed;
}

/**
 * 重放队列：调用 executor（通常映射 kind → supabase 操作），成功的条目从队列移除。
 * 返回新队列（调用方无需关心持久化细节）。
 */
export async function flushPersistedQueue(
  executor: (item: QueueItem) => Promise<boolean>,
): Promise<{ queue: QueueItem[]; executed: number; succeeded: number }> {
  const { queue } = loadQueueAndNextId();
  const result = await flushQueueAsync(queue, executor);
  persist(result.queue, loadQueueAndNextId().nextId);
  return result;
}

/** 清空队列（注销账号等场景使用） */
export function clearPersistedQueue(): void {
  try {
    globalThis.localStorage?.removeItem(QUEUE_KEY);
    globalThis.localStorage?.removeItem(QUEUE_NEXT_ID_KEY);
  } catch {
    // ignore
  }
}

/** 当前队列长度（调试 / UI 显示用） */
export function getQueueLength(): number {
  return loadQueueAndNextId().queue.length;
}

/** 暴露给测试的常量 */
export const QUEUE_MAX = MAX_QUEUE;
