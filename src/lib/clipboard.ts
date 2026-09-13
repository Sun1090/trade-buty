/**
 * 统一的剪贴板写入助手。
 *
 * 复制是用户主动操作，失败不能被静默吞掉，也不能被伪装成成功：
 * 这里的返回值就是真实结果——调用方负责把 `false` 变成可见的用户反馈。
 *
 * 主路径 `navigator.clipboard.writeText`（需要安全上下文）；不可用或被拒绝时
 * 退回 `<textarea>` + `document.execCommand("copy")`，覆盖微信内置浏览器等
 * 未实现异步剪贴板 API 的环境。任何一步抛错都收敛成 `false`，不产生未处理拒绝。
 */

/**
 * `<textarea>` + `execCommand` 兜底。
 * 返回 `execCommand` 的真实结果；无论成功、失败还是抛错都保证清理临时节点。
 */
export function copyViaExecCommand(text: string): boolean {
  if (typeof document === "undefined") return false;
  let area: HTMLTextAreaElement;
  try {
    area = document.createElement("textarea");
  } catch {
    return false;
  }
  try {
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/** 异步剪贴板 API 可用时优先走它；不可用或失败返回 `false`（不抛错）。 */
async function copyViaClipboardApi(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined") return false;
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * 把 `text` 写入系统剪贴板，返回是否真正成功。
 * 先试异步 API，失败再退回 `execCommand`；两条路径都失败时返回 `false`。
 */
export async function copyText(text: string): Promise<boolean> {
  if (await copyViaClipboardApi(text)) return true;
  return copyViaExecCommand(text);
}
