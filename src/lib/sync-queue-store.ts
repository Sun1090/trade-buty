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

/** Account that owns the pending writes. Legacy unowned entries cannot be replayed safely. */
export const QUEUE_OWNER_KEY = "tb-sync-queue-owner";

/**
 * 被队列上限挤掉的写入条数（R16.139）。
 *
 * `trimQueue` 超过 `MAX_QUEUE` 就丢最旧的条目，而那些条目是**还没上传成功的写**。
 * 丢完剩下的传完以后，队列长度回到 0，界面那句「已云端存档，换设备不丢」就会重新出现，
 * 对着一条从来没到过云端的记录说谎。这个计数器就是那件事的账：只要它非零，
 * 「已存档」这个说法就不成立（见 `getUnarchivedWriteCount`）。
 */
export const QUEUE_DROPPED_KEY = "tb-sync-queue-dropped";

function ensureOwner(ownerId: string): boolean {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return false;
    if (storage.getItem(QUEUE_OWNER_KEY) === ownerId) return true;
    storage.removeItem(QUEUE_KEY);
    storage.removeItem(QUEUE_NEXT_ID_KEY);
    storage.removeItem(QUEUE_DROPPED_KEY);
    storage.setItem(QUEUE_OWNER_KEY, ownerId);
    return true;
  } catch {
    return false;
  }
}


/** 读取队列 + nextId（供调用方构造新增条目） */
export function loadQueueAndNextId(): { queue: QueueItem[]; nextId: number } {
  let queue: QueueItem[] = [];
  let nextId = 1;
  try {
    queue = readQueue(globalThis.localStorage?.getItem(QUEUE_KEY));
    const idStr = globalThis.localStorage?.getItem(QUEUE_NEXT_ID_KEY);
    const parsed = idStr && /^[1-9]\d*$/.test(idStr) ? Number(idStr) : NaN;
    if (Number.isSafeInteger(parsed) && parsed < Number.MAX_SAFE_INTEGER) nextId = parsed;
    const maxQueuedId = queue.reduce((max, item) => Math.max(max, item.id), 0);
    nextId = Math.max(nextId, maxQueuedId + 1);
  } catch {
    // localStorage 不可用（SSR / 隐私模式）→ 返回空
  }
  return { queue, nextId };
}

/** 队列内容变化的事件名：界面用它把「还有写着没推上去」这件事反映出来 */
export const QUEUE_EVENT = "tb-sync-queue";

/** 被队列上限挤掉、因此永远传不出去的写入条数（读不到就当没有） */
export function getDroppedWrites(): number {
  try {
    const raw = globalThis.localStorage?.getItem(QUEUE_DROPPED_KEY);
    if (!raw || !/^\d+$/.test(raw)) return 0;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

/** 记上 N 条被挤掉的未上传写入；变化沿 `QUEUE_EVENT` 通知读侧 */
export function recordDroppedWrites(count: number): void {
  if (!(count > 0)) return;
  try {
    globalThis.localStorage?.setItem(QUEUE_DROPPED_KEY, String(getDroppedWrites() + count));
  } catch {
    // ignore — 队列本来就是 best-effort，记不上账也不该影响主流程
  }
  announceQueueChange();
}

/**
 * 通知读侧「待上传条数可能变了」。写入失败时也要通知：长度是按 localStorage 现算的，
 * 存不进去同样是一种变化。
 */
function announceQueueChange(): void {
  try {
    window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch {
    // 无 window（SSR）时静默
  }
}

/** 原子写回队列 + nextId */
function persist(queue: QueueItem[], nextId: number): void {
  try {
    globalThis.localStorage?.setItem(QUEUE_KEY, JSON.stringify(queue));
    globalThis.localStorage?.setItem(QUEUE_NEXT_ID_KEY, String(nextId));
  } catch {
    // ignore — 队列是 best-effort
  }
  announceQueueChange();
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
  ownerId?: string,
): QueueItem[] {
  if (ownerId && !ensureOwner(ownerId)) return [];
  const { queue, nextId } = loadQueueAndNextId();
  const updated = enqueueUnique(queue, kind, payloadKey, payload, now, nextId);
  const trimmed = trimQueue(updated);
  if (trimmed.length < updated.length) {
    // 被挤掉的是「还没传上去」的写：记下来，让「已云端存档」那句话不再对它们成立
    recordDroppedWrites(updated.length - trimmed.length);
  }
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
  ownerId?: string,
): Promise<{ queue: QueueItem[]; executed: number; succeeded: number }> {
  if (ownerId) {
    try {
      const existing = globalThis.localStorage?.getItem(QUEUE_OWNER_KEY);
      if (existing && existing !== ownerId) return { queue: [], executed: 0, succeeded: 0 };
    } catch {
      return { queue: [], executed: 0, succeeded: 0 };
    }
    if (!ensureOwner(ownerId)) return { queue: [], executed: 0, succeeded: 0 };
  }
  const { queue } = loadQueueAndNextId();
  const result = await flushQueueAsync(queue, executor);
  // Reconcile against writes made while the asynchronous executor was pending.
  // Never overwrite new/updated entries with the stale snapshot taken above.
  const succeeded = new Map(queue
    .filter((item) => !result.queue.some((pending) => pending.id === item.id))
    .map((item) => [item.id, item]));
  // Another account may have logged in while the executor was in flight.
  try {
    if (ownerId && globalThis.localStorage?.getItem(QUEUE_OWNER_KEY) !== ownerId) {
      return { ...result, queue: [] };
    }
  } catch {
    return { ...result, queue: [] };
  }
  const latest = loadQueueAndNextId();
  const remaining = latest.queue.filter((item) => {
    const original = succeeded.get(item.id);
    return !original || original.at !== item.at ||
      JSON.stringify(original.payload) !== JSON.stringify(item.payload);
  });
  persist(remaining, latest.nextId);
  return { ...result, queue: remaining };
}

/** 清空队列（注销账号等场景使用） */
export function clearPersistedQueue(): void {
  try {
    globalThis.localStorage?.removeItem(QUEUE_KEY);
    globalThis.localStorage?.removeItem(QUEUE_NEXT_ID_KEY);
    globalThis.localStorage?.removeItem(QUEUE_OWNER_KEY);
    globalThis.localStorage?.removeItem(QUEUE_DROPPED_KEY);
  } catch {
    // ignore
  }
  announceQueueChange();
}

/** 当前队列长度（调试 / UI 显示用） */
export function getQueueLength(): number {
  return loadQueueAndNextId().queue.length;
}

/**
 * 「有几条本机写入还没到云上」= 队列里等传的 + 被上限挤掉、永远传不出去的。
 *
 * 那句「已云端存档，换设备不丢」的判据必须是这个数，而不是队列长度：队列被
 * `MAX_QUEUE` 截断之后剩下的条目照样会 flush 成 0，那时无队列 ≠ 无丢失。
 */
export function getUnarchivedWriteCount(): number {
  return getQueueLength() + getDroppedWrites();
}

/** `useSyncExternalStore` 的订阅端：入队、清空、另一个标签页写队列时都会通知。 */
export function subscribeQueueLength(onChange: () => void): () => void {
  window.addEventListener(QUEUE_EVENT, onChange);
  return () => window.removeEventListener(QUEUE_EVENT, onChange);
}

/** 暴露给测试的常量 */
export const QUEUE_MAX = MAX_QUEUE;
