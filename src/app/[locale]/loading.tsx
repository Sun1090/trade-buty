export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-5 py-10">
      {/* hero 骨架 */}
      <div className="mb-8 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] via-[var(--surface)] to-[var(--surface)] p-6 sm:p-8 animate-pulse">
        <div className="h-3 w-20 rounded bg-[var(--border-strong)]" />
        <div className="mt-3 h-8 w-3/4 rounded bg-[var(--border-strong)]" />
        <div className="mt-4 h-4 w-1/2 rounded bg-[var(--border)]" />
      </div>
      {/* 内容块骨架 */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 space-y-4 animate-pulse">
        <div className="h-5 w-2/3 rounded bg-[var(--border-strong)]" />
        <div className="h-4 w-full rounded bg-[var(--border)]" />
        <div className="h-4 w-full rounded bg-[var(--border)]" />
        <div className="h-4 w-5/6 rounded bg-[var(--border)]" />
        <div className="h-5 w-1/2 rounded bg-[var(--border-strong)] mt-6" />
        <div className="h-4 w-full rounded bg-[var(--border)]" />
        <div className="h-4 w-4/5 rounded bg-[var(--border)]" />
      </div>
    </div>
  );
}
