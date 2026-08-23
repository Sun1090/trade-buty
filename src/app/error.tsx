"use client";

import Link from "next/link";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="relative mx-auto max-w-3xl px-5 py-28 text-center overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(248,113,113,.08), transparent 70%)",
        }}
        aria-hidden
      />
      <p className="relative font-mono text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-[var(--down)] to-accent">:(</p>
      <h1 className="relative mt-6 text-2xl font-bold">
        Something went wrong
        <span className="block mt-2 text-sm font-normal text-muted">
          止损要快，重试要果断。
        </span>
      </h1>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-faint">ref: {error.digest}</p>
      )}
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-7 py-3 transition"
        >
          Retry ↻
        </button>
        <Link
          href={`/${DEFAULT_LOCALE}`}
          className="rounded-full border border-border-strong px-7 py-3 font-medium hover:border-accent/60 transition"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
