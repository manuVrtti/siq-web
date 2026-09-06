'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import FileUpload from '@/components/ui/file-upload'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentUser } from '@/lib/auth/user-context'

/**
 * Plan 009 — edit your profile: name + avatar.
 *
 * Avatar upload and name save are separate actions. The avatar uploads
 * immediately (via /api/upload) and its URL is persisted straight away so it
 * is not lost if the name save is never clicked.
 */
export default function ProfileForm() {
  const user = useCurrentUser()
  const router = useRouter()

  const [name, setName] = useState(user?.name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)

  if (!user) return null

  async function patch(data: Record<string, string>) {
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message ?? 'Update failed')
    }
    // Re-run server components so the app shell picks up the change.
    router.refresh()
  }

  async function onAvatarUploaded(url: string) {
    setAvatarUrl(url)
    setStatus(null)
    try {
      await patch({ avatarUrl: url })
      setStatus({ kind: 'ok', msg: 'Photo updated.' })
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Update failed' })
    }
  }

  async function onSaveName() {
    setSaving(true)
    setStatus(null)
    try {
      await patch({ name: name.trim() })
      setStatus({ kind: 'ok', msg: 'Saved.' })
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const initials = (name || user.email || '?').slice(0, 2).toUpperCase()

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <FileUpload category="avatar" onUpload={onAvatarUploaded} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-medium">
          Display name
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={120}
        />
        <Button onClick={onSaveName} disabled={saving || !name.trim()} className="self-start">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {status && (
        <p
          role="status"
          className={status.kind === 'ok' ? 'text-sm text-green-600' : 'text-destructive text-sm'}
        >
          {status.msg}
        </p>
      )}
    </div>
  )
}
