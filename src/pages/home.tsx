/**
 * Home — the Roundtable lobby.
 *
 * Signed out: a marketing hero + sign-in.
 * Signed in: create a roundtable, join by code, and browse open rooms.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, useQuery, useUser } from 'deepspace'
import {
  Sparkles, Plus, ArrowRight, Users, Radio, GitBranch, Zap, Crown, MessageSquare,
} from 'lucide-react'
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  useToast,
} from '../components/ui'
import { cn } from '../components/ui/utils'
import { createRoom, type Envelope, type RoomData } from '../lib/roundtable'

export default function HomePage() {
  const { isSignedIn, isLoaded } = useAuthProfileReady()
  if (!isLoaded) return <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>
  return isSignedIn ? <Lobby /> : <Landing />
}

/* ------------------------------------------------------------------ */
/* Signed-in lobby                                                     */
/* ------------------------------------------------------------------ */

function Lobby() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { error: toastError } = useToast()
  const { records } = useQuery<RoomData>('rooms', { orderBy: 'createdAt', orderDir: 'desc' })
  const allRooms = records as unknown as Envelope<RoomData>[]

  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [creating, setCreating] = useState(false)
  const [code, setCode] = useState('')

  const myId = user?.id ?? ''
  // Rooms are shared by link/code, not publicly browsable — show the ones you
  // host. (Join-by-code below still resolves against every room.)
  const rooms = allRooms.filter((r) => r.data.hostId === myId)

  const create = async () => {
    const t = title.trim()
    if (!t) return
    setCreating(true)
    try {
      const room = await createRoom({
        title: t,
        topic: topic.trim(),
        hostName: user?.name || user?.email || 'Host',
      })
      if (!room) {
        toastError('Could not create', 'Please try again.')
        setCreating(false)
        return
      }
      // Hand the room forward so the room page renders instantly.
      navigate(`/r/${room.recordId}`, { state: { room } })
    } catch {
      toastError('Could not create', 'Please try again.')
      setCreating(false)
    }
  }

  const join = () => {
    const c = code.trim().toUpperCase()
    if (!c) return
    const match = allRooms.find((r) => (r.data.code || '').toUpperCase() === c)
    if (match) navigate(`/r/${match.recordId}`)
    else toastError('No room found', `No open roundtable with code ${c}.`)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Radio className="h-3.5 w-3.5" /> Real-time · multiplayer · one shared AI
        </span>
        <h1 className="mt-5 font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Think together, live.
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-base text-muted-foreground">
          A Roundtable is one room, one conversation, one AI — for your whole team. Ask a
          question and watch the answer stream in on everyone's screen at once.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button size="lg" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New roundtable
          </Button>
          <div className="flex items-center gap-2 rounded-full border border-border bg-background/60 p-1 pl-3">
            <span className="text-xs text-muted-foreground">Join code</span>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              placeholder="ABC123"
              className="h-8 w-28 border-0 bg-transparent font-mono uppercase tracking-widest focus-visible:ring-0"
              maxLength={6}
            />
            <Button size="sm" variant="secondary" onClick={join} className="gap-1">
              Join <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Feature strip */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <FeatureCard icon={Zap} title="Streams to everyone" body="The AI's reply animates in token-by-token on every participant's screen simultaneously." />
        <FeatureCard icon={Users} title="See who's here" body="Live presence, cursors, and typing indicators — know who's in the room and what they're doing." />
        <FeatureCard icon={GitBranch} title="Branch tangents" body="Spin any AI answer into a side thread so the group explores without derailing the main line." />
      </div>

      {/* Rooms */}
      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your roundtables</h2>
        <span className="text-xs text-muted-foreground">{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}</span>
      </div>

      {rooms.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <MessageSquare className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-foreground">No roundtables yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">Start one and share the code — or enter a code above to join someone else's live room.</p>
          <Button className="mt-1 gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New roundtable
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <button
              key={r.recordId}
              onClick={() => navigate(`/r/${r.recordId}`)}
              className="group flex flex-col items-start rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex w-full items-center gap-2">
                <h3 className="flex-1 truncate font-medium text-foreground">{r.data.title}</h3>
                {r.data.hostId === myId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    <Crown className="h-2.5 w-2.5" /> Host
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">
                {r.data.topic || 'No topic set'}
              </p>
              <div className="mt-3 flex w-full items-center justify-between">
                <span className="font-mono text-xs tracking-widest text-muted-foreground">{r.data.code}</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Enter <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a roundtable</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="Q3 planning, Bug triage, Trip ideas…"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Topic <span className="opacity-60">(optional)</span></label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="What's this room for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} loading={creating} className="gap-1.5">
              <Sparkles className="h-4 w-4" /> Create &amp; enter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, body }: { icon: typeof Zap; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Signed-out landing                                                  */
/* ------------------------------------------------------------------ */

function Landing() {
  const [authOpen, setAuthOpen] = useState(false)
  return (
    <div className="relative min-h-full overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      </div>
      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center sm:py-32">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Multiplayer ChatGPT for teams
        </span>
        <h1 className="mt-6 font-serif text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Roundtable
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
          One live room. One shared AI. Your whole team sees the same conversation stream in
          real time — ask, react, and branch together.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="gap-2" onClick={() => setAuthOpen(true)}>
            Sign in to start <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-16 grid gap-3 text-left sm:grid-cols-3">
          {[
            { icon: Radio, t: 'Live for everyone', b: 'Answers stream in on every screen at once.' },
            { icon: Users, t: 'Presence & cursors', b: "See who's in the room and who's typing." },
            { icon: GitBranch, t: 'Threaded tangents', b: 'Branch any reply into a side thread.' },
          ].map(({ icon: Icon, t, b }) => (
            <div key={t} className={cn('rounded-2xl border border-border bg-card/60 p-4 backdrop-blur')}>
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-2.5 text-sm font-semibold text-foreground">{t}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </div>
      {authOpen && <AuthOverlay onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
