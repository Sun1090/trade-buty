/**
 * R12.8：云端同步元数据——「最近一次云端合并的时间」。
 *
 * 只记读云端合并（hydrateFromCloud）成功的时刻；双写随写随推是常态动作不单独打点。
 * 读取端损坏值回退 null，不阻断渲染。
 */

const KEY = "tb-last-cloud-sync";

export function recordCloudSync(at: number = Date.now()): void {
  try {
    const safe = Number.isFinite(at) && at > 0 ? Math.round(at) : Date.now();
    localStorage.setItem(KEY, String(safe));
    window.dispatchEvent(new Event("tb-cloud-sync"));
  } catch {
    // ignore
  }
}

export function getLastCloudSync(storage: Storage | undefined = typeof localStorage !== "undefined" ? localStorage : undefined): number | null {
  try {
    const raw = storage?.getItem(KEY);
    const n = raw === null || raw === undefined ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  } catch {
    return null;
  }
}

/** 测试/调试：清空同步时间 */
export function clearLastCloudSync(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
