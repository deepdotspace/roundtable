/** Live presence rail — who's in the room, who's typing, host controls. */
import { getUserColor } from 'deepspace'
import { Crown, UserMinus, Users } from 'lucide-react'
import { cn } from '../ui/utils'

export interface Peer {
  userId: string
  userName?: string
  userImageUrl?: string
  state?: { typing?: boolean; cursor?: { x: number; y: number } }
  isSelf?: boolean
}

interface Props {
  peers: Peer[]
  hostId: string
  hostName: string
  currentUserId: string
  onRemove?: (userId: string, name: string) => void
}

export function ParticipantRail({ peers, hostId, hostName, currentUserId, onRemove }: Props) {
  const isHost = currentUserId === hostId
  // Stable order: host first, then self, then by name.
  const sorted = [...peers].sort((a, b) => {
    if (a.userId === hostId) return -1
    if (b.userId === hostId) return 1
    if (a.isSelf) return -1
    if (b.isSelf) return 1
    return (a.userName ?? '').localeCompare(b.userName ?? '')
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        In the room
        <span
          data-testid="participant-count"
          className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-foreground"
        >
          {peers.length}
        </span>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {sorted.map((p) => {
          const color = getUserColor(p.userId)
          const typing = p.state?.typing
          const peerIsHost = p.userId === hostId
          return (
            <div
              key={p.userId}
              className="group/p flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-secondary/50"
            >
              <div className="relative shrink-0">
                {p.userImageUrl ? (
                  <img
                    src={p.userImageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full object-cover ring-2"
                    style={{ ['--tw-ring-color' as string]: color }}
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: color }}
                  >
                    {(p.userName?.[0] ?? '?').toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {p.userName || 'Guest'}
                  </span>
                  {p.isSelf && <span className="text-[10px] text-muted-foreground">you</span>}
                  {peerIsHost && (
                    <Crown className="h-3 w-3 shrink-0 text-amber-400" aria-label="Host" />
                  )}
                </div>
                <div className="h-3 text-[11px] text-primary">
                  {typing && (
                    <span className="inline-flex items-center gap-1">
                      <span className="flex gap-0.5">
                        <i className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
                        <i className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
                        <i className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
                      </span>
                      typing
                    </span>
                  )}
                </div>
              </div>
              {isHost && !peerIsHost && !p.isSelf && onRemove && (
                <button
                  onClick={() => onRemove(p.userId, p.userName || 'this participant')}
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all',
                    'hover:bg-destructive/15 hover:text-destructive group-hover/p:opacity-100',
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
      <div className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        Hosted by <span className="font-medium text-foreground">{hostName || 'the host'}</span>
      </div>
    </div>
  )
}
