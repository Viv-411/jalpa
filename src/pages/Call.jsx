import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
} from 'livekit-client'
import { db, storage } from '../firebase'
import { useAuth } from '../context/AuthContext'
import './Call.css'

function formatElapsed(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function connectionLabel(status) {
  switch (status) {
    case 'connecting':
      return 'Connecting…'
    case 'connected':
      return 'Connected'
    case 'disconnected':
      return 'Disconnected'
    case 'error':
      return 'Connection failed'
    default:
      return status
  }
}

export default function Call() {
  const { debateId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [debate, setDebate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [micDenied, setMicDenied] = useState(false)
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [debateTimerActive, setDebateTimerActive] = useState(false)
  const [ending, setEnding] = useState(false)

  const roomRef = useRef(null)
  const opponentUidRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordingChunksRef = useRef([])
  const audioContextRef = useRef(null)
  const mixedSourcesRef = useRef([])
  const recordingStartedRef = useRef(false)
  const audioBlobRef = useRef(null)
  const attachedAudioTrackSidsRef = useRef(new Set())

  const mySide = debate?.sides?.[user?.uid]

  const startMixedRecording = useCallback((room) => {
    if (recordingStartedRef.current) return
    recordingStartedRef.current = true

    const audioContext = new AudioContext()
    audioContextRef.current = audioContext
    const destination = audioContext.createMediaStreamDestination()

    const addTrackToMix = (mediaStreamTrack) => {
      if (!mediaStreamTrack || mediaStreamTrack.kind !== 'audio') return
      const stream = new MediaStream([mediaStreamTrack])
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(destination)
      mixedSourcesRef.current.push(source)
    }

    const localPub = room.localParticipant.getTrackPublication(
      Track.Source.Microphone,
    )
    if (localPub?.track) {
      addTrackToMix(localPub.track.mediaStreamTrack)
    }

    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (
          publication.kind === Track.Kind.Audio &&
          publication.track?.mediaStreamTrack
        ) {
          addTrackToMix(publication.track.mediaStreamTrack)
        }
      }
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const recorder = new MediaRecorder(destination.stream, { mimeType })
    recordingChunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordingChunksRef.current.push(event.data)
      }
    }

    recorder.onstop = () => {
      if (recordingChunksRef.current.length > 0) {
        audioBlobRef.current = new Blob(recordingChunksRef.current, {
          type: mimeType,
        })
      }
    }

    recorder.start(1000)
    mediaRecorderRef.current = recorder
  }, [])

  const maybeStartRecording = useCallback(
    (room) => {
      const oppUid = opponentUidRef.current
      if (recordingStartedRef.current || !oppUid || !room) return

      const opponentPresent = Array.from(room.remoteParticipants.values()).some(
        (p) => p.identity === oppUid,
      )

      if (opponentPresent && room.state === ConnectionState.Connected) {
        startMixedRecording(room)
        setDebateTimerActive(true)
      }
    },
    [startMixedRecording],
  )

  useEffect(() => {
    if (!debateTimerActive) return

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [debateTimerActive])

  useEffect(() => {
    let cancelled = false

    async function loadDebateAndConnect() {
      try {
        const debateSnap = await getDoc(doc(db, 'debates', debateId))

        if (!debateSnap.exists()) {
          setPageError('Debate not found.')
          setLoading(false)
          return
        }

        const debateData = { id: debateSnap.id, ...debateSnap.data() }
        if (cancelled) return
        setDebate(debateData)

        const oppUid =
          debateData.player1uid === user.uid
            ? debateData.player2uid
            : debateData.player1uid
        opponentUidRef.current = oppUid

        const livekitUrl = import.meta.env.VITE_LIVEKIT_URL
        if (!livekitUrl) {
          setPageError('LiveKit is not configured.')
          setConnectionStatus('error')
          setLoading(false)
          return
        }

        const tokenRes = await fetch('/api/getLiveKitToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: debateId,
            participantName: user.uid,
          }),
        })

        if (!tokenRes.ok) {
          const errBody = await tokenRes.json().catch(() => ({}))
          throw new Error(errBody.error || 'Could not get call token.')
        }

        const { token } = await tokenRes.json()
        if (cancelled) return

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        })
        roomRef.current = room

        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          if (state === ConnectionState.Connected) {
            setConnectionStatus('connected')
            maybeStartRecording(room)
          } else if (state === ConnectionState.Disconnected) {
            setConnectionStatus('disconnected')
          } else if (state === ConnectionState.Connecting) {
            setConnectionStatus('connecting')
          }
        })

        room.on(RoomEvent.ParticipantConnected, (participant) => {
          if (participant.identity === oppUid) {
            maybeStartRecording(room)
          }
        })

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (participant.identity === oppUid) {
            setOpponentDisconnected(true)
          }
        })

        function attachRemoteAudio(track) {
          if (cancelled) return
          if (
            track.kind !== Track.Kind.Audio ||
            attachedAudioTrackSidsRef.current.has(track.sid)
          ) {
            return
          }
          attachedAudioTrackSidsRef.current.add(track.sid)
          const audioElement = track.attach()
          audioElement.autoplay = true
          document.body.appendChild(audioElement)
        }

        function detachRemoteAudio(track) {
          if (cancelled) return
          if (track.kind !== Track.Kind.Audio) return
          attachedAudioTrackSidsRef.current.delete(track.sid)
          const elements = track.detach()
          elements.forEach((el) => el.remove())
        }

        function attachExistingRemoteAudio() {
          if (cancelled) return
          for (const participant of room.remoteParticipants.values()) {
            for (const publication of participant.trackPublications.values()) {
              if (publication.track) {
                attachRemoteAudio(publication.track)
              }
            }
          }
        }

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (cancelled) return
          attachRemoteAudio(track)
          maybeStartRecording(room)
        })

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (cancelled) return
          detachRemoteAudio(track)
        })

        room.on(RoomEvent.LocalTrackPublished, () => {
          maybeStartRecording(room)
        })

        setConnectionStatus('connecting')
        await room.connect(livekitUrl, token)

        try {
          await room.localParticipant.setMicrophoneEnabled(true)
        } catch {
          setMicDenied(true)
        }

        if (cancelled) {
          room.disconnect()
          return
        }

        attachExistingRemoteAudio()
        setLoading(false)
        maybeStartRecording(room)
      } catch (err) {
        if (cancelled) return
        const message = err?.message || ''
        if (
          message.includes('NotAllowedError') ||
          message.includes('Permission denied')
        ) {
          setMicDenied(true)
        }
        setConnectionStatus('error')
        setPageError(
          message || 'Could not connect to the voice call. Please try again.',
        )
        setLoading(false)
      }
    }

    if (user?.uid) {
      loadDebateAndConnect()
    }

    return () => {
      cancelled = true
      const room = roomRef.current
      room?.removeAllListeners()
      if (room) {
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (
              publication.track &&
              attachedAudioTrackSidsRef.current.has(publication.track.sid)
            ) {
              const elements = publication.track.detach()
              elements.forEach((el) => el.remove())
            }
          }
        }
      }
      attachedAudioTrackSidsRef.current.clear()
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop()
      }
      audioContextRef.current?.close()
      roomRef.current?.disconnect()
      roomRef.current = null
    }
  }, [debateId, user?.uid, maybeStartRecording])

  async function toggleMute() {
    const room = roomRef.current
    if (!room) return

    const nextMuted = !muted
    await room.localParticipant.setMicrophoneEnabled(!nextMuted)
    setMuted(nextMuted)
  }

  async function handleEndDebate() {
    if (ending) return
    setEnding(true)

    const room = roomRef.current

    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        await new Promise((resolve) => {
          const recorder = mediaRecorderRef.current
          recorder.addEventListener('stop', resolve, { once: true })
          recorder.stop()
        })
      }

      audioContextRef.current?.close()
      room?.disconnect()

      const blob = audioBlobRef.current
      let recordingUrl = ''

      if (blob && blob.size > 0) {
        const storageRef = ref(storage, `recordings/${debateId}.webm`)
        await uploadBytes(storageRef, blob, { contentType: 'audio/webm' })
        recordingUrl = await getDownloadURL(storageRef)
      }

      await updateDoc(doc(db, 'debates', debateId), {
        status: 'processing',
        ...(recordingUrl ? { recordingUrl } : {}),
      })

      navigate(`/results/${debateId}`, { replace: true })
    } catch {
      setPageError('Could not end the debate. Please try again.')
      setEnding(false)
    }
  }

  if (loading) {
    return (
      <div className="call-page">
        <p className="call-loading">Connecting to voice call…</p>
      </div>
    )
  }

  if (pageError && connectionStatus === 'error' && !debate) {
    return (
      <div className="call-page">
        <div className="call-card call-card--error">
          <p className="call-error">{pageError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="call-page">
      <div className="call-card">
        <header className="call-header">
          <span
            className={`call-status call-status--${connectionStatus}`}
            aria-live="polite"
          >
            {connectionLabel(connectionStatus)}
          </span>
          <span className="call-side-badge">{mySide}</span>
        </header>

        <p className="call-prompt-label">Your Prompt:</p>
        <p className="call-topic">{debate?.topic}</p>

        <div className="call-timer" aria-live="polite">
          <span className="call-timer-label">Debate time</span>
          <span className="call-timer-value">{formatElapsed(elapsedSeconds)}</span>
        </div>

        {micDenied && (
          <p className="call-alert" role="alert">
            Microphone access was denied. Please allow microphone access in your
            browser settings and refresh the page.
          </p>
        )}

        {connectionStatus === 'error' && pageError && (
          <p className="call-alert" role="alert">
            {pageError}
          </p>
        )}

        {opponentDisconnected && (
          <div className="call-opponent-alert" role="alert">
            <p>Opponent disconnected</p>
            <button
              type="button"
              className="call-btn-secondary"
              onClick={handleEndDebate}
              disabled={ending}
            >
              End debate
            </button>
          </div>
        )}

        <div className="call-controls">
          <button
            type="button"
            className={`call-btn-mute ${muted ? 'call-btn-mute--active' : ''}`}
            onClick={toggleMute}
            disabled={connectionStatus !== 'connected' || ending}
            aria-pressed={muted}
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>

          <button
            type="button"
            className="call-btn-end"
            onClick={handleEndDebate}
            disabled={ending}
          >
            {ending ? 'Ending…' : 'End Debate'}
          </button>
        </div>
      </div>
    </div>
  )
}
