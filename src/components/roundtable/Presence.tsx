/** Live presence — an overlapping avatar stack that opens a roster popover. */
import { getUserColor } from 'deepspace'
import { Crown, UserMinus } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '../ui'
import { cn } from '../ui/utils'

export interface Peer {
  userId: string
  userName?: string
  userImageUrl?: string
  state?: { typing?: boolean; cursor?: { x: number; y: number } }
  isSelf?: boolean
}

function Dot() {
  return (
    <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400" />
  )
}

function PeerAvatar({ p, size = 28 }: { p: Peer; size?: number }) {
  const color = getUserColor(p.userId)
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold text-white ring-2 ring-background"
      style={{ width: size, height: size, background: p.userImageUrl ? undefined : color }}
    >
      {p.userImageUrl ? (
        <img src={p.userImageUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : (
        (p.userName?.[0] ?? '?').toUpperCase()
      )}
    </span>
  )
}

interface Props {
  peers: Peer[]
  hostId: string
  currentUserId: string
  onRemove?: (userId: string, name: string) => void
}

export function PresenceStack({ peers, hostId, currentUserId, onRemove }: Props) {
  const isHost = currentUserId === hostId
  const sorted = [...peers].sort((a, b) => {
    if (a.userId === hostId) return -1
    if (b.userId === hostId) return 1
    if (a.isSelf) return -1
    if (b.isSelf) return 1
    return (a.userName ?? '').localeCompare(b.userName ?? '')
  })
  const shown = sorted.slice(0, 4)
  const extra = peers.length - shown.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="group flex items-center rounded-full pl-1 pr-2 py-1 outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Participants"
        >
          <span className="flex -space-x-2">
            {shown.map((p) => (
              <span key={p.userId} className="relative">
                <PeerAvatar p={p} />
                {p.state?.typing && (
                  <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 animate-ping rounded-full bg-primary" />
                )}
              </span>
            ))}
            {extra > 0 && (
              <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground ring-2 ring-background">
                +{extra}
              </span>
            )}
          </span>
          <span data-testid="participant-count" className="ml-2 text-xs font-medium tabular-nums text-muted-foreground">
            {peers.length}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          In the room · {peers.length}
        </div>
        <div className="space-y-0.5">
          {sorted.map((p) => {
            const peerIsHost = p.userId === hostId
            return (
              <div key={p.userId} className="group/row flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
                <div className="relative">
                  <PeerAvatar p={p} size={30} />
                  <Dot />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm text-foreground">{p.userName || 'Guest'}</span>
                    {p.isSelf && <span className="text-[10px] text-muted-foreground">you</span>}
                    {peerIsHost && <Crown className="h-3 w-3 shrink-0 text-amber-400" aria-label="Host" />}
                  </div>
                  {p.state?.typing && <div className="text-[11px] text-primary">typing…</div>}
                </div>
                {isHost && !peerIsHost && !p.isSelf && onRemove && (
                  <button
                    onClick={() => onRemove(p.userId, p.userName || 'this participant')}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all',
                      'hover:bg-destructive/15 hover:text-destructive group-hover/row:opacity-100',
                    )}
                    title="Remove from room"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
