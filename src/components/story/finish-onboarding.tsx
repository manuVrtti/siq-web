'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Marks the welcome journey done (idempotent), then goes to `href`. */
export function FinishOnboarding({
  href,
  label,
  variant = 'primary',
}: {
  href: string
  label: string
  variant?: 'primary' | 'highlight'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function finish() {
    setBusy(true)
    // Best effort: a failed write just means the welcome shows once more.
    await fetch('/api/onboarding', { method: 'POST' }).catch(() => null)
    router.push(href)
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={finish}
      disabled={busy}
      className={cn(
        'group inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-70',
        variant === 'highlight'
          ? 'bg-highlight text-highlight-foreground shadow-[0_6px_20px_rgba(242,169,59,0.35)]'
          : 'bg-primary text-primary-foreground shadow-sm hover:shadow-[var(--shadow-primary)]',
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {label}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  )
}
