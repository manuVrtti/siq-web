/**
 * Plan 019 — pass rate as a ring. SVG only, server-rendered. `null` means the
 * assessment has no passing score, which we say plainly rather than drawing
 * an empty ring that reads as 0%.
 */
export function PassRateGauge({ rate, size = 132 }: { rate: number | null; size?: number }) {
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = rate === null ? 0 : Math.min(100, Math.max(0, rate))

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#2563eb"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (pct / 100) * c}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-2xl font-semibold">
            {rate === null ? '—' : `${rate}%`}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {rate === null ? 'No passing score set' : 'Pass rate'}
      </p>
    </div>
  )
}
