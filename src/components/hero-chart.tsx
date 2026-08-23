const CANDLES = [
  { o: 30, c: 38, h: 42, l: 28 },
  { o: 38, c: 34, h: 40, l: 31 },
  { o: 34, c: 44, h: 47, l: 33 },
  { o: 44, c: 52, h: 55, l: 42 },
  { o: 52, c: 48, h: 54, l: 45 },
  { o: 48, c: 60, h: 63, l: 46 },
  { o: 60, c: 56, h: 64, l: 53 },
  { o: 56, c: 68, h: 72, l: 55 },
  { o: 68, c: 74, h: 78, l: 66 },
  { o: 74, c: 70, h: 76, l: 67 },
  { o: 70, c: 82, h: 86, l: 69 },
  { o: 82, c: 90, h: 94, l: 80 },
];

const W = 420;
const H = 240;
const MIN = 20;
const MAX = 100;

function y(v: number) {
  return H - ((v - MIN) / (MAX - MIN)) * (H - 16) - 8;
}

export function HeroChart({ locale = "en" }: { locale?: string }) {
  const step = W / CANDLES.length;
  const hint = locale === "en"
    ? "Your first lesson starts with reading this candle"
    : "你的第一课，从看懂这根 K 线开始";
  const maPoints = CANDLES.map(
    (k, i) => `${i * step + step / 2},${y((k.o + k.c) / 2)}`
  ).join(" ");

  return (
    <div className="relative">
      <div
        className="absolute -inset-6 rounded-3xl bg-[var(--accent)]/10 blur-2xl"
        aria-hidden
      />
      <div className="relative rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]/70" />
          </div>
          <span className="font-mono text-xs text-faint">BTCUSDT · 4H</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          {[25, 50, 75].map((g) => (
            <line
              key={g}
              x1={0}
              x2={W}
              y1={(g / 100) * H}
              y2={(g / 100) * H}
              stroke="rgba(233,237,245,.06)"
            />
          ))}
          {CANDLES.map((k, i) => {
            const up = k.c >= k.o;
            const color = up ? "#34d399" : "#f87171";
            const cx = i * step + step / 2;
            const top = y(Math.max(k.o, k.c));
            const bottom = y(Math.min(k.o, k.c));
            return (
              <g key={i}>
                <line x1={cx} x2={cx} y1={y(k.h)} y2={y(k.l)} stroke={color} strokeWidth={1} />
                <rect
                  x={cx - step * 0.28}
                  y={top}
                  width={step * 0.56}
                  height={Math.max(bottom - top, 2)}
                  fill={up ? "rgba(52,211,153,.9)" : "rgba(248,113,113,.9)"}
                  rx={1.5}
                />
              </g>
            );
          })}
          <polyline points={maPoints} fill="none" stroke="#818cf8" strokeWidth={1.5} opacity={0.85} />
        </svg>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)] font-mono text-xs">
          <span className="text-accent">+12.6%</span>
          <span className="text-faint">{hint}</span>
        </div>
      </div>
    </div>
  );
}
