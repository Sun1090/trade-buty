"use client";

import { useEffect, useState } from "react";
import {
  isValidEmail,
  saveNewsletter,
  readNewsletter,
  clearNewsletter,
  exportNewsletter,
} from "@/lib/newsletter";
import { copyText } from "@/lib/clipboard";

interface Labels {
  title: string;
  desc: string;
  placeholder: string;
  emailLabel: string;
  submit: string;
  saved: string;
  change: string;
  clear: string;
  copy: string;
  copied: string;
  copyFailed: string;
  exportLabel: string;
}

/**
 * R8.8 邮件订阅占位：纯前端，邮箱仅本机保存。
 * - 提供"复制 JSON" 导出按钮（无后端 API）
 * - 写明占位说明，避免用户误以为已订阅
 */
export function NewsletterSignup({ labels, locale }: { labels: Labels; locale: "zh" | "en" }) {
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const r = readNewsletter();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (r) setSaved(r.email);
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setError(locale === "en" ? "Please enter a valid email." : "请输入有效邮箱。");
      return;
    }
    if (saveNewsletter(email)) {
      setSaved(email);
      setEmail("");
    } else {
      setError(locale === "en" ? "Save failed." : "保存失败。");
    }
  }

  function handleClear() {
    clearNewsletter();
    setSaved(null);
  }

  function showCopyFailure() {
    setCopied(false);
    setCopyFailed(true);
    setTimeout(() => setCopyFailed(false), 2000);
  }

  async function handleCopy() {
    setCopyFailed(false);
    const json = exportNewsletter();
    if (!json) {
      showCopyFailure();
      return;
    }
    // 复用统一剪贴板助手：主路径 + execCommand 兜底，返回真实结果
    if (!(await copyText(json))) {
      showCopyFailure();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      data-testid="newsletter-signup"
      data-locale={locale}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <p className="font-semibold text-sm mb-1">{labels.title}</p>
      <p className="text-xs text-muted leading-relaxed mb-3">{labels.desc}</p>
      {saved ? (
        <div className="space-y-2">
          <p className="text-sm text-accent" data-testid="newsletter-saved">
            {labels.saved}
            <span className="font-mono">{saved}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSaved(null)}
              data-testid="newsletter-change"
              className="rounded-full border border-[var(--accent)]/40 hover:border-accent/60 px-3 py-1 text-xs transition"
            >
              {labels.change}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              data-testid="newsletter-copy"
              className="rounded-full border border-[var(--accent)]/40 hover:border-accent/60 px-3 py-1 text-xs transition"
            >
              {copyFailed ? `⚠️ ${labels.copyFailed}` : copied ? labels.copied : labels.copy}
            </button>
            <button
              type="button"
              onClick={handleClear}
              data-testid="newsletter-clear"
              className="rounded-full border border-[var(--border)] hover:border-faint px-3 py-1 text-xs text-faint transition"
            >
              {labels.clear}
            </button>
          </div>
          <p className="text-[11px] text-faint">{labels.exportLabel}</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="flex flex-wrap gap-2">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={labels.placeholder}
            aria-label={labels.emailLabel}
            data-testid="newsletter-input"
            className="flex-1 min-w-[200px] rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm focus:border-accent"
          />
          <button
            type="submit"
            data-testid="newsletter-submit"
            className="rounded-full bg-accent text-[var(--accent-on)] px-4 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            {labels.submit}
          </button>
          {error && (
            <p className="basis-full text-xs text-red-500 mt-1" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
