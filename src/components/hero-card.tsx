/**
 * 通用页面 Hero 卡片——渐变背景 + 可选网格纹理
 * 统一 review/search/chart/replay/knowledge 等页的 hero 风格
 */
export function HeroCard({
  label,
  title,
  children,
  className = "",
}: {
  label?: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`relative isolate overflow-hidden mb-8 rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] via-[var(--surface)] to-[var(--surface)] p-6 shadow-[0_20px_60px_-35px_rgba(52,211,153,.35)] sm:p-9 ${className}`}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-0 h-px w-2/3 bg-gradient-to-r from-accent/60 to-transparent" aria-hidden />
      <div className="relative">
        {label && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {label}
          </p>
        )}
        <h1 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {children && (
          <div className="mt-3 text-sm text-muted leading-relaxed">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
