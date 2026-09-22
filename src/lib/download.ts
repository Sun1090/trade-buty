/**
 * 卡片图片的导出与分享。仅在浏览器环境有效（依赖 document/window/navigator/URL.createObjectURL）。
 *
 * 「分享」与「下载」是两件事：分享走系统分享面板（移动端把它递进微信/Telegram/相册），
 * 下载只是把文件丢进设备的下载目录。面板不可用（桌面浏览器、微信内置浏览器）时退回下载，
 * 但退回这件事由调用方决定，本模块只如实报告结果。
 */

/** `webShare` 的四态结果。用户主动取消单列，调用方据此不要把取消降级成一次复制/下载。 */
export type WebShareOutcome = "shared" | "cancelled" | "failed" | "unsupported";

/**
 * `shareCanvasAsPng` 的结果：`downloaded` 表示面板不可用（或不收这个文件）、已退回下载。
 * 不含 `unsupported`——没有面板时该函数走的就是下载分支。
 */
export type ShareFileOutcome = "shared" | "cancelled" | "failed" | "downloaded";

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
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

/** 触发 PNG 下载。resolve 表示下载已触发（不保证用户保存）。 */
export async function downloadCanvasAsPng(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<void> {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("downloadCanvasAsPng only works in the browser");
  }
  const blob = await canvasToPngBlob(canvas);
  if (!blob) throw new Error("Canvas.toBlob returned null");
  triggerBrowserDownload(blob, filename);
}

/** 检测浏览器是否支持 Web Share API（移动端分享面板）。 */
export function canWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * 浏览器是否愿意把这个文件交给分享面板。
 * 必须问 `canShare`：`navigator.share` 存在不代表能分享文件（桌面 Chrome 就是前者真、后者假），
 * 直接 `share({files})` 会以 NotAllowedError 失败，用户只看到一个没反应的按钮。
 */
export function canShareFile(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

/** 调起 Web Share API（移动端分享面板）。取消与失败分开返回，不静默吞掉。 */
export async function webShare(
  data: { title?: string; text?: string; url?: string; files?: File[] },
): Promise<WebShareOutcome> {
  if (!canWebShare()) return "unsupported";
  try {
    await navigator.share(data);
    return "shared";
  } catch (error) {
    // 用户主动取消：尊重选择，调用方不得把它降级成一次复制或下载
    if ((error as { name?: string } | null)?.name === "AbortError") return "cancelled";
    return "failed";
  }
}

/**
 * 把画布作为 PNG 交给系统分享面板；平台不接文件时退回下载。
 * 返回实际发生的那一步，调用方据此埋点——把「退化成下载」记成「分享成功」会让漏斗说谎。
 */
export async function shareCanvasAsPng(
  canvas: HTMLCanvasElement,
  filename: string,
  data: { title?: string; text?: string } = {},
): Promise<ShareFileOutcome> {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("shareCanvasAsPng only works in the browser");
  }
  const blob = await canvasToPngBlob(canvas);
  if (!blob) return "failed";
  const file = new File([blob], filename, { type: "image/png" });
  if (canShareFile(file)) {
    const shared = await webShare({ ...data, files: [file] });
    // 成功与「用户主动取消」都算面板这一步已经落地；其余情况才退回下载
    if (shared === "shared" || shared === "cancelled") return shared;
  }
  triggerBrowserDownload(blob, filename);
  return "downloaded";
}
