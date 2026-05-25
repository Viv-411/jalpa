import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIES } from '../data/topics'
import './TopicSelect.css'

export default function TopicSelect() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  async function handleCategorySelect(category) {
    setError('')
    setJoining(true)

    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      const elo = userSnap.data()?.elo ?? 1000

      await setDoc(doc(db, 'matchmaking', user.uid), {
        uid: user.uid,
        category,
        elo,
        status: 'waiting',
        createdAt: serverTimestamp(),
      })

      navigate('/matchmaking')
    } catch (err) {
      setError('Could not join matchmaking. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="topic-select-page">
      <header className="topic-select-header topic-select-header--wide">
        <h1>Choose a category</h1>
        <p>Pick a subject area to find an opponent with a similar rating.</p>
      </header>

      {error && <p className="topic-select-error">{error}</p>}

      <div className="topic-category-grid">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className="topic-category-card"
            onClick={() => handleCategorySelect(category)}
            disabled={joining}
          >
            <span className="topic-category-name">{category}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
