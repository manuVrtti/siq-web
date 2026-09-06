'use client'

import { useCallback, useRef, useState, type DragEvent } from 'react'

import { Button } from '@/components/ui/button'
import { validateFile, type FileCategory } from '@/lib/validators/file'
import { cn } from '@/lib/utils'

/**
 * Plan 009 — drag-and-drop / click file upload.
 *
 * Validates client-side for fast feedback, then POSTs to /api/upload, which
 * re-validates server-side (the real gate). Calls `onUpload` with the returned
 * public URL.
 */
export default function FileUpload({
  category,
  onUpload,
  accept = 'image/jpeg,image/png,image/webp',
  className,
}: {
  category: FileCategory
  onUpload: (url: string) => void
  accept?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      const check = validateFile({ size: file.size, type: file.type }, category)
      if (!check.valid) {
        setError(check.error)
        return
      }

      setBusy(true)
      try {
        const form = new FormData()
        form.set('category', category)
        form.set('file', file)

        const res = await fetch('/api/upload', { method: 'POST', body: form })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json?.error?.message ?? 'Upload failed')
        }
        onUpload(json.data.url)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setBusy(false)
      }
    },
    [category, onUpload],
  )

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void handleFile(file)
    },
    [handleFile],
  )

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-6 py-8 text-center text-sm transition-colors',
          dragging ? 'border-primary bg-accent/50' : 'hover:border-current/40',
          busy && 'pointer-events-none opacity-60',
        )}
      >
        <span className="font-medium">{busy ? 'Uploading…' : 'Drop an image or click to browse'}</span>
        <span className="text-muted-foreground text-xs">PNG, JPG or WebP</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = '' // allow re-selecting the same file
        }}
      />

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="self-start"
      >
        Choose file
      </Button>
    </div>
  )
}
