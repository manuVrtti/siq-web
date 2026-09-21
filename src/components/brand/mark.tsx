'use client'

import { useId } from 'react'

import { cn } from '@/lib/utils'

/**
 * Plan 019 — the SelectIQ mark.
 *
 * A rounded-square glyph carrying a stylised "S". The gradient is the ONE
 * place a blue-500 → blue-800 fill shows anywhere in the app — everywhere
 * else those two colors appear only as solid tokens. Reusing that gradient
 * elsewhere would cheapen the mark, so it lives inside this SVG only.
 *
 * Client component so `useId()` can give each instance a unique <defs> id
 * without random/mutable module state (both would trip React 19's purity
 * lint). Server components render it fine — client leaves through the
 * usual RSC boundary.
 */
export function BrandMark({ className }: { className?: string }) {
  const gid = `brand-mark-${useId().replace(/:/g, '')}`
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-7', className)}
      role="img"
      aria-label="SelectIQ"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill={`url(#${gid})`} />
      <path
        d="M11.5 20.5c1 1.2 2.5 1.9 4.4 1.9 2.7 0 4.6-1.4 4.6-3.5 0-1.7-1-2.7-3.4-3.2l-2.1-.4c-1.2-.3-1.7-.7-1.7-1.4 0-.9.8-1.5 2-1.5 1.3 0 2.2.6 2.8 1.6l2-1.4c-.9-1.5-2.6-2.4-4.7-2.4-2.6 0-4.4 1.4-4.4 3.4 0 1.6 1 2.7 3.2 3.1l2.1.4c1.3.3 1.9.7 1.9 1.5 0 1-1 1.6-2.4 1.6-1.5 0-2.6-.6-3.4-1.9l-2 1.2Z"
        fill="#ffffff"
      />
    </svg>
  )
}

/** Small wordmark: mark + "SelectIQ" tightly kerned. Sidebar / nav use. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <BrandMark className="size-7" />
      <span className="font-display text-sm font-semibold tracking-tight">
        SelectIQ
      </span>
    </span>
  )
}
