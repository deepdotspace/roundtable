/** The live Roundtable — mounted inside a per-room RecordScope (`rt:<id>`). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutations, useUser, usePresenceRoom } from 'deepspace'
import { ArrowLeft, Check, Link2, MoreHorizontal, Pencil, Eraser } from 'lucide-react'
import { MessageItem } from './MessageItem'
import { PromptBox } from './PromptBox'
import { PresenceStack, type Peer } from './Presence'
import { CallBar } from './CallBar'
import { Cursors } from './Cursors'
import { ThreadPanel } from './ThreadPanel'
import { UserMenu } from './UserMenu'
import {
  Button, ConfirmModal, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, useToast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui'
import { cn } from '../ui/utils'
import {
  askAI, clearRoom, renameRoom, removeParticipant, MAIN_THREAD,
  type AskHistoryTurn, type Envelope, type MessageData, type ReactionData, type RoomData,
} from '../../lib/roundtable'

interface Props {
  roomId: string
  room: Envelope<RoomData>
}

const GROUP_GAP_MS = 5 * 60 * 1000

export function RoomView({ roomId, room }: Props) {
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const { user } = useUser()
  const myId = user?.id ?? ''
  const isHost = myId === room.data.hostId

  const { records: rawMessages, status: msgStatus } = useQuery<MessageData>('messages', { orderBy: 'createdAt', orderDir: 'asc' })
  const roomReady = msgStatus === 'ready'
  const { records: rawReactions } = useQuery<ReactionData>('reactions')
  const allMessages = rawMessages as unknown as Envelope<MessageData>[]
  const reactions = rawReactions as unknown as Envelope<ReactionData>[]

  const clearedAt = room.data.clearedAt ? new Date(room.data.clearedAt).getTime() : 0
  const messages = useMemo(
    () => (clearedAt ? allMessages.filter((m) => new Date(m.createdAt).getTime() > clearedAt) : allMessages),
    [allMessages, clearedAt],
  )

  const msgMut = useMutations<MessageData>('messages')
  const reactMut = useMutations<ReactionData>('reactions')
  const { peers: rawPeers, updateState } = usePresenceRoom(`rt:${roomId}`)

  const [model, setModel] = useState('claude-sonnet-4-6')
  const [busy, setBusy] = useState(false)
  const [threadBusy, setThreadBusy] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(room.data.title)
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const cursorThrottle = useRef(0)

  // ---- Derived ----
  const mainMessages = useMemo(
    () => messages.filter((m) => !m.data.parentId || m.data.parentId === MAIN_THREAD),
    [messages],
  )
  // Group consecutive messages from the same author (hide the avatar/name then).
  const rendered = useMemo(() => {
    return mainMessages.map((m, i) => {
      const prev = mainMessages[i - 1]
      const showHeader = !prev
        || prev.data.authorId !== m.data.authorId
        || prev.data.senderKind !== m.data.senderKind
        || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_GAP_MS
      return { m, showHeader }
    })
  }, [mainMessages])

  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, Envelope<ReactionData>[]>()
    for (const r of reactions) {
      const arr = map.get(r.data.messageId) ?? []
      arr.push(r)
      map.set(r.data.messageId, arr)
    }
    return map
  }, [reactions])
  const threadCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of messages) {
      const pid = m.data.parentId
      if (pid && pid !== MAIN_THREAD) map.set(pid, (map.get(pid) ?? 0) + 1)
    }
    return map
  }, [messages])
  const reactionsFor = useCallback((id: string) => reactionsByMessage.get(id) ?? [], [reactionsByMessage])

  const peers: Peer[] = useMemo(() => {
    const others = (rawPeers ?? []).map((p) => ({
      userId: p.userId, userName: p.userName, userImageUrl: p.userImageUrl, state: p.state as Peer['state'],
    }))
    const self: Peer = { userId: myId, userName: user?.name, userImageUrl: user?.imageUrl, isSelf: true }
    return [self, ...others.filter((o) => o.userId !== myId)]
  }, [rawPeers, myId, user?.name, user?.imageUrl])

  const typingNames = useMemo(
    () => (rawPeers ?? []).filter((p) => (p.state as Peer['state'])?.typing).map((p) => p.userName || 'Someone'),
    [rawPeers],
  )

  // How many *other* people are on the voice call (from broadcast presence).
  const othersOnCall = useMemo(
    () => (rawPeers ?? []).filter((p) => p.userId !== myId && (p.state as Peer['state'])?.inCall).length,
    [rawPeers, myId],
  )
  const setInCall = useCallback((inCall: boolean) => updateState({ inCall }), [updateState])

  // ---- Autoscroll ----
  const lastMainContent = mainMessages[mainMessages.length - 1]?.data.content
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 280
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [mainMessages.length, lastMainContent])

  // ---- Send ----
  const postMessage = useCallback(
    async (text: string, askAi: boolean, parentId: string, setLocalBusy: (b: boolean) => void) => {
      const myName = user?.name || user?.email || 'Guest'
      await msgMut.create({
        parentId, authorId: myId, authorName: myName, authorImage: user?.imageUrl || '',
        senderKind: 'participant', content: text, status: 'complete', model: '',
      })
      if (askAi) {
        setLocalBusy(true)
        try {
          const inThread = (m: Envelope<MessageData>) =>
            parentId === MAIN_THREAD ? (!m.data.parentId || m.data.parentId === MAIN_THREAD) : m.data.parentId === parentId
          const history: AskHistoryTurn[] = messages
            .filter(inThread)
            .filter((m) => m.data.status !== 'streaming' && (m.data.content || '').trim() !== '')
            .slice(-40)
            .map((m) => ({
              senderKind: m.data.senderKind === 'ai' ? 'ai' : 'participant',
              authorName: m.data.authorName || 'Someone',
              content: m.data.content,
            }))
          if (parentId !== MAIN_THREAD) {
            const root = messages.find((m) => m.recordId === parentId)
            if (root) history.unshift({ senderKind: 'ai', authorName: 'Assistant', content: root.data.content })
          }
          history.push({ senderKind: 'participant', authorName: myName, content: text })
          const res = await askAI({ roomId, parentId, modelId: model, history })
          if (!res.ok) toastError("Couldn't get a reply", res.error || 'Please try again.')
        } catch {
          toastError("Couldn't get a reply", 'Please try again.')
        } finally {
          setLocalBusy(false)
        }
      }
    },
    [msgMut, myId, user, roomId, model, messages, toastError],
  )

  const handleSendMain = (text: string, askAi: boolean) => postMessage(text, askAi, MAIN_THREAD, setBusy)
  const handleSendThread = (text: string, askAi: boolean) =>
    activeThreadId && postMessage(text, askAi, activeThreadId, setThreadBusy)

  // ---- Reactions ----
  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      const mine = reactions.find((r) => r.data.messageId === messageId && r.data.emoji === emoji && r.data.userId === myId)
      if (mine) reactMut.remove(mine.recordId)
      else reactMut.create({ messageId, emoji, userId: myId, userName: user?.name || 'Guest' })
    },
    [reactions, myId, reactMut, user?.name],
  )
  const deleteMessage = useCallback((id: string) => msgMut.remove(id), [msgMut])

  // ---- Presence: cursor + typing ----
  const onMouseMove = (e: React.MouseEvent) => {
    const now = Date.now()
    if (now - cursorThrottle.current < 45) return
    cursorThrottle.current = now
    const rect = chatAreaRef.current?.getBoundingClientRect()
    if (!rect) return
    updateState({ cursor: { x: e.clientX - rect.left, y: e.clientY - rect.top } })
  }
  const onMouseLeave = () => updateState({ cursor: null })
  const setTyping = useCallback((typing: boolean) => updateState({ typing }), [updateState])

  // ---- Host actions ----
  const doClear = async () => {
    setConfirmClear(false)
    const res = await clearRoom(roomId)
    if (res.ok) success('Conversation cleared')
    else toastError("Couldn't clear", res.error)
  }
  const doRename = async () => {
    const t = renameValue.trim()
    if (!t) return
    setRenameOpen(false)
    if (await renameRoom(roomId, t)) success('Renamed')
    else toastError("Couldn't rename")
  }
  const doRemove = async () => {
    if (!removeTarget) return
    const target = removeTarget
    setRemoveTarget(null)
    if (await removeParticipant(roomId, target.id)) success(`Removed ${target.name}`)
    else toastError("Couldn't remove")
  }
  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const activeThread = activeThreadId
    ? { root: messages.find((m) => m.recordId === activeThreadId), list: messages.filter((m) => m.data.parentId === activeThreadId) }
    : null

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <header className="z-20 flex shrink-0 items-center gap-3 border-b border-white/[0.06] bg-background/70 px-3 py-2.5 backdrop-blur-xl sm:px-4">
        <button
          onClick={() => navigate('/home')}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
          title="Leave room"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-semibold text-foreground">{room.data.title}</h1>
          <button
            onClick={copyLink}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            title="Copy invite link"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Link2 className="h-3 w-3" />}
            <span className="font-mono tracking-wider">{room.data.code}</span>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <CallBar
            roomId={roomId}
            displayName={user?.name || user?.email || 'Guest'}
            othersOnCall={othersOnCall}
            onActiveChange={setInCall}
          />
          <PresenceStack peers={peers} hostId={room.data.hostId} currentUserId={myId} onRemove={(id, name) => setRemoveTarget({ id, name })} />
          {isHost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/[0.06] hover:text-foreground" title="Room settings">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => { setRenameValue(room.data.title); setRenameOpen(true) }} className="gap-2">
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmClear(true)} className="gap-2 text-muted-foreground">
                  <Eraser className="h-3.5 w-3.5" /> Clear conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="ml-1"><UserMenu /></div>
        </div>
      </header>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={(el) => { scrollRef.current = el; chatAreaRef.current = el }}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            className="relative flex-1 overflow-y-auto"
          >
            <Cursors peers={peers.filter((p) => !p.isSelf)} />
            <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
              {rendered.length === 0 ? (
                <EmptyRoom />
              ) : (
                rendered.map(({ m, showHeader }) => (
                  <MessageItem
                    key={m.recordId}
                    message={m}
                    reactions={reactionsFor(m.recordId)}
                    currentUserId={myId}
                    showHeader={showHeader}
                    threadCount={threadCounts.get(m.recordId) ?? 0}
                    onToggleReaction={toggleReaction}
                    onBranch={(id) => setActiveThreadId(id)}
                    onOpenThread={(id) => setActiveThreadId(id)}
                    onDelete={deleteMessage}
                  />
                ))
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="shrink-0 px-4 pb-4 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <div className="mb-1.5 flex h-4 items-center gap-1.5 px-2 text-xs text-primary">
                {typingNames.length > 0 && (
                  <>
                    <span className="flex gap-0.5">
                      <i className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
                      <i className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
                      <i className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
                    </span>
                    <span className="text-muted-foreground">
                      {typingNames.slice(0, 3).join(', ')}{typingNames.length > 3 ? ' and others' : ''} {typingNames.length === 1 ? 'is' : 'are'} typing
                    </span>
                  </>
                )}
              </div>
              <PromptBox onSend={handleSendMain} onTyping={setTyping} model={model} setModel={setModel} busy={busy} ready={roomReady} />
            </div>
          </div>
        </div>

        {/* Thread slide-over */}
        {activeThread && (
          <aside className="absolute inset-y-0 right-0 z-30 w-full border-l border-white/[0.06] bg-background shadow-2xl sm:max-w-md md:relative md:w-[26rem] md:shadow-none">
            <ThreadPanel
              rootId={activeThreadId!}
              root={activeThread.root}
              messages={activeThread.list}
              reactionsFor={reactionsFor}
              currentUserId={myId}
              model={model}
              setModel={setModel}
              busy={threadBusy}
              ready={roomReady}
              onClose={() => setActiveThreadId(null)}
              onSend={handleSendThread}
              onTyping={setTyping}
              onToggleReaction={toggleReaction}
              onDelete={deleteMessage}
            />
          </aside>
        )}
      </div>

      {/* Dialogs */}
      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={doClear}
        title={`Clear "${room.data.title}"?`}
        description="This hides every message in the room for everyone. It can't be undone."
        confirmText="Clear"
        variant="destructive"
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={doRemove}
        title={`Remove ${removeTarget?.name}?`}
        description="They'll lose access to this room. They can rejoin only with the link again."
        confirmText="Remove"
        variant="destructive"
      />
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename room</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doRename()} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={doRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyRoom() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <h2 className="text-lg font-semibold text-foreground">Start the conversation</h2>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Everyone here shares one conversation. Type a question and hit{' '}
        <span className="font-medium text-foreground">Ask</span> — the reply appears for the whole
        room as it's written.
      </p>
    </div>
  )
}
