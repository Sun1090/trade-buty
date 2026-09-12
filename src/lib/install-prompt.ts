/**
 * R13.14：PWA 安装提示的浏览器契约与本地关闭状态。
 *
 * 浏览器只有在确认应用可安装时才会派发 `beforeinstallprompt`。本模块不猜测
 * 安装条件，也不为 iOS/Safari 生成替代教程：没有事件就保持静默。
 */

export const INSTALL_PROMPT_DISMISSED_KEY = "tb-install-prompt-dismissed";

export interface InstallPromptEventLike extends Event {
  readonly platforms?: readonly string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

interface StandaloneSource {
  matchMedia?: (query: string) => Pick<MediaQueryList, "matches">;
  navigator?: {
    standalone?: boolean;
  };
}

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof globalThis.localStorage === "undefined"
      ? undefined
      : globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** 已关闭过安装提示时返回 true；存储不可用时视为未关闭。 */
export function readInstallPromptDismissed(
  storage: StorageLike | undefined = defaultStorage()
): boolean {
  try {
    return storage?.getItem(INSTALL_PROMPT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** 持久化关闭状态；隐私模式或存储配额错误时静默失败。 */
export function markInstallPromptDismissed(
  storage: StorageLike | undefined = defaultStorage()
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/**
 * 同时识别桌面/Android 的 `display-mode: standalone` 与 iOS 添加到主屏后的
 * `navigator.standalone`。检测失败时按普通浏览器处理，不阻断页面。
 */
export function isStandalone(source?: StandaloneSource): boolean {
  const runtime =
    source ?? (typeof window === "undefined" ? undefined : window);
  if (!runtime) return false;

  try {
    if (runtime.matchMedia?.("(display-mode: standalone)").matches) {
      return true;
    }
  } catch {
    // 继续检查 iOS 专有标记。
  }

  const navigatorLike = runtime.navigator as
    | { standalone?: boolean }
    | undefined;
  return navigatorLike?.standalone === true;
}

/** 安装提示的唯一展示判定，供组件与回归测试共用。 */
export function shouldShowInstallPrompt(input: {
  available: boolean;
  dismissed: boolean;
  standalone: boolean;
}): boolean {
  return input.available && !input.dismissed && !input.standalone;
}
