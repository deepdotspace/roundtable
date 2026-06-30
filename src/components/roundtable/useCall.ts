/**
 * useCall — manages a LiveKit audio call for one Roundtable.
 *
 * The deepspace SDK only mints the token (see `mintCallToken`); the WebRTC
 * plumbing is ours. We connect with `livekit-client`, publish the mic, and
 * attach every remote audio track to a hidden <audio> element so the room can
 * be heard. The participant list / speaking / mute state is read straight from
 * LiveKit, which is authoritative for who is actually on the call.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track } from 'livekit-client'
import { mintCallToken } from '../../lib/roundtable'

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface CallParticipant {
  identity: string
  name: string
  isLocal: boolean
  isSpeaking: boolean
  isMuted: boolean
}

export interface UseCall {
  status: CallStatus
  participants: CallParticipant[]
  micEnabled: boolean
  /** True when the browser is blocking autoplay; call `enableAudio` from a click. */
  audioBlocked: boolean
  join: () => Promise<void>
  leave: () => void
  toggleMic: () => Promise<void>
  enableAudio: () => Promise<void>
}

export function useCall(roomId: string, displayName: string): UseCall {
  const [status, setStatus] = useState<CallStatus>('idle')
  const [participants, setParticipants] = useState<CallParticipant[]>([])
  const [micEnabled, setMicEnabled] = useState(true)
  const [audioBlocked, setAudioBlocked] = useState(false)

  const roomRef = useRef<Room | null>(null)
  // Hidden <audio> elements keyed by trackSid, one per remote audio track.
  const audioEls = useRef<Map<string, HTMLMediaElement>>(new Map())

  const sync = useCallback((room: Room) => {
    const all = [room.localParticipant, ...room.remoteParticipants.values()]
    setParticipants(
      all.map((p) => ({
        identity: p.identity,
        name: p.name || displayName || p.identity,
        isLocal: p === room.localParticipant,
        isSpeaking: p.isSpeaking,
        isMuted: !p.isMicrophoneEnabled,
      })),
    )
  }, [displayName])

  const cleanup = useCallback(() => {
    const room = roomRef.current
    roomRef.current = null
    audioEls.current.forEach((el) => {
      el.srcObject = null
      el.remove()
    })
    audioEls.current.clear()
    if (room) {
      room.removeAllListeners()
      room.disconnect()
    }
    setParticipants([])
    setMicEnabled(true)
    setAudioBlocked(false)
    setStatus('idle')
  }, [])

  const join = useCallback(async () => {
    if (roomRef.current) return
    setStatus('connecting')

    const creds = await mintCallToken(roomId, displayName)
    if (!creds) {
      setStatus('error')
      return
    }

    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room
    const onChange = () => sync(room)

    room
      .on(RoomEvent.ParticipantConnected, onChange)
      .on(RoomEvent.ParticipantDisconnected, onChange)
      .on(RoomEvent.TrackMuted, onChange)
      .on(RoomEvent.TrackUnmuted, onChange)
      .on(RoomEvent.ActiveSpeakersChanged, onChange)
      .on(RoomEvent.LocalTrackPublished, onChange)
      .on(RoomEvent.LocalTrackUnpublished, onChange)
      .on(RoomEvent.TrackSubscribed, (track, pub) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach()
          el.autoplay = true
          audioEls.current.set(pub.trackSid, el)
          document.body.appendChild(el)
        }
        onChange()
      })
      .on(RoomEvent.TrackUnsubscribed, (track, pub) => {
        track.detach().forEach((el) => el.remove())
        audioEls.current.delete(pub.trackSid)
        onChange()
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!room.canPlaybackAudio))
      .on(RoomEvent.Disconnected, () => cleanup())

    try {
      await room.connect(creds.url, creds.token)
      await room.localParticipant.setMicrophoneEnabled(true)
      setMicEnabled(true)
      setAudioBlocked(!room.canPlaybackAudio)
      setStatus('connected')
      sync(room)
    } catch {
      cleanup()
      setStatus('error')
    }
  }, [roomId, displayName, sync, cleanup])

  const leave = useCallback(() => cleanup(), [cleanup])

  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !room.localParticipant.isMicrophoneEnabled
    await room.localParticipant.setMicrophoneEnabled(next)
    setMicEnabled(next)
    sync(room)
  }, [sync])

  const enableAudio = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    await room.startAudio()
    setAudioBlocked(!room.canPlaybackAudio)
  }, [])

  // Always tear down on unmount (e.g. navigating out of the room).
  useEffect(() => cleanup, [cleanup])

  return { status, participants, micEnabled, audioBlocked, join, leave, toggleMic, enableAudio }
}
