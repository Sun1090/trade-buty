/**
 * 把 Canvas 导出为 PNG 并触发浏览器下载。
 * 仅在浏览器环境有效（依赖 document/window/URL.createObjectURL）。
 */

/** 触发 PNG 下载。返回 Promise<void>，resolve 表示下载已触发（不保证用户保存）。 */
export async function downloadCanvasAsPng(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<void> {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("downloadCanvasAsPng only works in the browser");
  }
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (!blob) throw new Error("Canvas.toBlob returned null");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 给浏览器一点时间处理下载，再回收 ObjectURL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 检测浏览器是否支持 Web Share API（移动端分享面板）。 */
export function canWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** 调起 Web Share API（移动端分享面板）。失败（用户取消/不支持）时静默吞掉。 */
export async function webShare(
  data: { title?: string; text?: string; url?: string; files?: File[] },
): Promise<boolean> {
  if (!canWebShare()) return false;
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}
