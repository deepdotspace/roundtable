/**
 * Home — the Roundtable lobby.
 *
 * Signed out: a calm landing + sign-in.
 * Signed in: start a room, join by code, open one of your rooms.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, useQuery, useUser, getUserColor } from 'deepspace'
import { ArrowRight, Plus } from 'lucide-react'
import { Button, Input, useToast } from '../components/ui'
import { UserMenu } from '../components/roundtable/UserMenu'
import { createRoom, type Envelope, type RoomData } from '../lib/roundtable'

export default function HomePage() {
  const { isSignedIn, isLoaded } = useAuthProfileReady()
  if (!isLoaded) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
  return isSignedIn ? <Lobby /> : <Landing />
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <img src="/favicon.svg" alt="" aria-hidden className="h-6 w-6 shrink-0 rounded-[5px]" />
      <span className="font-serif text-lg font-semibold tracking-tight text-foreground">Roundtable</span>
    </div>
  )
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

  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [code, setCode] = useState('')

  const myId = user?.id ?? ''
  const firstName = (user?.name || '').split(' ')[0]
  const rooms = allRooms.filter((r) => r.data.hostId === myId)

  const create = async () => {
    const t = title.trim()
    if (!t || creating) return
    setCreating(true)
    try {
      const room = await createRoom({ title: t, hostName: user?.name || user?.email || 'Host' })
      if (!room) { toastError("Couldn't create", 'Please try again.'); setCreating(false); return }
      navigate(`/r/${room.recordId}`, { state: { room } })
    } catch {
      toastError("Couldn't create", 'Please try again.')
      setCreating(false)
    }
  }

  const join = () => {
    const c = code.trim().toUpperCase()
    if (!c) return
    const match = allRooms.find((r) => (r.data.code || '').toUpperCase() === c)
    if (match) navigate(`/r/${match.recordId}`)
    else toastError('No room found', `No room with code ${c}.`)
  }

  return (
    <div className="relative h-full overflow-y-auto">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-0 h-80 bg-gradient-to-b from-primary/[0.07] to-transparent" />
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <Wordmark />
        <UserMenu />
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-6 pb-24 pt-10 sm:pt-16">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {firstName ? `Hi, ${firstName}.` : 'Welcome back.'}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Open a room and start talking it through — together.</p>

        {/* Create */}
        <div className="mt-7 flex items-center gap-2 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/[0.07] transition focus-within:ring-white/[0.16]">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Name a new room — planning, debugging, a decision…"
            className="h-10 flex-1 border-0 bg-transparent text-[15px] shadow-none focus-visible:ring-0"
          />
          <Button onClick={create} loading={creating} disabled={!title.trim()} className="h-10 shrink-0 gap-1.5 rounded-xl px-4">
            <Plus className="h-4 w-4" /> Create
          </Button>
        </div>

        {/* Join */}
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span>Have a code?</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            placeholder="ABC123"
            maxLength={6}
            className="w-24 rounded-lg bg-white/[0.04] px-2.5 py-1 font-mono uppercase tracking-widest text-foreground outline-none ring-1 ring-white/[0.07] placeholder:text-muted-foreground/50 focus:ring-white/[0.16]"
          />
          <button onClick={join} className="font-medium text-primary hover:opacity-80">Join</button>
        </div>

        {/* Your rooms */}
        <div className="mt-12">
          <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your rooms</div>
          {rooms.length === 0 ? (
            <p className="px-1 py-6 text-sm text-muted-foreground">Nothing yet. Create a room above, then share its code.</p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {rooms.map((r) => {
                const color = getUserColor(r.recordId)
                return (
                  <button
                    key={r.recordId}
                    onClick={() => navigate(`/r/${r.recordId}`)}
                    className="group flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-white/[0.02]"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="flex-1 truncate text-[15px] font-medium text-foreground">{r.data.title}</span>
                    <span className="shrink-0 font-mono text-xs tracking-widest text-muted-foreground">{r.data.code}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Signed-out landing                                                  */
/* ------------------------------------------------------------------ */

function Landing() {
  const [authOpen, setAuthOpen] = useState(false)
  return (
    <div className="relative h-full overflow-y-auto">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[130px]" />
      </div>
      <header className="relative z-10 px-6 py-4"><Wordmark /></header>

      <main className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-6 pb-24 pt-24 text-center sm:pt-32">
        <h1 className="font-serif text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">Roundtable</h1>
        <p className="mx-auto mt-5 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
          A shared room for your team and one assistant. Everyone sees the same conversation as it
          unfolds — ask, react, and split off side threads together.
        </p>
        <Button size="lg" className="mt-9 gap-2" onClick={() => setAuthOpen(true)}>
          Sign in to start <ArrowRight className="h-4 w-4" />
        </Button>

        <div className="mt-20 grid w-full gap-x-10 gap-y-6 text-left sm:grid-cols-3">
          {[
            { t: 'Replies in real time', b: "The answer appears for everyone at once, as it's written." },
            { t: 'See the room', b: "Live avatars, cursors, and who's typing — at a glance." },
            { t: 'Side threads', b: 'Branch any reply to dig in without losing the main thread.' },
          ].map(({ t, b }) => (
            <div key={t}>
              <div className="mb-1 h-px w-8 bg-primary/50" />
              <h3 className="text-sm font-semibold text-foreground">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </main>
      {authOpen && <AuthOverlay onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
