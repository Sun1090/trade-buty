"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  hasOnboarded,
  getCurrentStep,
  advanceStep,
  markDone,
  resetOnboarding,
  type OnboardStep,
} from "@/lib/onboarding";

interface Labels {
  title: string;
  steps: Record<OnboardStep, { title: string; body: string; cta: string }>;
  next: string;
  skip: string;
  finish: string;
  restart: string;
}

/**
 * R8.6 新手引导：3 步 dialog（path / replay / review）。
 * - 触发：首次访问（localStorage 无 tb-onboarded 标记且无当前步）
 * - 用户可 Next / Skip / Finish；完成后 localStorage 写 1
 * - 默认从 path 开始；用户可主动 restart 重看
 */
export function OnboardingTour({
  labels,
  locale,
}: {
  labels: Labels;
  locale: "zh" | "en";
}) {
  const [step, setStep] = useState<OnboardStep | null>(null);

  useEffect(() => {
    // 优先读上次中断的步；已完成的返回 null，否则默认 path
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(hasOnboarded() ? null : (getCurrentStep() ?? "path"));
  }, []);

  function handleNext() {
    if (!step) return;
    const r = advanceStep(step);
    if (r === "done") {
      setStep(null);
    } else {
      setStep(r);
    }
  }

  function handleSkip() {
    markDone();
    setStep(null);
  }

  function handleRestart() {
    resetOnboarding();
    setStep("path");
  }

  if (!step) return null;
  const cur = labels.steps[step];
  const href =
    step === "path"
      ? `/${locale}/path`
      : step === "replay"
        ? `/${locale}/replay`
        : `/${locale}/review`;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={labels.title}
      data-testid="onboarding-tour"
      data-step={step}
      data-locale={locale}
      className="mx-auto max-w-2xl mt-3 mb-3 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent-dim)]/60 backdrop-blur-sm px-5 py-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-accent font-semibold mb-1">
            {labels.title}
          </p>
          <p className="font-semibold text-base">{cur.title}</p>
          <p className="text-muted mt-1 text-sm leading-relaxed">{cur.body}</p>
        </div>
        <button
          type="button"
          onClick={handleSkip}
          data-testid="onboarding-skip"
          aria-label={labels.skip}
          className="text-xs text-faint hover:text-muted px-2 py-1 shrink-0"
        >
          ✕
        </button>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Link
          href={href}
          onClick={handleNext}
          data-testid="onboarding-cta"
          className="rounded-full bg-accent text-[var(--accent-on)] px-4 py-1.5 text-sm font-medium hover:opacity-90 transition"
        >
          {cur.cta} →
        </Link>
        <button
          type="button"
          onClick={handleNext}
          data-testid="onboarding-next"
          className="rounded-full border border-[var(--accent)]/40 bg-[var(--surface)] hover:border-accent/60 text-accent px-3 py-1.5 text-xs transition"
        >
          {step === "review" ? labels.finish : labels.next}
        </button>
        <button
          type="button"
          onClick={handleRestart}
          data-testid="onboarding-restart"
          className="text-xs text-faint hover:text-muted underline-offset-2 hover:underline ml-auto px-2"
        >
          {labels.restart}
        </button>
      </div>
    </div>
  );
}
