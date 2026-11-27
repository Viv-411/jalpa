import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { ArrowRight, Check, Pencil, Radio, X } from 'lucide-react'
import { db } from '../firebase'
import Shell from '../components/Shell'
import { Avatar } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { cleanName } from '../lib/profile'
import { opponentOf, outcomeFor, shortDate, signed } from '../lib/results'
import { sideLabel, SPEECHES } from '../../shared/format'

const MINUTES = Math.round(SPEECHES.reduce((total, speech) => total + speech.seconds, 0) / 60)

function NameEditor({ profile }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(profile.name)
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault()
    const name = cleanName(value)
    if (!name) return
    try {
      await updateDoc(doc(db, 'users', profile.uid), { name })
      setEditing(false)
      setError('')
    } catch {
      setError('Couldn’t save that name. Try again.')
    }
  }

  if (!editing) {
    return (
      <div className="profile__name-row">
        <h1 className="profile__name">{profile.name}</h1>
        <button
          type="button"
          className="icon-button"
          aria-label="Change name"
          title="Change name"
          onClick={() => {
            setValue(profile.name)
            setEditing(true)
          }}
        >
          <Pencil size={16} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <form className="name-editor" onSubmit={save}>
      <label className="visually-hidden" htmlFor="display-name">
        Display name
      </label>
      <input
        id="display-name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={30}
        autoFocus
      />
      <button type="submit" className="icon-button icon-button--solid" aria-label="Save name" title="Save name">
        <Check size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Cancel"
        title="Cancel"
        onClick={() => setEditing(false)}
      >
        <X size={16} aria-hidden="true" />
      </button>
      {error && <p className="form-error">{error}</p>}
    </form>
  )
}

// Rating over the last few debates, oldest first.
function ratingHistory(finished, uid) {
  const ordered = [...finished].sort((a, b) => a.createdAt - b.createdAt)
  const points = []
  for (const debate of ordered) {
    const elo = debate.result?.elo?.[uid]
    if (!elo) continue
    if (points.length === 0) points.push(elo.before)
    points.push(elo.after)
  }
  return points
}

function Sparkline({ points }) {
  if (points.length < 2) {
    return <p className="sparkline__empty">Your rating graph starts after your first judged debate.</p>
  }
  const width = 240
  const height = 56
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = Math.max(1, max - min)
  const x = (index) => (index / (points.length - 1)) * width
  const y = (value) => height - 4 - ((value - min) / span) * (height - 8)
  const line = points.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
  const change = points[points.length - 1] - points[0]
  return (
    <figure className="sparkline">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <polygon className="sparkline__area" points={`0,${height} ${line} ${width},${height}`} />
        <polyline className="sparkline__line" points={line} />
        <circle
          className="sparkline__dot"
          cx={x(points.length - 1)}
          cy={y(points[points.length - 1])}
          r="3.5"
        />
      </svg>
      <figcaption>
        {signed(change)} over your last {points.length - 1} {points.length === 2 ? 'debate' : 'debates'}
      </figcaption>
    </figure>
  )
}

export default function Home() {
  const { profile } = useAuth()
  const [debates, setDebates] = useState(null)
  const [top, setTop] = useState(null)

  useEffect(() => {
    const recent = query(
      collection(db, 'debates'),
      where('players', 'array-contains', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(12),
    )
    return onSnapshot(
      recent,
      (snapshot) => setDebates(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
      () => setDebates([]),
    )
  }, [profile.uid])

  useEffect(() => {
    const leaders = query(collection(db, 'users'), orderBy('elo', 'desc'), limit(25))
    return onSnapshot(
      leaders,
      (snapshot) =>
        setTop(
          snapshot.docs
            .map((entry) => ({ uid: entry.id, ...entry.data() }))
            .filter((player) => (player.debates ?? 0) > 0)
            .slice(0, 5),
        ),
      () => setTop([]),
    )
  }, [])

  const wins = profile.wins ?? 0
  const losses = profile.losses ?? 0
  const played = wins + losses
  const active = debates?.find(
    (debate) => debate.status === 'prep' || debate.status === 'live' || debate.status === 'judging',
  )
  const finished = debates?.filter((debate) => debate.status === 'complete') ?? []

  return (
    <Shell>
      <div className="home">
        <section className="profile" aria-label="Your profile">
          <div className="profile__who">
            <Avatar name={profile.name} size="lg" />
            <NameEditor profile={profile} />
          </div>
          <dl className="record">
            <div className="record__item record__item--rating">
              <dt>Rating</dt>
              <dd className="record__rating">{profile.elo ?? 1000}</dd>
            </div>
            <div className="record__item">
              <dt>Won</dt>
              <dd>{wins}</dd>
            </div>
            <div className="record__item">
              <dt>Lost</dt>
              <dd>{losses}</dd>
            </div>
            <div className="record__item">
              <dt>Win rate</dt>
              <dd>{played ? `${Math.round((wins / played) * 100)}%` : '–'}</dd>
            </div>
          </dl>
          <Sparkline points={ratingHistory(finished, profile.uid)} />
        </section>

        {active ? (
          <section className="hero hero--live">
            <div className="hero__body">
              <p className="hero__eyebrow">
                <Radio size={16} aria-hidden="true" />
                {active.status === 'judging' ? 'With the judge' : 'In progress'}
              </p>
              <h2 className="hero__title">
                {active.status === 'judging'
                  ? 'Your last debate is with the judge'
                  : 'You have a debate in progress'}
              </h2>
              <p className="hero__text">{active.topic}</p>
            </div>
            <Link to={`/debate/${active.id}`} className="button button--light button--large">
              {active.status === 'judging' ? 'See the ballot' : 'Rejoin debate'}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </section>
        ) : (
          <section className="hero">
            <div className="hero__body">
              <h2 className="hero__title">Ready for a round?</h2>
              <p className="hero__text">
                Pick a subject and get matched with someone near your rating. You&rsquo;ll get a real
                tournament resolution, a random side and a minute to prep, then {MINUTES} minutes of
                speeches over voice.
              </p>
            </div>
            <Link to="/play" className="button button--light button--large">
              Find a debate
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </section>
        )}

        <section className="panel home__history">
          <div className="panel__head">
            <h2>Your debates</h2>
          </div>
          {debates === null ? (
            <p className="panel__empty">Loading…</p>
          ) : finished.length === 0 ? (
            <p className="panel__empty">
              Nothing here yet. Your results and ballots show up after your first debate.
            </p>
          ) : (
            <ul className="match-list">
              {finished.map((debate) => {
                const outcome = outcomeFor(debate, profile.uid)
                const side = debate.sides?.[profile.uid]
                return (
                  <li key={debate.id}>
                    <Link to={`/debate/${debate.id}`} className="match">
                      <span className={`match__result match__result--${outcome.kind}`}>
                        {outcome.label}
                      </span>
                      <span className="match__body">
                        <span className="match__topic">{debate.topic}</span>
                        <span className="match__meta">
                          {sideLabel(side)} against {debate.names?.[opponentOf(debate, profile.uid)]},{' '}
                          {shortDate(debate.createdAt)}
                        </span>
                      </span>
                      <span className={`match__change match__change--${outcome.kind}`}>
                        {signed(outcome.change)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="panel home__top">
          <div className="panel__head">
            <h2>Top debaters</h2>
            <Link to="/leaderboard" className="panel__link">
              Full leaderboard
            </Link>
          </div>
          {top === null ? (
            <p className="panel__empty">Loading…</p>
          ) : top.length === 0 ? (
            <p className="panel__empty">No one is ranked yet. Finish a debate to be the first.</p>
          ) : (
            <ol className="mini-board">
              {top.map((player, index) => (
                <li key={player.uid} className={player.uid === profile.uid ? 'is-me' : ''}>
                  <span className={`rank rank--${index + 1}`}>{index + 1}</span>
                  <Avatar name={player.name} size="sm" />
                  <span className="mini-board__name">
                    {player.name}
                    {player.uid === profile.uid && <span className="you-badge">You</span>}
                  </span>
                  <span className="mini-board__elo">{player.elo}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Shell>
  )
}
