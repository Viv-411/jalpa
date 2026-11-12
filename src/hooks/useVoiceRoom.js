import { useCallback, useEffect, useRef, useState } from 'react'
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client'
import { api } from '../lib/api'
import { createCaptioner } from '../lib/captions'
import { uploadSpeech } from '../lib/speechUpload'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function recorderMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

// The voice call for one debate.
//
//   active      connect while true (prep and live speeches)
//   speakPhase  index of the speech this debater is giving right now, or null.
//               The microphone is live only during your own speech, and that
//               speech is recorded and sent off for transcription when it ends.
export function useVoiceRoom({ debateId, opponentUid, active, speakPhase }) {
  const [connection, setConnection] = useState('idle')
  const [ready, setReady] = useState(false)
  const [opponentPresent, setOpponentPresent] = useState(false)
  const [micBlocked, setMicBlocked] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [speakingIds, setSpeakingIds] = useState([])
  const [caption, setCaption] = useState({ phase: null, text: '' })
  const [attempt, setAttempt] = useState(0)
  const roomRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined

    let cancelled = false
    const room = new Room({
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    roomRef.current = room

    const syncOpponent = () => {
      const present = Array.from(room.remoteParticipants.values()).some(
        (participant) => participant.identity === opponentUid,
      )
      setOpponentPresent(present)
    }

    room
      .on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return
        const element = track.attach()
        element.dataset.jalpaAudio = 'remote'
        document.body.appendChild(element)
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove())
      })
      .on(RoomEvent.ParticipantConnected, syncOpponent)
      .on(RoomEvent.ParticipantDisconnected, syncOpponent)
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) setConnection('connected')
        else if (state === ConnectionState.Disconnected) setConnection('disconnected')
        else setConnection('connecting')
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setSpeakingIds(speakers.map((speaker) => speaker.identity))
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setAudioBlocked(!room.canPlaybackAudio)
      })
      .on(RoomEvent.MediaDevicesError, () => setMicBlocked(true))
      .on(RoomEvent.DataReceived, (payload, participant) => {
        if (participant?.identity !== opponentUid) return
        try {
          const message = JSON.parse(decoder.decode(payload))
          if (message.type === 'caption') {
            setCaption({ phase: message.phase, text: String(message.text ?? '').slice(0, 300) })
          }
        } catch {
          // Ignore anything that isn't one of our caption messages.
        }
      })

    async function connect() {
      try {
        setConnection('connecting')
        const { token, url } = await api('token', { debateId })
        if (cancelled) return
        await room.connect(url, token)
        if (cancelled) return
        syncOpponent()
        setAudioBlocked(!room.canPlaybackAudio)

        // Ask for the microphone now (during prep) and leave it muted,
        // so nobody is fumbling with a permission prompt mid-speech.
        try {
          await room.localParticipant.setMicrophoneEnabled(true)
          await room.localParticipant.setMicrophoneEnabled(false)
          setMicBlocked(false)
        } catch {
          setMicBlocked(true)
        }
        if (!cancelled) setReady(true)
      } catch (err) {
        if (cancelled) return
        // A 409 means the debate just ended; that's not a connection problem.
        setConnection(err?.status === 409 ? 'idle' : 'error')
      }
    }
    connect()

    return () => {
      cancelled = true
      setReady(false)
      setOpponentPresent(false)
      setSpeakingIds([])
      room.removeAllListeners()
      room.disconnect()
      document.querySelectorAll('audio[data-jalpa-audio]').forEach((element) => element.remove())
      if (roomRef.current === room) roomRef.current = null
      setConnection('idle')
    }
  }, [active, debateId, opponentUid, attempt])

  // Open the mic and record while it is this debater's speech.
  useEffect(() => {
    const room = roomRef.current
    if (!ready || !room || speakPhase == null) return undefined

    const phase = speakPhase
    let ended = false
    let recorder = null
    let recorded = null
    const chunks = []
    let lastSent = 0

    const captioner = createCaptioner((text) => {
      setCaption({ phase, text })
      const now = Date.now()
      if (now - lastSent < 500) return
      lastSent = now
      room.localParticipant
        .publishData(encoder.encode(JSON.stringify({ type: 'caption', phase, text })), {
          reliable: false,
        })
        .catch(() => {})
    })

    async function begin() {
      try {
        await room.localParticipant.setMicrophoneEnabled(true)
        setMicBlocked(false)
      } catch {
        setMicBlocked(true)
      }
      if (ended) return

      const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track
        ?.mediaStreamTrack
      const mimeType = recorderMimeType()
      if (track && mimeType !== null) {
        try {
          recorder = new MediaRecorder(new MediaStream([track]), {
            ...(mimeType ? { mimeType } : {}),
            audioBitsPerSecond: 32_000,
          })
          recorded = new Promise((resolve) => {
            recorder.onstop = () =>
              resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }))
          })
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data)
          }
          recorder.start(1000)
        } catch (err) {
          console.warn('Could not record this speech', err)
          recorder = null
        }
      }
      captioner.start()
    }
    begin()

    return () => {
      ended = true
      const captions = captioner.stop()
      if (recorder) {
        if (recorder.state !== 'inactive') recorder.stop()
        recorded.then((blob) => uploadSpeech({ debateId, phase, blob, captions }))
      } else {
        uploadSpeech({ debateId, phase, blob: null, captions })
      }
      room.localParticipant.setMicrophoneEnabled(false).catch(() => {})
    }
  }, [ready, speakPhase, debateId])

  const unlockAudio = useCallback(async () => {
    try {
      await roomRef.current?.startAudio()
      setAudioBlocked(false)
    } catch {
      // The browser still wants a click; the button stays visible.
    }
  }, [])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return {
    connection,
    ready,
    opponentPresent,
    micBlocked,
    audioBlocked,
    speakingIds,
    caption,
    unlockAudio,
    retry,
  }
}
