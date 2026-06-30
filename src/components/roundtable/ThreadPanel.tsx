/** Side thread — a branched sub-conversation rooted at one assistant reply. */
import { X, GitBranch } from 'lucide-react'
import { MessageItem } from './MessageItem'
import { PromptBox } from './PromptBox'
import type { Envelope, MessageData, ReactionData } from '../../lib/roundtable'

interface Props {
  rootId: string
  root?: Envelope<MessageData>
  messages: Envelope<MessageData>[]
  reactionsFor: (messageId: string) => Envelope<ReactionData>[]
  currentUserId: string
  model: string
  setModel: (id: string) => void
  busy: boolean
  ready: boolean
  onClose: () => void
  onSend: (text: string, askAi: boolean) => void
  onTyping: (typing: boolean) => void
  onToggleReaction: (messageId: string, emoji: string) => void
  onDelete: (messageId: string) => void
}

export function ThreadPanel({
  rootId, root, messages, reactionsFor, currentUserId, model, setModel,
  busy, ready, onClose, onSend, onTyping, onToggleReaction, onDelete,
}: Props) {
  return (
    <div className="flex h-full w-full flex-col bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 py-3">
        <GitBranch className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Side thread</span>
        <button
          onClick={onClose}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {root && (
          <div className="mb-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.05]">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Branched from</p>
            <p className="line-clamp-4 text-xs text-muted-foreground">{root.data.content}</p>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted-foreground">
            Replies here stay out of the main conversation. Ask a follow-up below.
          </p>
        ) : (
          messages.map((m) => (
            <MessageItem
              key={m.recordId}
              message={m}
              reactions={reactionsFor(m.recordId)}
              currentUserId={currentUserId}
              onToggleReaction={onToggleReaction}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      <div className="p-3">
        <PromptBox
          onSend={onSend}
          onTyping={onTyping}
          model={model}
          setModel={setModel}
          busy={busy}
          ready={ready}
          showModel={false}
          placeholder="Reply in this thread…"
        />
      </div>
      <input type="hidden" value={rootId} readOnly />
    </div>
  )
}
