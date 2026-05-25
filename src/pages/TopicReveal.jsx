import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import './TopicReveal.css'

const PREP_TIMEOUT_SECONDS = 60

function isCurrentUserReady(debate, uid) {
  if (debate.player1uid === uid) return Boolean(debate.player1ready)
  if (debate.player2uid === uid) return Boolean(debate.player2ready)
  return false
}

function areBothPlayersReady(debate) {
  return Boolean(debate.player1ready && debate.player2ready)
}

export default function TopicReveal() {
  const { debateId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [debate, setDebate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [secondsLeft, setSecondsLeft] = useState(PREP_TIMEOUT_SECONDS)
  const [markingReady, setMarkingReady] = useState(false)
  const [error, setError] = useState('')
  const hasForcedReadyRef = useRef(false)
  const hasNavigatedRef = useRef(false)

  const opponentUid =
    debate?.player1uid === user.uid ? debate?.player2uid : debate?.player1uid
  const mySide = debate?.sides?.[user.uid]
  const opponentSide = opponentUid ? debate?.sides?.[opponentUid] : null
  const iAmReady = debate ? isCurrentUserReady(debate, user.uid) : false

  const goToCall = useCallback(async () => {
    if (hasNavigatedRef.current) return
    hasNavigatedRef.current = true

    try {
      await updateDoc(doc(db, 'debates', debateId), { status: 'in_progress' })
      navigate(`/call/${debateId}`, { replace: true })
    } catch (err) {
      hasNavigatedRef.current = false
      setError('Could not start the debate. Please try again.')
    }
  }, [debateId, navigate])

  useEffect(() => {
    const debateRef = doc(db, 'debates', debateId)

    const unsubscribe = onSnapshot(debateRef, (snapshot) => {
      if (!snapshot.exists()) {
        setError('Debate not found.')
        setLoading(false)
        return
      }

      const data = { id: snapshot.id, ...snapshot.data() }
      setDebate(data)
      setLoading(false)

      if (
        data.status === 'topic_reveal' &&
        areBothPlayersReady(data) &&
        !hasNavigatedRef.current
      ) {
        goToCall()
      }
    })

    return unsubscribe
  }, [debateId, goToCall])

  useEffect(() => {
    if (!debate || debate.status !== 'topic_reveal') return

    setSecondsLeft(PREP_TIMEOUT_SECONDS)

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [debate?.id, debate?.status])

  const forceBothReady = useCallback(async () => {
    if (hasForcedReadyRef.current) return
    hasForcedReadyRef.current = true

    try {
      await updateDoc(doc(db, 'debates', debateId), {
        player1ready: true,
        player2ready: true,
      })
    } catch (err) {
      hasForcedReadyRef.current = false
      setError('Could not update ready status. Please try again.')
    }
  }, [debateId])

  useEffect(() => {
    if (secondsLeft !== 0 || !debate || debate.status !== 'topic_reveal') return
    forceBothReady()
  }, [secondsLeft, debate, forceBothReady])

  async function handleReady() {
    if (!debate || markingReady || iAmReady) return

    const readyField =
      user.uid === debate.player1uid ? 'player1ready' : 'player2ready'

    setMarkingReady(true)

    try {
      await updateDoc(doc(db, 'debates', debateId), { [readyField]: true })
    } catch (err) {
      setError('Could not mark you as ready. Please try again.')
    } finally {
      setMarkingReady(false)
    }
  }

  function formatCountdown(seconds) {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="topic-reveal-page">
        <p className="topic-reveal-loading">Loading debate…</p>
      </div>
    )
  }

  if (error || !debate) {
    return (
      <div className="topic-reveal-page">
        <p className="topic-reveal-error">{error || 'Debate not found.'}</p>
      </div>
    )
  }

  return (
    <div className="topic-reveal-page">
      <div className="topic-reveal-card">
        <header className="topic-reveal-header">
          <p className="topic-reveal-label">{debate.category}</p>
          <h1>Prepare for your debate</h1>
          <p className="topic-reveal-subtitle">
            Review your prompt and side before the voice call begins.
          </p>
        </header>

        <div className="topic-reveal-timer" aria-live="polite">
          <span className="topic-reveal-timer-label">Prep time remaining</span>
          <span className="topic-reveal-timer-value">{formatCountdown(secondsLeft)}</span>
        </div>

        <div className="topic-reveal-sides">
          <div className="topic-reveal-side topic-reveal-side--you">
            <span>Your side</span>
            <strong>{mySide}</strong>
          </div>
          <div className="topic-reveal-side topic-reveal-side--opponent">
            <span>Opponent</span>
            <strong>{opponentSide}</strong>
          </div>
        </div>

        <p className="topic-reveal-prompt-label">Your Prompt:</p>
        <p className="topic-reveal-topic">{debate.topic}</p>

        {!iAmReady ? (
          <button
            type="button"
            className="topic-reveal-btn-primary"
            onClick={handleReady}
            disabled={markingReady}
          >
            {markingReady ? 'Marking ready…' : "I'm Ready"}
          </button>
        ) : (
          <div className="topic-reveal-waiting">
            <div className="topic-reveal-waiting-indicator" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p>Waiting for opponent to ready up…</p>
          </div>
        )}
      </div>
    </div>
  )
}
