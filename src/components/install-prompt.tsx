"use client";

import { useEffect, useState } from "react";
import {
  isStandalone,
  markInstallPromptDismissed,
  readInstallPromptDismissed,
  shouldShowInstallPrompt,
  type InstallPromptEventLike,
} from "@/lib/install-prompt";

export interface InstallPromptLabels {
  title: string;
  body: string;
  install: string;
  dismiss: string;
}

/**
 * R13.14：只消费浏览器提供的安装能力，不主动弹窗、不追踪点击。
 *
 * - `beforeinstallprompt` 到达时才出现，且必须先 `preventDefault` 才能稍后由
 *   用户手势调用 prompt()；
 * - 用户选择「暂不」或浏览器安装选择结束后写入本地关闭标记；
 * - standalone / 已关闭 / 不支持的环境不渲染任何内容。
 */
export function InstallPrompt({
  labels,
  locale,
}: {
  labels: InstallPromptLabels;
  locale: "zh" | "en";
}) {
  const [promptEvent, setPromptEvent] =
    useState<InstallPromptEventLike | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone() || readInstallPromptDismissed()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as InstallPromptEventLike;
      if (
        typeof installEvent.prompt !== "function" ||
        !installEvent.userChoice
      ) {
        return;
      }

      // 阻止浏览器自带迷你信息栏；实际安装仍由点击按钮后的原生选择决定。
      event.preventDefault();
      if (
        shouldShowInstallPrompt({
          available: true,
          dismissed: readInstallPromptDismissed(),
          standalone: isStandalone(),
        })
      ) {
        setPromptEvent(installEvent);
      }
    };

    const onInstalled = () => {
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function handleDismiss() {
    markInstallPromptDismissed();
    setPromptEvent(null);
  }

  async function handleInstall() {
    if (!promptEvent || busy) return;
    const event = promptEvent;
    setBusy(true);

    try {
      await event.prompt();
      // 无论接受还是关闭原生安装提示，都尊重用户选择，不再在本机重复询问。
      await event.userChoice;
      markInstallPromptDismissed();
      setPromptEvent(null);
    } catch {
      // 浏览器可能因重复调用或环境变化拒绝；保持静默，不把它包装成错误。
    } finally {
      setBusy(false);
    }
  }

  if (!promptEvent) return null;

  return (
    <aside
      role="region"
      aria-live="polite"
      aria-label={labels.title}
      aria-describedby="install-prompt-description"
      data-testid="install-prompt"
      data-locale={locale}
      className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:left-auto sm:right-5 sm:mx-0 sm:w-[22rem]"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl leading-none">📲</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{labels.title}</p>
          <p
            id="install-prompt-description"
            className="mt-1 text-xs leading-relaxed text-muted"
          >
            {labels.body}
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-xs text-muted transition hover:bg-white/5 hover:text-foreground disabled:opacity-50"
            >
              {labels.dismiss}
            </button>
            <button
              type="button"
              onClick={handleInstall}
              disabled={busy}
              className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-dim)] px-3 py-2 text-xs font-medium text-accent transition hover:border-accent/70 disabled:opacity-50"
            >
              {labels.install}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
