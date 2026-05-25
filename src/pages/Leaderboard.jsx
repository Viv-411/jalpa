import { Link } from 'react-router-dom'
import './Leaderboard.css'

export default function Leaderboard() {
  return (
    <div className="leaderboard-page">
      <nav className="leaderboard-nav">
        <Link to="/" className="leaderboard-brand">
          Jalpa
        </Link>
        <Link to="/" className="leaderboard-back">
          ← Back to home
        </Link>
      </nav>

      <main className="leaderboard-main">
        <h1>Leaderboard</h1>
        <p className="leaderboard-empty">Coming soon — rankings will appear here.</p>
      </main>
    </div>
  )
}
