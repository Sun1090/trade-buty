/**
 * R9.5：离线/失败写入队列。
 *
 * 场景：用户在地铁/弱网下学习，本地进度照常写入 localStorage，云端 sync 函数
 * 失败时（fetch reject / 401 / 5xx）不应静默丢失——而是入队，待登录后或下次上线
 * 时由 AuthProvider / 在线事件触发 flushQueue 重放。
 *
 * 设计要点：
 * - 纯函数优先：enqueue/dedupe/expire 都是纯函数；localStorage 持久化与重放
 *   单独抽出副作用函数，便于测试
 * - 队列长度上限：超过 MAX_QUEUE 丢弃最旧条目（防止异常膨胀撑爆 localStorage）
 * - 同 kind+payloadKey 去重：同一条错题反复"答错-移除-再答错"只入队 1 次
 * - FIFO 重放：flushQueue 按入队顺序逐条执行；任意一条失败整体中断并保留已入队的部分
 * - payload 可序列化：每条都是 plain JSON（否则 localStorage 反序列化会丢）
 */

/** 队列最大长度（防止异常膨胀 + 跨设备同步时的 base64 体积限制） */
export const MAX_QUEUE = 200;

/** 写入类别：与 sync-layer 的写函数一一对应 */
export type QueueKind =
  | "progress"
  | "wrongbook-upsert"
  | "wrongbook-delete"
  | "quiz"
  | "replay-history"
  | "replay-best"
  | "goal";

/** 队列条目 */
export interface QueueItem {
  /** 唯一 id（递增序号） */
  id: number;
  /** 写入类别 */
  kind: QueueKind;
  /** 业务主键（用于去重）；同一 kind 下不同主键代表不同条目 */
  payloadKey: string;
  /** 业务负载（可序列化 JSON） */
  payload: Record<string, unknown>;
  /** 入队时间（ms） */
  at: number;
}

/**
 * 去重入队：若已存在同 kind+payloadKey 的条目，更新其 payload + at（保持队尾），
 * 不存在则追加。返回新队列（不修改入参）。
 */
export function enqueueUnique(
  queue: readonly QueueItem[],
  kind: QueueKind,
  payloadKey: string,
  payload: Record<string, unknown>,
  now: number,
  nextId: number,
): QueueItem[] {
  const existingIdx = queue.findIndex(
    (q) => q.kind === kind && q.payloadKey === payloadKey,
  );
  if (existingIdx >= 0) {
    const updated = queue.map((q, i) =>
      i === existingIdx
        ? { ...q, payload, at: now }
        : q,
    );
    return [...updated];
  }
  const next: QueueItem = { id: nextId, kind, payloadKey, payload, at: now };
  return [...queue, next];
}

/** 超出 MAX_QUEUE 时丢弃最旧条目（FIFO 截断） */
export function trimQueue(queue: readonly QueueItem[], max: number = MAX_QUEUE): QueueItem[] {
  if (queue.length <= max) return [...queue];
  return queue.slice(queue.length - max);
}

/**
 * 重放执行器签名：调用方传入真正执行的副作用函数。
 * 返回 true 表示成功（条目从队列移除），false 表示失败（保留，等下次再试）。
 */
export type QueueExecutor = (item: QueueItem) => Promise<boolean> | boolean;

/**
 * 顺序重放队列；遇到失败立即停止（保留剩余条目）。
 * 返回值：新队列（已成功移除的条目消失）+ 重放执行统计。
 */
/**
 * 同步版重放：仅当 executor 是纯同步函数时使用；异步 executor 请走 flushQueueAsync。
 * 返回 Promise<boolean> 的 executor 在该函数下会被视为"失败"，因为我们没法
 * 在同步循环里 await。这是有意设计——强制调用方选对版本。
 */
export function flushQueue(
  queue: readonly QueueItem[],
  executor: QueueExecutor,
): { queue: QueueItem[]; executed: number; succeeded: number } {
  const remaining: QueueItem[] = [];
  let executed = 0;
  let succeeded = 0;
  for (const item of queue) {
    executed++;
    let ok = false;
    try {
      const result = executor(item);
      // 仅同步 boolean 视为有效；其它（包括 Promise）视为失败
      if (typeof result === "boolean") ok = result;
    } catch {
      ok = false;
    }
    if (ok) {
      succeeded++;
    } else {
      remaining.push(item);
    }
  }
  return { queue: remaining, executed, succeeded };
}

/**
 * 异步版重放：真正 await 每条执行；遇失败保留后续条目并停止。
 * 返回新队列与统计。
 */
export async function flushQueueAsync(
  queue: readonly QueueItem[],
  executor: QueueExecutor,
): Promise<{ queue: QueueItem[]; executed: number; succeeded: number }> {
  const remaining: QueueItem[] = [];
  let executed = 0;
  let succeeded = 0;
  for (const item of queue) {
    executed++;
    let ok = false;
    try {
      ok = await Promise.resolve(executor(item));
    } catch {
      ok = false;
    }
    if (ok) {
      succeeded++;
    } else {
      // 失败 → 把这一条 + 后续未执行的都保留
      remaining.push(item);
      // 把队列中剩余未触达的也一并保留
      const idx = queue.indexOf(item);
      for (let i = idx + 1; i < queue.length; i++) {
        const rest = queue[i];
        if (rest) remaining.push(rest);
      }
      break;
    }
  }
  return { queue: remaining, executed, succeeded };
}

/**
 * 从完整 localStorage JSON 字符串解析队列；非法 JSON 返回空。
 * 纯函数：调用方负责 localStorage.getItem 与 setItem。
 */
export function readQueue(serialized: string | null | undefined): QueueItem[] {
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    // 基本字段校验；缺字段就丢弃
    return parsed.filter(
      (q): q is QueueItem =>
        q &&
        typeof q.id === "number" &&
        typeof q.kind === "string" &&
        typeof q.payloadKey === "string" &&
        q.payload !== undefined &&
        typeof q.payload === "object" &&
        typeof q.at === "number",
    );
  } catch {
    return [];
  }
}
