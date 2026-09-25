"use client";

import { useState } from "react";
import { downloadPrivacyExport } from "@/lib/privacy-export";

/** R9.9：隐私页上的本地数据导出按钮。 */
export function PrivacyDataExport({ locale }: { locale: "zh" | "en" }) {
  const [downloaded, setDownloaded] = useState(false);
  const [failed, setFailed] = useState(false);

  function handleExport() {
    setDownloaded(false);
    setFailed(false);
    try {
      downloadPrivacyExport();
      setDownloaded(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <section
      data-testid="privacy-data-export"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3"
    >
      <div>
        <h2 className="text-lg font-semibold">
          {locale === "en" ? "Export your data" : "导出你的数据"}
        </h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          {locale === "en"
            ? "Download a JSON copy of your local learning progress, quiz results, replay history, and sync status. The file walks your browser's local storage (localStorage) and does not read cookies at all — your sign-in session (access and refresh tokens) lives in cookies, so it was never in scope here; and if some browser ever did keep a copy of it in local storage, keys in the sb- family are skipped on export. The file therefore does carry the local marker naming which account this data belongs to."
            : "下载一份 JSON 格式的数据副本，包含本机学习进度、测验结果、回放记录和同步状态。这份文件遍历的是浏览器本机存储（localStorage），完全不读 Cookie——登录会话（访问与刷新令牌）存在 Cookie 里，所以它从来不在导出的范围内；即便某台浏览器上曾经把会话写进过 localStorage，sb- 那一族键也会在导出时被跳过。文件里因此也带着记录这份数据属于哪个账户的本机标识。"}
        </p>
      </div>
      <button
        type="button"
        onClick={handleExport}
        data-testid="privacy-export-button"
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-[var(--accent-on)] transition hover:opacity-90"
      >
        {locale === "en" ? "Download my data" : "下载我的数据"}
      </button>
      {downloaded && (
        <p role="status" className="text-xs text-accent">
          {locale === "en" ? "Export downloaded." : "数据导出已下载。"}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-xs text-red-500">
          {locale === "en" ? "Export failed. Please try again." : "导出失败，请重试。"}
        </p>
      )}
    </section>
  );
}
