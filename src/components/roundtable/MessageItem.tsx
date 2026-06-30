/** A single message bubble — participant or AI — with reactions + branch. */
import { useMemo, useState } from 'react'
import { getUserColor } from 'deepspace'
import { Sparkles, GitBranch, SmilePlus, Trash2, MessageSquare } from 'lucide-react'
import { Markdown } from './Markdown'
import { cn } from '../ui/utils'
import { REACTION_EMOJIS, type Envelope, type MessageData, type ReactionData } from '../../lib/roundtable'

interface Props {
  message: Envelope<MessageData>
  reactions: Envelope<ReactionData>[]
  currentUserId: string
  canModerate: boolean
  threadCount?: number
  onToggleReaction: (messageId: string, emoji: string) => void
  onBranch?: (messageId: string) => void
  onOpenThread?: (messageId: string) => void
  onDelete?: (messageId: string) => void
}

export function MessageItem({
  message,
  reactions,
  currentUserId,
  canModerate,
  threadCount = 0,
  onToggleReaction,
  onBranch,
  onOpenThread,
  onDelete,
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
      className={cn('group/msg relative flex gap-3 px-1', isMine && !isAI && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        {isAI ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-inset ring-primary/40 shadow-[0_0_12px_-2px_var(--color-primary)]">
            <Sparkles className="h-4 w-4" />
          </div>
        ) : m.authorImage ? (
          <img
            src={m.authorImage}
            alt=""
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full object-cover ring-1 ring-inset ring-border"
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: color }}
          >
            {(m.authorName?.[0] ?? '?').toUpperCase()}
          </div>
        )}
      </div>

      {/* Body */}
      <div className={cn('flex min-w-0 max-w-[78%] flex-col', isMine && !isAI && 'items-end')}>
        <div className={cn('mb-1 flex items-center gap-2', isMine && !isAI && 'flex-row-reverse')}>
          <span className={cn('text-xs font-semibold', isAI ? 'text-primary' : 'text-foreground')}>
            {isAI ? 'Roundtable AI' : m.authorName || 'Someone'}
          </span>
          {isAI && m.model && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/80">
              {m.model.replace('claude-', '').replace(/-\d+$/, '')}
            </span>
          )}
        </div>

        <div
          className={cn(
            'relative rounded-2xl px-4 py-2.5 text-sm',
            isAI
              ? 'border border-primary/25 bg-primary/[0.06] text-foreground'
              : isMine
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-foreground',
          )}
        >
          {m.content ? (
            isAI ? (
              <Markdown>{m.content}</Markdown>
            ) : (
              <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
            )
          ) : streaming ? (
            <span className="inline-flex gap-1 py-1">
              <Dot /> <Dot delay={150} /> <Dot delay={300} />
            </span>
          ) : null}
          {streaming && m.content && (
            <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary align-middle" />
          )}
        </div>

        {/* Reaction chips */}
        {grouped.length > 0 && (
          <div className={cn('mt-1.5 flex flex-wrap gap-1', isMine && !isAI && 'justify-end')}>
            {grouped.map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => onToggleReaction(message.recordId, emoji)}
                title={info.names.join(', ')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                  info.mine
                    ? 'border-primary/40 bg-primary/15 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary',
                )}
              >
                <span>{emoji}</span>
                <span className="tabular-nums">{info.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread affordance */}
        {threadCount > 0 && onOpenThread && (
          <button
            onClick={() => onOpenThread(message.recordId)}
            className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <MessageSquare className="h-3 w-3" />
            {threadCount} in thread
          </button>
        )}
      </div>

      {/* Hover toolbar */}
      <div
        className={cn(
          'absolute -top-3 z-10 flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 opacity-0 shadow-lg transition-opacity group-hover/msg:opacity-100',
          isMine && !isAI ? 'left-12' : 'right-2',
        )}
      >
        <div className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="React"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 top-7 z-20 flex gap-0.5 rounded-full border border-border bg-card p-1 shadow-xl">
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { onToggleReaction(message.recordId, e); setPickerOpen(false) }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-base hover:bg-secondary"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {isAI && onBranch && (
          <button
            onClick={() => onBranch(message.recordId)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Branch into a thread"
          >
            <GitBranch className="h-3.5 w-3.5" />
          </button>
        )}
        {(isMine || canModerate) && onDelete && (
          <button
            onClick={() => onDelete(message.recordId)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60"
      style={{ animationDelay: `${delay}ms` }}
    />
  )
}
