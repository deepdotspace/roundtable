/** Live cursor overlay — renders other participants' pointers inside the chat. */
import { getUserColor } from 'deepspace'
import { MousePointer2 } from 'lucide-react'
import type { Peer } from './ParticipantRail'

export function Cursors({ peers }: { peers: Peer[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {peers.map((p) => {
        const c = p.state?.cursor
        if (!c) return null
        const color = getUserColor(p.userId)
        return (
          <div
            key={p.userId}
            className="absolute transition-transform duration-100 ease-out"
            style={{ transform: `translate(${c.x}px, ${c.y}px)` }}
          >
            <MousePointer2 className="h-4 w-4 drop-shadow" style={{ color, fill: color }} />
            <span
              className="ml-3 -mt-1 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow"
              style={{ background: color }}
            >
              {p.userName || 'Guest'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
