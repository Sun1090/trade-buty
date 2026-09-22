"use client";

/**
 * R9.6 体积守门：从 sync-layer.ts 抽出失败入队逻辑。
 * sync-layer.ts 的 write 函数改用动态 import 引入本模块，确保 sync-queue-store
 * 不会被打进 layout 的共享 chunk。
 *
 * 但动态 import 自己会失败：service worker 只预缓存 offline.html，JS chunk 一律走网络，
 * 所以这一页没能成功拿到队列 chunk 时（首载就失败、断网后重试、或发布后旧 hash 已经 404），
 * `import()` 直接 reject——而这正是 R9.5 队列要服务的场景。于是这里兜住两件事：
 * 1. 不把拒绝漏给 fire-and-forget 的调用点（否则每次入队都留一条未处理 Promise 拒绝）；
 * 2. 写入先留在内存缓冲区，等 chunk 能加载时（下一次入队，或网络恢复后的 flush 重试）
 *    原样落进持久化队列——顺序与去重口径与 enqueueUnique 一致。
 * 缓冲区只活在当前页面会话：标签页关掉就没了，这里不假称它能跨会话恢复。
 */
import { MAX_QUEUE, type QueueKind } from "./sync-queue";

interface PendingWrite {
  kind: QueueKind;
  payloadKey: string;
  payload: Record<string, unknown>;
  ownerId?: string;
  /** 落盘时这条写入仍属于当前账号才允许进队列 */
  isCurrent: () => boolean;
}

/** 尚未落进持久化队列的写入；key = `kind|payloadKey`，与 enqueueUnique 的去重键同口径 */
const pendingWrites = new Map<string, PendingWrite>();

/** 串行化落盘：并发写入按调用先后入队，重放顺序才等于用户操作顺序 */
let drainChain: Promise<void> = Promise.resolve();
let warned = false;

function remember(write: PendingWrite): void {
  pendingWrites.set(`${write.kind}|${write.payloadKey}`, write);
  // 与 trimQueue 同一口径：超上限丢最旧，避免离线刷屏把内存吃满
  while (pendingWrites.size > MAX_QUEUE) {
    const oldest = pendingWrites.keys().next().value;
    if (oldest === undefined) return;
    pendingWrites.delete(oldest);
  }
}

async function flushPendingWrites(): Promise<void> {
  const store = await import("./sync-queue-store");
  for (const [id, write] of [...pendingWrites]) {
    if (!write.isCurrent()) {
      pendingWrites.delete(id);
      continue;
    }
    store.enqueueWrite(write.kind, write.payloadKey, write.payload, Date.now(), write.ownerId);
    // 只有真正交给队列之后才丢出缓冲
    pendingWrites.delete(id);
  }
}

function scheduleFlush(): Promise<void> {
  const next = drainChain.then(() => flushPendingWrites());
  drainChain = next.catch(() => undefined);
  return next;
}

/**
 * 把一条失败的云端写入交给队列；chunk 不可用时留在内存缓冲，等下一次重试。
 * 永不 reject——调用点是 fire-and-forget 的双写路径。
 */
export async function lazyEnqueueWrite(
  kind: QueueKind,
  payloadKey: string,
  payload: Record<string, unknown>,
  ownerId?: string,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  remember({ kind, payloadKey, payload, ownerId, isCurrent });
  await retryBufferedWrites();
}

/**
 * 重试把缓冲里的写入落盘。网络恢复 / 登录后 flush 之前调用，
 * 这样缓冲区的内容能赶上这一轮重放。永不 reject。
 */
export async function retryBufferedWrites(): Promise<void> {
  try {
    await scheduleFlush();
  } catch (err) {
    // 离线刷屏时同一条警告只说一次
    if (process.env.NODE_ENV !== "production" && !warned) {
      warned = true;
      console.warn("[sync] offline queue chunk unavailable; writes kept in memory", err);
    }
  }
}

/** 缓冲中仍待落盘的写入数（调试 / 测试用） */
export function pendingWriteCount(): number {
  return pendingWrites.size;
}
