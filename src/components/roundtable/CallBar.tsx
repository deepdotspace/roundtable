/**
 * CallBar — the voice-call surface for a Roundtable.
 *
 * Renders a "Join call" trigger in the header and, once connected, a strip of
 * call participants (with live speaking rings + mute state) plus mic/leave
 * controls. Audio runs over LiveKit via {@link useCall}. `othersOnCall` comes
 * from presence so people who haven't joined still see that a call is live.
 */
import { useEffect } from 'react'
import { getUserColor } from 'deepspace'
import { Phone, PhoneOff, Mic, MicOff, Volume2, Loader2 } from 'lucide-react'
import { useCall, type CallParticipant } from './useCall'
import { Button } from '../ui'
import { cn } from '../ui/utils'

interface Props {
  roomId: string
  displayName: string
  /** Count of other people currently on the call (from presence). */
  othersOnCall: number
  /** Broadcast our own on-call state so others see the live count. */
  onActiveChange: (active: boolean) => void
}

function CallAvatar({ p }: { p: CallParticipant }) {
  return (
    <div className="relative" title={p.isLocal ? `${p.name} (you)` : p.name}>
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 transition-shadow',
          p.isSpeaking ? 'ring-emerald-400' : 'ring-background',
        )}
        style={{ background: getUserColor(p.identity) }}
      >
        {(p.name?.[0] ?? '?').toUpperCase()}
      </span>
      <span
        className={cn(
          'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background',
          p.isMuted ? 'bg-secondary text-muted-foreground' : 'bg-emerald-500 text-white',
        )}
      >
        {p.isMuted ? <MicOff className="h-2 w-2" /> : <Mic className="h-2 w-2" />}
      </span>
    </div>
  )
}

export function CallBar({ roomId, displayName, othersOnCall, onActiveChange }: Props) {
  const { status, participants, micEnabled, audioBlocked, join, leave, toggleMic, enableAudio } = useCall(roomId, displayName)

  const active = status === 'connected'
  useEffect(() => {
    onActiveChange(active)
  }, [active, onActiveChange])

  if (!active) {
    const connecting = status === 'connecting'
    return (
      <button
        onClick={join}
        disabled={connecting}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
          'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-70',
        )}
        title={status === 'error' ? 'Call failed — tap to retry' : 'Join the voice call'}
      >
        {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
        <span>{connecting ? 'Connecting…' : status === 'error' ? 'Retry call' : 'Join call'}</span>
        {othersOnCall > 0 && !connecting && (
          <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500/30 px-1 text-[10px] tabular-nums">
            {othersOnCall}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2 rounded-full bg-emerald-500/10 py-1 pl-2 pr-1">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <div className="flex -space-x-1.5">
        {participants.map((p) => (
          <CallAvatar key={p.identity} p={p} />
        ))}
      </div>

      {audioBlocked && (
        <Button size="sm" variant="ghost" onClick={enableAudio} className="h-7 gap-1 px-2 text-xs text-amber-300">
          <Volume2 className="h-3.5 w-3.5" /> Enable audio
        </Button>
      )}

      <button
        onClick={toggleMic}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
          micEnabled ? 'text-foreground hover:bg-white/[0.08]' : 'bg-destructive/20 text-destructive hover:bg-destructive/30',
        )}
        title={micEnabled ? 'Mute' : 'Unmute'}
      >
        {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={leave}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/90 text-white transition-colors hover:bg-destructive"
        title="Leave call"
      >
        <PhoneOff className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
