'use client'

import { useId, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Small, consistent form primitives for the profile + registration forms.
 * Label/hint are wired to the control with ids so screen readers announce
 * them; `required` shows a marker without relying on colour alone.
 */

const control =
  'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/30 h-10 w-full rounded-lg border px-3 text-sm outline-none transition-shadow focus-visible:ring-3 disabled:bg-muted disabled:text-muted-foreground'

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="flex items-baseline justify-between gap-2 text-sm font-medium">
        <span>
          {label}
          {required ? <span className="text-destructive ml-0.5" aria-hidden>*</span> : null}
        </span>
        {hint ? <span className="text-muted-foreground text-xs font-normal">{hint}</span> : null}
      </span>
      {children}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  className,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (v: string) => void
}) {
  return <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={cn(control, className)} />
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  className,
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <textarea
      {...rest}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(control, 'h-auto resize-y py-2 leading-relaxed', className)}
    />
  )
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(control, !value && 'text-muted-foreground')}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/**
 * Chip input: type and press Enter or comma to add; Backspace on empty
 * removes the last; paste a comma-separated list to add many. Deduped
 * case-insensitively.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  max = 40,
  suggestions = [],
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  max?: number
  suggestions?: string[]
}) {
  const [draft, setDraft] = useState('')
  const listId = useId()
  const add = (raw: string) => {
    const incoming = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (!incoming.length) return
    const seen = new Set(value.map((v) => v.toLowerCase()))
    const next = [...value]
    for (const t of incoming) {
      if (next.length >= max) break
      if (!seen.has(t.toLowerCase())) {
        seen.add(t.toLowerCase())
        next.push(t.slice(0, 60))
      }
    }
    onChange(next)
    setDraft('')
  }
  return (
    <div className={cn(control, 'flex h-auto min-h-10 flex-wrap items-center gap-1.5 py-1.5')}>
      {value.map((t) => (
        <span key={t} className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs font-medium">
          {t}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="hover:bg-primary/10 grid size-4 place-items-center rounded"
            aria-label={`Remove ${t}`}
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        value={draft}
        list={suggestions.length ? listId : undefined}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) add(e.target.value)
          else setDraft(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(draft)
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => add(draft)}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          if (text.includes(',')) {
            e.preventDefault()
            add(text)
          }
        }}
        placeholder={value.length >= max ? '' : placeholder}
        disabled={value.length >= max}
        className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
      />
      {suggestions.length ? (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </div>
  )
}
