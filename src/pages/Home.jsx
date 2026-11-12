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
import { db } from '../firebase'
import Shell from '../components/Shell'
import { cleanName, useAuth } from '../context/AuthContext'
import { opponentOf, outcomeFor, shortDate, signed } from '../lib/results'
import { sideLabel } from '../../shared/format'

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
      <button
        type="button"
        className="link-button"
        onClick={() => {
          setValue(profile.name)
          setEditing(true)
        }}
      >
        Change name
      </button>
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
      <button type="submit" className="button button--small">
        Save name
      </button>
      <button type="button" className="link-button" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {error && <p className="form-error">{error}</p>}
    </form>
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
  const active = debates?.find(
    (debate) => debate.status === 'prep' || debate.status === 'live' || debate.status === 'judging',
  )
  const finished = debates?.filter((debate) => debate.status === 'complete') ?? []

  return (
    <Shell>
      <section className="pad-head">
        <div>
          <h1>{profile.name}</h1>
          <NameEditor profile={profile} />
        </div>
        <dl className="record">
          <div>
            <dt>Rating</dt>
            <dd className="record__rating">{profile.elo ?? 1000}</dd>
          </div>
          <div>
            <dt>Won</dt>
            <dd>{wins}</dd>
          </div>
          <div>
            <dt>Lost</dt>
            <dd>{losses}</dd>
          </div>
        </dl>
      </section>

      {active ? (
        <section className="callout callout--live">
          <div>
            <h2>{active.status === 'judging' ? 'Your last debate is with the judge' : 'You have a debate in progress'}</h2>
            <p>{active.topic}</p>
          </div>
          <Link to={`/debate/${active.id}`} className="button button--primary">
            {active.status === 'judging' ? 'See the ballot' : 'Rejoin debate'}
          </Link>
        </section>
      ) : (
        <section className="callout">
          <div>
            <h2>Ready for a round?</h2>
            <p>Pick a subject, get matched with someone near your rating, and debate over voice.</p>
          </div>
          <Link to="/play" className="button button--primary">
            Find a debate
          </Link>
        </section>
      )}

      <div className="columns">
        <section>
          <h2>Your debates</h2>
          {debates === null ? (
            <p className="muted">Loading…</p>
          ) : finished.length === 0 ? (
            <p className="muted">
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

        <section>
          <h2>Top of the leaderboard</h2>
          {top === null ? (
            <p className="muted">Loading…</p>
          ) : top.length === 0 ? (
            <p className="muted">No one is ranked yet. Finish a debate to be the first.</p>
          ) : (
            <ol className="mini-board">
              {top.map((player, index) => (
                <li key={player.uid} className={player.uid === profile.uid ? 'is-me' : ''}>
                  <span className="mini-board__rank">{index + 1}</span>
                  <span className="mini-board__name">{player.name}</span>
                  <span className="mini-board__elo">{player.elo}</span>
                </li>
              ))}
            </ol>
          )}
          <p>
            <Link to="/leaderboard">See the full leaderboard</Link>
          </p>
        </section>
      </div>
    </Shell>
  )
}
