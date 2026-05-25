import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { createMatch, isHostUser } from '../utils/createMatch'
import './Matchmaking.css'

const MATCH_TIMEOUT_MS = 60_000

export default function Matchmaking() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const matchingRef = useRef(false)

  const [category, setCategory] = useState('')
  const [timedOut, setTimedOut] = useState(false)
  const [noTopicsError, setNoTopicsError] = useState(false)
  const [error, setError] = useState('')

  async function deleteQueueEntry() {
    await deleteDoc(doc(db, 'matchmaking', user.uid))
  }

  async function handleCancel() {
    try {
      await deleteQueueEntry()
      navigate('/topics')
    } catch (err) {
      setError('Could not cancel. Please try again.')
    }
  }

  async function handleTryAgain() {
    setTimedOut(false)
    setNoTopicsError(false)
    setError('')
    navigate('/topics')
  }

  async function handleGoBack() {
    try {
      await deleteQueueEntry()
    } catch {
      // Entry may already be deleted on timeout
    }
    navigate('/topics')
  }

  useEffect(() => {
    const ownRef = doc(db, 'matchmaking', user.uid)

    const unsubscribeOwn = onSnapshot(ownRef, (snapshot) => {
      if (!snapshot.exists()) {
        navigate('/topics', { replace: true })
        return
      }

      const data = snapshot.data()
      setCategory(data.category ?? '')

      if (data.debateId) {
        navigate(`/debate/${data.debateId}`, { replace: true })
      }
    })

    return unsubscribeOwn
  }, [user.uid, navigate])

  useEffect(() => {
    if (!category || timedOut || noTopicsError) return

    const queueQuery = query(
      collection(db, 'matchmaking'),
      where('category', '==', category),
      where('status', '==', 'waiting'),
    )

    const unsubscribeQueue = onSnapshot(queueQuery, async (snapshot) => {
      const entries = snapshot.docs.map((entryDoc) => ({
        id: entryDoc.id,
        ...entryDoc.data(),
      }))

      const myEntry = entries.find((entry) => entry.id === user.uid)
      if (!myEntry || myEntry.status !== 'waiting') return

      const opponents = entries.filter((entry) => entry.id !== user.uid)
      if (opponents.length === 0) return

      const opponent = opponents.sort(
        (a, b) => getCreatedAtMillis(a) - getCreatedAtMillis(b),
      )[0]

      if (!isHostUser(user.uid, opponent.id, myEntry, opponent)) return
      if (matchingRef.current) return

      matchingRef.current = true

      try {
        const result = await createMatch(user.uid, opponent.id, category)

        if (!result.success && result.reason === 'no_topics') {
          await deleteQueueEntry()
          await deleteDoc(doc(db, 'matchmaking', opponent.id))
          setNoTopicsError(true)
        }
      } catch (err) {
        if (err.message !== 'match_no_longer_available') {
          setError('Something went wrong while matching. Please try again.')
        }
      } finally {
        matchingRef.current = false
      }
    })

    return unsubscribeQueue
  }, [category, user.uid, timedOut, noTopicsError])

  useEffect(() => {
    if (!category || timedOut || noTopicsError) return

    const timeout = setTimeout(async () => {
      setTimedOut(true)
      try {
        await deleteQueueEntry()
      } catch {
        // Entry may have been removed by a successful match
      }
    }, MATCH_TIMEOUT_MS)

    return () => clearTimeout(timeout)
  }, [category, timedOut, noTopicsError, user.uid])

  if (noTopicsError) {
    return (
      <div className="matchmaking-page">
        <div className="matchmaking-card">
          <h1>No shared topics</h1>
          <p>
            You and your opponent have no overlapping available topics in{' '}
            <strong>{category}</strong>. Try a different category.
          </p>
          <button type="button" className="matchmaking-btn-primary" onClick={handleTryAgain}>
            Try Again
          </button>
          <button type="button" className="matchmaking-btn-secondary" onClick={handleGoBack}>
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (timedOut) {
    return (
      <div className="matchmaking-page">
        <div className="matchmaking-card">
          <h1>No opponent found</h1>
          <p>
            We could not find anyone in <strong>{category}</strong> within 60 seconds.
          </p>
          <button type="button" className="matchmaking-btn-primary" onClick={handleTryAgain}>
            Try Again
          </button>
          <button type="button" className="matchmaking-btn-secondary" onClick={handleGoBack}>
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="matchmaking-page">
      <div className="matchmaking-card">
        <p className="matchmaking-label">{category || 'Matchmaking'}</p>
        <h1>Finding opponent…</h1>
        <div className="matchmaking-spinner" aria-hidden="true" />
        <p className="matchmaking-status">Searching for a debater in your category</p>

        {error && <p className="matchmaking-error">{error}</p>}

        <button type="button" className="matchmaking-btn-secondary" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function getCreatedAtMillis(entry) {
  const createdAt = entry.createdAt
  if (!createdAt) return 0
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis()
  return 0
}
