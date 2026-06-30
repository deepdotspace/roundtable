/**
 * /r/:id — a single live Roundtable.
 *
 * Room metadata (title, host, code) lives in the app scope (`app:<APP_NAME>`,
 * mounted by _app.tsx). The conversation itself lives in this room's OWN
 * Durable Object scope (`rt:<id>`), mounted below via a nested <RecordScope>.
 * Reading the room here (outer scope) and passing it down keeps the host
 * mutations (rename / remove) on the app scope where the row lives.
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { RecordScope, useQuery, useUser } from 'deepspace'
import { DoorClosed } from 'lucide-react'
import { APP_NAME } from '../../../constants'
import { roomSchemas } from '../../../schemas'
import { RoomView } from '../../../components/roundtable/RoomView'
import { Button, LoadingSpinner } from '../../../components/ui'
import { fetchRoom, type Envelope, type RoomData } from '../../../lib/roundtable'

function Fallback({ title, body }: { title: string; body: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <DoorClosed className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      <Button onClick={() => navigate('/home')}>Back to roundtables</Button>
    </div>
  )
}

export default function RoomPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { user } = useUser()
  const { records } = useQuery<RoomData>('rooms', { orderBy: 'createdAt', orderDir: 'desc' })

  // Room ENTRY uses an authoritative server fetch (reliable even moments after
  // another user created it). The live client query is layered on top so
  // renames / removals propagate in real time once we're subscribed. Nav state
  // (set on create) lets the host land instantly with zero round-trips.
  const stateRoom = (location.state as { room?: Envelope<RoomData> } | null)?.room
  const [fetched, setFetched] = useState<Envelope<RoomData> | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    setFetched(undefined)
    fetchRoom(id).then((r) => { if (alive) setFetched(r) })
    return () => { alive = false }
  }, [id])

  const queryRoom = (records as unknown as Envelope<RoomData>[]).find((r) => r.recordId === id)
  const room =
    queryRoom ??
    (fetched && fetched.recordId === id ? fetched : undefined) ??
    (stateRoom?.recordId === id ? stateRoom : undefined)

  if (!room && fetched === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!room) {
    return <Fallback title="Roundtable not found" body="This room may have been deleted, or the link is wrong." />
  }

  const removed = room.data.removedUserIds ?? []
  if (user && Array.isArray(removed) && removed.includes(user.id)) {
    return <Fallback title="You're no longer in this room" body="The host removed you from this roundtable." />
  }

  return (
    <RecordScope roomId={`rt:${id}`} schemas={roomSchemas} appId={APP_NAME}>
      <RoomView roomId={id} room={room} />
    </RecordScope>
  )
}
