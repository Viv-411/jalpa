import { Link, NavLink } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../context/AuthContext'

// Page frame: the dark binding strip across the top of the pad, then the page.
// `quiet` hides navigation during a debate so nobody leaves by accident.
export default function Shell({ children, quiet = false, wide = false }) {
  const { profile } = useAuth()

  return (
    <div className="shell">
      <header className="binding">
        <div className="binding__inner">
          <Link to="/" className="brand" aria-label="Jalpa home">
            Jalpa
          </Link>
          {!quiet && (
            <nav className="nav" aria-label="Main">
              <NavLink to="/" end>
                Home
              </NavLink>
              <NavLink to="/play">Debate</NavLink>
              <NavLink to="/leaderboard">Leaderboard</NavLink>
            </nav>
          )}
          {profile && (
            <div className="binding__me">
              <span className="binding__name">{profile.name}</span>
              <span className="binding__elo" title="Your rating">
                {profile.elo ?? 1000}
              </span>
              {!quiet && (
                <button type="button" className="link-button link-button--light" onClick={() => signOut(auth)}>
                  Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </header>
      <main className={`page${wide ? ' page--wide' : ''}`}>{children}</main>
    </div>
  )
}
