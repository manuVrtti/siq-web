'use client'

import { useSyncExternalStore } from 'react'
import { ArrowRight, PlayCircle, X } from 'lucide-react'

import { BrandMark } from '@/components/brand/mark'
import type { Chapter } from '@/components/story/story-player'
import { StoryPlayer } from '@/components/story/story-player'

const KEY = 'siq:intro-seen'
const EVENT = 'siq-intro'

function read(): 'seen' | 'new' {
  try {
    return localStorage.getItem(KEY) ? 'seen' : 'new'
  } catch {
    return 'seen' // storage blocked: never trap anyone behind the intro
  }
}
function write(seen: boolean) {
  try {
    if (seen) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {}
  window.dispatchEvent(new Event(EVENT))
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/**
 * Phones only (the desktop login shows the story beside the form): a
 * full-screen story before sign-in, once per device. "Get started" or the
 * close button go to the form; "See how SelectIQ works" brings it back.
 * Remembered in localStorage — a per-device convenience, nothing more.
 */
export function MobileIntro({ chapters }: { chapters: Chapter[] }) {
  // Server snapshot 'seen' = render nothing until the client knows.
  const state = useSyncExternalStore(subscribe, read, () => 'seen' as const)

  if (state === 'seen') {
    return (
      <button
        type="button"
        onClick={() => write(false)}
        className="text-primary mx-auto mt-6 inline-flex items-center gap-1.5 text-sm font-semibold lg:hidden"
      >
        <PlayCircle className="size-4" aria-hidden /> See how SelectIQ works
      </button>
    )
  }

  return (
    <div className="bg-primary siq-page fixed inset-0 z-50 flex flex-col overflow-y-auto px-5 pt-5 pb-8 lg:hidden" role="dialog" aria-modal="true" aria-label="Welcome to SelectIQ">
      <div className="siq-dots pointer-events-none fixed inset-0 opacity-50" aria-hidden />
      <div className="bg-highlight/20 pointer-events-none fixed -right-24 -bottom-24 size-80 rounded-full blur-3xl" aria-hidden />
      <div className="relative mb-5 flex items-center justify-between text-white">
        <span className="flex items-center gap-2">
          <BrandMark className="size-7" />
          <span className="font-display text-sm font-semibold">SelectIQ</span>
        </span>
        <button type="button" onClick={() => write(true)} aria-label="Skip intro" className="grid size-9 place-items-center rounded-full bg-white/10">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <StoryPlayer
        chapters={chapters}
        loop={false}
        className="relative flex-1"
        lastChapterCta={
          <button
            type="button"
            onClick={() => write(true)}
            className="bg-highlight text-highlight-foreground inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-[0_6px_20px_rgba(242,169,59,0.35)] active:scale-[0.98]"
          >
            Get started <ArrowRight className="size-4" aria-hidden />
          </button>
        }
      />
      <button type="button" onClick={() => write(true)} className="relative mt-4 text-sm font-medium text-white/70">
        Skip — take me to sign in
      </button>
    </div>
  )
}
