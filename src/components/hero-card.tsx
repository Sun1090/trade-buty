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
      className={`relative overflow-hidden mb-8 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] via-[var(--surface)] to-[var(--surface)] p-6 sm:p-8 ${className}`}
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
      <div className="relative">
        {label && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {label}
          </p>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold mt-3">{title}</h1>
        {children && (
          <div className="mt-3 text-sm text-muted leading-relaxed">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
