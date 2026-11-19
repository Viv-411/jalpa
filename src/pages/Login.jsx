import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../firebase'
import { cleanName, setPendingName } from '../lib/profile'
import { SPEECHES } from '../../shared/format'

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
        <p className="brand brand--large">Jalpa</p>
        <h1 className="login__headline">Argue a real resolution against a real person, out loud.</h1>
        <p className="login__lede">
          You get a topic from the high school and college circuit, a side you didn&rsquo;t choose,
          and one minute to prepare. Then {minutes} minutes of speeches over voice, a written ballot
          from the judge, and a rating that moves.
        </p>
        <ol className="login__flow" aria-label="How a debate runs">
          {SPEECHES.map((speech) => (
            <li key={speech.key} className={`login__flow-item login__flow-item--${speech.side}`}>
              <span>{speech.name}</span>
              <span>{speech.seconds / 60 >= 1 ? `${speech.seconds / 60} min` : `${speech.seconds} sec`}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="login__form-wrap">
        <form className="sheet login__form" onSubmit={handleSubmit}>
          <h2>{signingUp ? 'Create your account' : 'Sign in'}</h2>

          {signingUp && (
            <label className="field">
              <span>Name shown to opponents</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={30}
                required
                autoComplete="nickname"
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              autoComplete={signingUp ? 'new-password' : 'current-password'}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="button button--primary button--block" disabled={busy}>
            {busy ? 'One moment…' : signingUp ? 'Create account' : 'Sign in'}
          </button>

          <button type="button" className="button button--block" onClick={handleGoogle} disabled={busy}>
            Continue with Google
          </button>

          <p className="login__switch">
            {signingUp ? 'Already have an account?' : 'New here?'}{' '}
            <button
              type="button"
              className="link-button"
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
