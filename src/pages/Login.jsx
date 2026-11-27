import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../firebase'
import { Logo } from '../components/ui'
import Timeline from '../components/Timeline'
import { cleanName, setPendingName } from '../lib/profile'
import { SPEECHES } from '../../shared/format'
import { CATEGORIES } from '../../shared/topics'

const googleProvider = new GoogleAuthProvider()

function explain(error) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don’t match an account.'
    case 'auth/email-already-in-use':
      return 'There’s already an account with that email. Sign in instead.'
    case 'auth/weak-password':
      return 'Use a password with at least 6 characters.'
    case 'auth/invalid-email':
      return 'That doesn’t look like an email address.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.'
    case 'auth/network-request-failed':
      return 'Can’t reach the sign-in service. Check your connection.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return ''
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.'
    default:
      return 'Couldn’t sign you in. Try again.'
  }
}

const minutes = Math.round(SPEECHES.reduce((total, speech) => total + speech.seconds, 0) / 60)

// A handful of real resolutions to show on the sign-in page, one per subject.
const SAMPLES = CATEGORIES.map((category) => ({
  category: category.name,
  topic: category.topics[0],
}))

function ResolutionTicker() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = setInterval(() => setIndex((value) => (value + 1) % SAMPLES.length), 4500)
    return () => clearInterval(timer)
  }, [])

  const sample = SAMPLES[index]
  return (
    <figure className="ticker" aria-label="Example resolution">
      <div className="ticker__card" key={index}>
        <p className="ticker__meta">
          {sample.category}. {sample.topic.source}
        </p>
        <p className="ticker__text">{sample.topic.text}</p>
        <div className="ticker__sides" aria-hidden="true">
          <span className="ticker__side ticker__side--pro">Pro</span>
          <span className="ticker__vs">vs</span>
          <span className="ticker__side ticker__side--con">Con</span>
        </div>
      </div>
    </figure>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const signingUp = mode === 'signup'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (signingUp) {
        const displayName = cleanName(name)
        setPendingName(displayName)
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await updateProfile(credential.user, { displayName }).catch(() => {})
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (err) {
      setError(explain(err))
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    try {
      setPendingName('')
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setError(explain(err))
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <section className="login__pitch">
        <Logo />
        <div className="login__pitch-body">
          <h1 className="login__headline">Debate a real person on a real resolution, out loud.</h1>
          <p className="login__lede">
            Get a topic from the high school and college circuit, a side you didn&rsquo;t pick, and a
            minute to prepare. Then {minutes} minutes of speeches over voice, a written ballot from the
            judge, and a rating that moves.
          </p>
          <ResolutionTicker />
        </div>
        <div className="login__format">
          <p className="login__format-label">Every round</p>
          <Timeline speeches={SPEECHES} />
        </div>
      </section>

      <section className="login__panel">
        <form className="login__form" onSubmit={handleSubmit}>
          <div className="login__form-head">
            <h2>{signingUp ? 'Create your account' : 'Welcome back'}</h2>
            <p className="muted">
              {signingUp ? 'Pick the name your opponents will see.' : 'Sign in to find your next round.'}
            </p>
          </div>

          <button type="button" className="button button--outline button--block" onClick={handleGoogle} disabled={busy}>
            <GoogleMark />
            Continue with Google
          </button>

          <div className="divider" role="presentation">
            <span>or use email</span>
          </div>

          {signingUp && (
            <label className="field">
              <span className="field__label">Name shown to opponents</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={30}
                required
                autoComplete="nickname"
                placeholder="e.g. Sam Rivera"
              />
            </label>
          )}

          <label className="field">
            <span className="field__label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              placeholder={signingUp ? 'At least 6 characters' : ''}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="button button--primary button--block button--large" disabled={busy}>
            {busy ? 'One moment…' : signingUp ? 'Create account' : 'Sign in'}
          </button>

          <p className="login__switch">
            {signingUp ? 'Already have an account?' : 'New to Jalpa?'}{' '}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setMode(signingUp ? 'signin' : 'signup')
                setError('')
              }}
            >
              {signingUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </form>
      </section>
    </div>
  )
}
