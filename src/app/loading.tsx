export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex items-center gap-3 text-muted text-sm">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        <span>Loading…</span>
      </div>
    </div>
  );
}
