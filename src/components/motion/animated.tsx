'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * Small motion primitives. All of them render the FINAL value on the server
 * and for users with prefers-reduced-motion, so nothing is ever hidden or
 * wrong without JavaScript — motion is decoration, not content.
 */

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Counts from 0 to `value` once, on mount. */
export function CountUp({ value, decimals = 0, duration = 900, suffix = '' }: { value: number; decimals?: number; duration?: number; suffix?: string }) {
  const [shown, setShown] = useState(value)
  const started = useRef(false)
  useEffect(() => {
    if (started.current || prefersReducedMotion()) return
    started.current = true
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(value * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return (
    <>
      {shown.toFixed(decimals)}
      {suffix}
    </>
  )
}

/**
 * Progress ring. Rendered at its final value; a CSS keyframe sweeps it in
 * from empty (see .siq-sweep). No JS, no extra render, and the global
 * reduced-motion rule disables the sweep.
 */
export function Ring({
  percent,
  size = 120,
  stroke = 10,
  className,
  trackClassName = 'stroke-muted',
  barClassName = 'stroke-primary',
  children,
}: {
  percent: number
  size?: number
  stroke?: number
  className?: string
  trackClassName?: string
  barClassName?: string
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClassName} />
        {p > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (p / 100) * c}
            className={cn(barClassName, 'siq-sweep')}
            style={{ '--siq-c': `${c}` } as React.CSSProperties}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/** Horizontal bar; a CSS keyframe grows it in from 0 (see .siq-grow). */
export function Bar({ percent, className, barClassName = 'bg-primary' }: { percent: number; className?: string; barClassName?: string }) {
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div className={cn('bg-muted h-2 overflow-hidden rounded-full', className)}>
      <div className={cn('siq-grow h-full rounded-full', barClassName)} style={{ width: `${p}%` }} />
    </div>
  )
}

/**
 * Live countdown to `to`. Ticks every second; shows days only when > 0.
 * Renders a static value on the server (computed from `nowIso`) so the
 * first paint matches, then takes over on the client.
 */
export function Countdown({ to, nowIso, onDoneLabel = 'Open now' }: { to: string; nowIso: string; onDoneLabel?: string }) {
  const target = new Date(to).getTime()
  const [now, setNow] = useState(() => new Date(nowIso).getTime())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const ms = target - now
  if (ms <= 0) return <span className="text-sm font-semibold">{onDoneLabel}</span>
  const s = Math.floor(ms / 1000)
  const parts = [
    { v: Math.floor(s / 86400), l: 'days' },
    { v: Math.floor((s % 86400) / 3600), l: 'hrs' },
    { v: Math.floor((s % 3600) / 60), l: 'min' },
    { v: s % 60, l: 'sec' },
  ].filter((x, i) => i > 0 || x.v > 0)
  return (
    <div className="flex gap-2" role="timer" aria-label="Time until the exam opens">
      {parts.map((x) => (
        <div key={x.l} className="min-w-[52px] rounded-xl bg-white/15 px-2.5 py-2 text-center backdrop-blur-sm">
          <div className="siq-numeric text-xl leading-none font-semibold">{String(x.v).padStart(2, '0')}</div>
          <div className="mt-1 text-[10px] tracking-wide uppercase opacity-80">{x.l}</div>
        </div>
      ))}
    </div>
  )
}
