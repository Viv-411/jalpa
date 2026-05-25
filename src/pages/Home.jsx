import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import './Home.css'

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const snapshot = await getDoc(doc(db, 'users', user.uid))
        if (snapshot.exists()) {
          setProfile(snapshot.data())
        }
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user.uid])

  async function handleSignOut() {
    await signOut(auth)
    navigate('/login')
  }

  const displayName = profile?.name || user.displayName || 'Debater'
  const elo = profile?.elo ?? 1000

  return (
    <div className="home-page">
      <nav className="home-nav">
        <Link to="/" className="home-brand">
          Jalpa
        </Link>
        <button type="button" className="home-sign-out" onClick={handleSignOut}>
          Sign out
        </button>
      </nav>

      <main className="home-main">
        <section className="home-welcome">
          <h1>Hello, {loading ? '…' : displayName}</h1>
          <div className="home-stat-card">
            <span className="home-stat-label">ELO Rating</span>
            <span className="home-stat-value">{loading ? '—' : elo}</span>
          </div>
        </section>

        <Link to="/topics" className="home-find-debate">
          Find a Debate
        </Link>

        <section className="home-section">
          <h2>Recent Matches</h2>
          <div className="home-empty-state">
            <p>No debates yet — find your first match</p>
          </div>
        </section>

        <section className="home-section">
          <div className="home-section-header">
            <h2>Leaderboard</h2>
            <Link to="/leaderboard" className="home-section-link">
              View all
            </Link>
          </div>
          <Link to="/leaderboard" className="home-leaderboard-preview">
            <p>See how you rank against other debaters</p>
            <span>Go to leaderboard →</span>
          </Link>
        </section>
      </main>
    </div>
  )
}
