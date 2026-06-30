/** A single message — author-grouped, left-aligned. AI replies are distinct. */
import { useMemo, useState } from 'react'
import { getUserColor } from 'deepspace'
import { GitBranch, SmilePlus, Trash2, MessagesSquare } from 'lucide-react'
import { Markdown } from './Markdown'
import { cn } from '../ui/utils'
import { REACTION_EMOJIS, type Envelope, type MessageData, type ReactionData } from '../../lib/roundtable'

interface Props {
  message: Envelope<MessageData>
  reactions: Envelope<ReactionData>[]
  currentUserId: string
  showHeader?: boolean
  threadCount?: number
  onToggleReaction: (messageId: string, emoji: string) => void
  onBranch?: (messageId: string) => void
  onOpenThread?: (messageId: string) => void
  onDelete?: (messageId: string) => void
}

function timeOf(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function MessageItem({
  message, reactions, currentUserId, showHeader = true, threadCount = 0,
  onToggleReaction, onBranch, onOpenThread, onDelete,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const m = message.data
  const isAI = m.senderKind === 'ai'
  const isMine = m.authorId === currentUserId
  const streaming = m.status === 'streaming'
  const color = getUserColor(m.authorId || 'ai')

  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean; names: string[] }>()
    for (const r of reactions) {
      const e = r.data.emoji
      const cur = map.get(e) ?? { count: 0, mine: false, names: [] }
      cur.count += 1
      cur.names.push(r.data.userName || 'Someone')
      if (r.data.userId === currentUserId) cur.mine = true
      map.set(e, cur)
    }
    return [...map.entries()]
  }, [reactions, currentUserId])

  return (
    <div
      data-testid="message"
      data-sender={isAI ? 'ai' : 'participant'}
      data-status={m.status}
      className={cn('group/msg relative flex gap-3 rounded-xl px-2 -mx-2 py-1 transition-colors hover:bg-white/[0.02]', showHeader && 'mt-3')}
    >
      {/* Gutter: avatar (group start) or hover timestamp */}
      <div className="w-8 shrink-0">
        {showHeader ? (
          isAI ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold tracking-tight text-primary ring-1 ring-inset ring-primary/30">
              AI
            </div>
          ) : m.authorImage ? (
            <img src={m.authorImage} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: color }}>
              {(m.authorName?.[0] ?? '?').toUpperCase()}
            </div>
          )
        ) : (
          <span className="mt-1 hidden select-none text-right text-[10px] tabular-nums leading-5 text-muted-foreground group-hover/msg:block">
            {timeOf(message.createdAt)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className={cn('text-sm font-semibold', isAI ? 'text-primary' : 'text-foreground')}>
              {isAI ? 'Assistant' : m.authorName || 'Someone'}
            </span>
            {isMine && !isAI && <span className="text-[10px] text-muted-foreground">you</span>}
            {isAI && m.model && (
              <span className="rounded bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary/70">
                {m.model.replace('claude-', '').replace(/-\d.*$/, '')}
              </span>
            )}
            <span className="text-[11px] tabular-nums text-muted-foreground">{timeOf(message.createdAt)}</span>
          </div>
        )}

        <div className={cn(isAI && 'rounded-xl border-l-2 border-primary/40 bg-primary/[0.04] px-3.5 py-2.5')}>
          {m.content ? (
            isAI ? (
              <Markdown>{m.content}</Markdown>
            ) : (
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/90">{m.content}</p>
            )
          ) : streaming ? (
            <span className="inline-flex gap-1 py-1.5">
              <Dot /> <Dot delay={150} /> <Dot delay={300} />
            </span>
          ) : null}
          {streaming && m.content && (
            <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary align-middle" />
          )}
        </div>

        {grouped.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {grouped.map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => onToggleReaction(message.recordId, emoji)}
                title={info.names.join(', ')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors',
                  info.mine ? 'bg-primary/15 text-foreground ring-1 ring-inset ring-primary/30' : 'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]',
                )}
              >
                <span>{emoji}</span>
                <span className="tabular-nums">{info.count}</span>
              </button>
            ))}
          </div>
        )}

        {threadCount > 0 && onOpenThread && (
          <button
            onClick={() => onOpenThread(message.recordId)}
            className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
          >
            <MessagesSquare className="h-3 w-3" />
            {threadCount} {threadCount === 1 ? 'reply' : 'replies'} in thread
          </button>
        )}
      </div>

      {/* Hover toolbar */}
      <div className="absolute -top-2 right-1 z-10 flex items-center gap-0.5 rounded-full bg-card/95 p-0.5 opacity-0 shadow-lg ring-1 ring-white/[0.06] backdrop-blur transition-opacity group-hover/msg:opacity-100">
        <div className="relative">
          <button onClick={() => setPickerOpen((v) => !v)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-white/[0.06] hover:text-foreground" title="React">
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 top-8 z-20 flex gap-0.5 rounded-full bg-card p-1 shadow-xl ring-1 ring-white/[0.08]">
                {REACTION_EMOJIS.map((e) => (
                  <button key={e} onClick={() => { onToggleReaction(message.recordId, e); setPickerOpen(false) }} className="flex h-7 w-7 items-center justify-center rounded-full text-base hover:bg-white/[0.06]">
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {isAI && onBranch && (
          <button onClick={() => onBranch(message.recordId)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-white/[0.06] hover:text-foreground" title="Branch into a thread">
            <GitBranch className="h-3.5 w-3.5" />
          </button>
        )}
        {isMine && onDelete && (
          <button onClick={() => onDelete(message.recordId)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function Dot({ delay = 0 }: { delay?: number }) {
  return <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: `${delay}ms` }} />
}
