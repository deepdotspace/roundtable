/** Minimal account affordance — just an avatar that opens a sign-out menu. */
import { signOut, useUser, getUserColor } from 'deepspace'
import { LogOut } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '../ui'

export function UserMenu() {
  const { user } = useUser()
  if (!user) return null
  const color = getUserColor(user.id)
  const initial = (user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account"
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white outline-none ring-offset-2 ring-offset-background transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
          style={{ background: user.imageUrl ? undefined : color }}
        >
          {user.imageUrl ? (
            <img src={user.imageUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <div className="truncate text-sm font-medium text-foreground">{user.name || 'Signed in'}</div>
          {user.email && <div className="truncate text-xs text-muted-foreground">{user.email}</div>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="gap-2 text-muted-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
