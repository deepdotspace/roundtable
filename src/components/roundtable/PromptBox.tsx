/** Shared composer. Send posts to the room; Ask posts and the assistant replies. */
import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUp, ChevronDown } from 'lucide-react'
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

  const disabled = busy || !ready || !text.trim()

  return (
    <div className="rounded-[20px] bg-white/[0.04] p-2 ring-1 ring-white/[0.07] backdrop-blur transition-shadow focus-within:ring-white/[0.14]">
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => { setText(e.target.value); pingTyping() }}
        onKeyDown={onKeyDown}
        onBlur={() => onTyping(false)}
        rows={1}
        disabled={!ready}
        placeholder={ready ? (placeholder ?? 'Message the room…') : 'Connecting…'}
        className="max-h-44 min-h-[40px] w-full resize-none bg-transparent px-3 py-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
        onInput={(e) => {
          const el = e.currentTarget
          el.style.height = 'auto'
          el.style.height = Math.min(el.scrollHeight, 176) + 'px'
        }}
      />
      <div className="flex items-center justify-between gap-2 pl-1 pr-0.5">
        {showModel ? (
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-7 w-auto gap-1 rounded-full border-0 bg-white/[0.04] px-2.5 text-xs text-muted-foreground hover:bg-white/[0.07] [&>svg]:hidden">
              <SelectValue />
              <ChevronDown className="h-3 w-3 opacity-60" />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : <span className="text-[11px] text-muted-foreground/70 pl-1.5">Enter to ask · Shift+Enter for a new line</span>}

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => submit(false)}
            disabled={disabled}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-40"
            title="Post to the room without a reply"
          >
            Send
          </button>
          <button
            onClick={() => submit(true)}
            disabled={disabled}
            className={cn('inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40')}
            title="Post and get a reply from the assistant"
          >
            Ask
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
