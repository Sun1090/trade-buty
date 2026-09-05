"use client";

/**
 * R9.6 体积守门：从 sync-layer.ts 抽出失败入队逻辑。
 * sync-layer.ts 的 write 函数改用动态 import 引入本模块，确保 sync-queue-store
 * 不会被打进 layout 的共享 chunk。
 */
import type { QueueKind } from "./sync-queue";

export async function lazyEnqueueWrite(
  kind: QueueKind,
  payloadKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const mod = await import("./sync-queue-store");
  mod.enqueueWrite(kind, payloadKey, payload);
}
