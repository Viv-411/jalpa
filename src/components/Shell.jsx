import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { House, LogOut, Swords, Trophy } from 'lucide-react'
import { auth } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { Avatar, Logo } from './ui'

const LINKS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/play', label: 'Play', icon: Swords },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
]

function AccountMenu({ profile }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="account__button"
        aria-label="Account"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={profile.name} size="sm" />
        <span className="account__name">{profile.name}</span>
      </button>
      {open && (
        <div className="account__menu">
          <div className="account__who">
            <Avatar name={profile.name} />
            <div>
              <p className="account__menu-name">{profile.name}</p>
              <p className="account__menu-meta">
                Rated {profile.elo ?? 1000}, {profile.wins ?? 0} won and {profile.losses ?? 0} lost
              </p>
            </div>
          </div>
          <button type="button" className="account__item" onClick={() => signOut(auth)}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// Page frame. `quiet` hides navigation during a debate so nobody leaves by
// accident; `wide` gives the debate room more room.
export default function Shell({ children, quiet = false, wide = false, status = null }) {
  const { profile } = useAuth()

  return (
    <div className={`shell${quiet ? ' shell--quiet' : ''}`}>
      <header className="topbar">
        <div className={`topbar__inner${wide ? ' topbar__inner--wide' : ''}`}>
          <Link to="/" className="topbar__logo" aria-label="Jalpa home">
            <Logo />
          </Link>
          {status}
          {!quiet && (
            <nav className="nav" aria-label="Main">
              {LINKS.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className="nav__link">
                  <Icon className="nav__icon" size={18} strokeWidth={2} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          )}
          {profile && (
            <div className="topbar__me">
              <span className="rating-chip" title="Your rating">
                <Trophy size={14} strokeWidth={2.25} aria-hidden="true" />
                <span className="visually-hidden">Rating </span>
                {profile.elo ?? 1000}
              </span>
              {quiet ? <Avatar name={profile.name} size="sm" /> : <AccountMenu profile={profile} />}
            </div>
          )}
        </div>
      </header>
      <main className={`page${wide ? ' page--wide' : ''}`}>{children}</main>
    </div>
  )
}
