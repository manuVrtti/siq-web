'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { LogOut, Settings as SettingsIcon, User as UserIcon } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentUser } from '@/lib/auth/user-context'
import { getFirebaseAuth } from '@/lib/firebase-client'

/** First letters of the name, or the email's first character. */
function initials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('')
  }
  return email?.[0]?.toUpperCase() ?? '?'
}

/**
 * Plan 008 — avatar with account menu.
 *
 * Sign-out clears the server session first, then Firebase client state. If the
 * request fails we stop: showing a signed-out UI while the HTTP-only cookie
 * still grants access would be worse than an error.
 */
export default function UserMenu() {
  const user = useCurrentUser()
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleSignOut = useCallback(async () => {
    setPending(true)
    try {
      const res = await fetch('/api/auth/session', { method: 'DELETE' })
      if (!res.ok) throw new Error('sign out failed')
      await signOut(getFirebaseAuth())
      router.replace('/login')
      router.refresh()
    } catch {
      setPending(false)
    }
  }, [router])

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="size-9 rounded-full p-0" aria-label="Account menu" />
        }
      >
        <Avatar className="size-9">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{user.name ?? 'Account'}</span>
            <span className="text-muted-foreground truncate text-xs">
              {user.email ?? user.phone ?? ''}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => router.push('/profile')}>
          <UserIcon className="size-4" aria-hidden />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <SettingsIcon className="size-4" aria-hidden />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleSignOut} disabled={pending} variant="destructive">
          <LogOut className="size-4" aria-hidden />
          {pending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
