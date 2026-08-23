export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-20">
      {/* hero skeleton */}
      <div className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 animate-pulse">
        <div className="h-3 w-24 rounded bg-white/10 mb-4" />
        <div className="h-8 w-3/4 rounded bg-white/10 mb-3" />
        <div className="h-4 w-full rounded bg-white/5" />
      </div>
      {/* content skeleton */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 space-y-4 animate-pulse">
        <div className="h-5 w-1/2 rounded bg-white/10" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-5/6 rounded bg-white/5" />
        <div className="h-4 w-4/5 rounded bg-white/5" />
        <div className="h-20 w-full rounded-xl bg-white/5 my-6" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-3/4 rounded bg-white/5" />
      </div>
    </div>
  );
}
