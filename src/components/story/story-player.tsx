'use client'

import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'

import { cn } from '@/lib/utils'

export type Chapter = {
  id: string
  eyebrow?: string
  title: string
  body: string
  art: ReactNode
}

const REDUCED = '(prefers-reduced-motion: reduce)'
function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(REDUCED)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  )
}

/**
 * "Story mode": chapters with Instagram-style progress segments.
 *
 *   - The active segment fills with a CSS animation; its animationend moves
 *     to the next chapter, so pausing is just animation-play-state.
 *   - Hover / focus pauses; tap the left or right edge (or ←/→) to step.
 *   - Each chapter's art re-mounts (key), so its choreography replays.
 *   - Reduced motion: no auto-advance and no fill — the reader steps.
 *   - `loop` restarts after the last chapter; otherwise it rests on it.
 */
export function StoryPlayer({
  chapters,
  durationMs = 6500,
  loop = true,
  tone = 'dark',
  className,
  lastChapterCta,
}: {
  chapters: Chapter[]
  durationMs?: number
  loop?: boolean
  /** 'dark' = white text on the forest surface (both uses today). */
  tone?: 'dark'
  className?: string
  /** Shown under the caption of the last chapter (a server-renderable element, not a function). */
  lastChapterCta?: ReactNode
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const reduced = useReducedMotion()
  const last = chapters.length - 1
  const c = chapters[index]!
  const running = !reduced && !paused && !hovered && (loop || index < last)

  const go = (i: number) => setIndex(((i % chapters.length) + chapters.length) % chapters.length)
  const next = () => (index === last ? (loop ? go(0) : undefined) : go(index + 1))
  const prev = () => go(index - 1)

  return (
    <section
      aria-roledescription="story"
      aria-label="How SelectIQ works"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') next()
        if (e.key === 'ArrowLeft') prev()
        if (e.key === ' ') {
          e.preventDefault()
          setPaused((p) => !p)
        }
      }}
      className={cn('relative flex flex-col outline-none', tone === 'dark' && 'text-white', className)}
    >
      {/* Progress segments */}
      <div className="flex items-center gap-1.5">
        {chapters.map((ch, i) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`Chapter ${i + 1}: ${ch.title}`}
            aria-current={i === index ? 'step' : undefined}
            className="group h-4 flex-1 py-1.5"
          >
            <span className="block h-1 overflow-hidden rounded-full bg-white/20 transition-colors group-hover:bg-white/30">
              {i < index || (reduced && i === index) ? (
                <span className="block h-full w-full rounded-full bg-white" />
              ) : i === index ? (
                <span
                  key={`${index}-${loop}`}
                  className="siq-story-fill block h-full w-full rounded-full bg-white"
                  style={{ '--dur': `${durationMs}ms`, animationPlayState: running ? 'running' : 'paused' } as React.CSSProperties}
                  onAnimationEnd={next}
                />
              ) : null}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? 'Play story' : 'Pause story'}
          className="ml-1 grid size-7 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          {paused || reduced ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
        </button>
      </div>

      {/* Art — tap zones on either side */}
      <div className="relative mt-6 flex-1">
        <div key={c.id} className="relative h-full min-h-[300px]" aria-hidden>
          {c.art}
        </div>
        <button type="button" onClick={prev} aria-label="Previous chapter" className="group absolute inset-y-0 left-0 w-1/4">
          <ChevronLeft className="absolute top-1/2 left-0 size-6 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
        </button>
        <button type="button" onClick={next} aria-label="Next chapter" className="group absolute inset-y-0 right-0 w-1/4">
          <ChevronRight className="absolute top-1/2 right-0 size-6 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
        </button>
      </div>

      {/* Caption */}
      <div key={`cap-${c.id}`} className="mt-6" aria-live="polite">
        {c.eyebrow ? (
          <p className="siq-in-up text-highlight text-xs font-semibold tracking-wider uppercase">
            {String(index + 1).padStart(2, '0')} · {c.eyebrow}
          </p>
        ) : null}
        <h2 className="siq-in-up mt-2 text-[26px] leading-tight font-semibold tracking-tight" style={{ '--d': '80ms' } as React.CSSProperties}>
          {c.title}
        </h2>
        <p className="siq-in-up mt-2 max-w-md text-[15px] leading-relaxed text-white/75" style={{ '--d': '160ms' } as React.CSSProperties}>
          {c.body}
        </p>
        {lastChapterCta && index === last ? (
          <div className="siq-in-up mt-5" style={{ '--d': '240ms' } as React.CSSProperties}>
            {lastChapterCta}
          </div>
        ) : null}
      </div>
    </section>
  )
}
