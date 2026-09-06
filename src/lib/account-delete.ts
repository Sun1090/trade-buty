/** R9.10：注销账号的浏览器侧流程。 */
import { clearPersistedQueue } from "./sync-queue-store";

/** 清除本站本地数据（保留第三方扩展/站点数据，避免越权）。 */
export function clearLocalAccountData(): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith("tb-")) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // localStorage 不可用时仍继续服务端注销
  }
  clearPersistedQueue();
}

/** 请求服务端删除当前 cookie 会话对应的 Supabase Auth 用户。 */
export async function requestAccountDeletion(): Promise<void> {
  const response = await fetch("/api/auth/delete", { method: "DELETE", credentials: "include" });
  let body: { ok?: boolean; error?: string } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // 非 JSON 响应按失败处理
  }
  if (!response.ok || body.ok !== true) {
    throw new Error(body.error || "account deletion failed");
  }
}
