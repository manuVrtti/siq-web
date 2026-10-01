/**
 * Tiny server-rendered SVG trend line (no chart library) that draws itself
 * in with the siq-draw keyframe. `values` oldest → newest.
 */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 120
  const h = 36
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? w / (values.length - 1) : w
  const pts = values.map((v, i) => [i * step, h - 3 - (v / max) * (h - 6)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <path d={area} fill="var(--primary)" opacity="0.08" />
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="siq-draw"
        style={{ '--len': '400', strokeDasharray: 400 } as React.CSSProperties}
      />
      {pts.length ? <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="2.5" fill="var(--highlight)" /> : null}
    </svg>
  )
}
