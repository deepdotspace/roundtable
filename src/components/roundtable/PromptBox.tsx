/** The shared prompt composer. Sends a participant message + optionally pings the AI. */
import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUp, Sparkles } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui'
import { cn } from '../ui/utils'
import { MODELS } from '../../lib/roundtable'

interface Props {
  onSend: (text: string, askAi: boolean) => void
  onTyping: (typing: boolean) => void
  model: string
  setModel: (id: string) => void
  busy?: boolean
  ready?: boolean
  placeholder?: string
  showModel?: boolean
}

export function PromptBox({
  onSend, onTyping, model, setModel, busy, ready = true, placeholder, showModel = true,
}: Props) {
  const [text, setText] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pingTyping = () => {
    onTyping(true)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => onTyping(false), 1800)
  }

  const submit = (askAi: boolean) => {
    if (!ready) return
    const t = text.trim()
    if (!t) return
    onSend(t, askAi)
    setText('')
    onTyping(false)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    requestAnimationFrame(() => taRef.current?.focus())
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(true)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-2 shadow-lg backdrop-blur">
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => { setText(e.target.value); pingTyping() }}
        onKeyDown={onKeyDown}
        onBlur={() => onTyping(false)}
        rows={1}
        disabled={!ready}
        placeholder={ready ? (placeholder ?? 'Message the roundtable…  (Enter asks the AI, Shift+Enter for newline)') : 'Connecting to the room…'}
        className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
        style={{ height: 'auto' }}
        onInput={(e) => {
          const el = e.currentTarget
          el.style.height = 'auto'
          el.style.height = Math.min(el.scrollHeight, 160) + 'px'
        }}
      />
      <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
        {showModel ? (
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full border-border bg-background/60 px-3 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : <span />}

        <div className="flex items-center gap-2">
          <button
            onClick={() => submit(false)}
            disabled={busy || !ready || !text.trim()}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
            title="Post to the room without asking the AI"
          >
            Just post
          </button>
          <button
            onClick={() => submit(true)}
            disabled={busy || !ready || !text.trim()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40',
            )}
          >
            Ask AI
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
