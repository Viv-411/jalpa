import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import Shell from '../components/Shell'
import { useAuth } from '../context/AuthContext'

export default function Leaderboard() {
  const { profile } = useAuth()
  const [players, setPlayers] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const leaders = query(collection(db, 'users'), orderBy('elo', 'desc'), limit(200))
    return onSnapshot(
      leaders,
      (snapshot) => {
        setFailed(false)
        setPlayers(
          snapshot.docs
            .map((entry) => ({ uid: entry.id, ...entry.data() }))
            .filter((player) => (player.debates ?? 0) > 0)
            .slice(0, 100),
        )
      },
      () => setFailed(true),
    )
  }, [])

  const ranked = (profile.debates ?? 0) > 0

  return (
    <Shell>
      <section className="pad-head">
        <div>
          <h1>Leaderboard</h1>
          <p className="muted">
            Everyone starts at 1000. Beating a higher-rated debater moves you further than beating a
            lower-rated one.
          </p>
        </div>
      </section>

      {failed ? (
        <p className="form-error" role="alert">
          Couldn&rsquo;t load the leaderboard. Check your connection and reload.
        </p>
      ) : players === null ? (
        <p className="muted">Loading…</p>
      ) : players.length === 0 ? (
        <div className="callout">
          <div>
            <h2>No one is ranked yet</h2>
            <p>The board fills in as debates finish. Yours could be the first.</p>
          </div>
          <Link to="/play" className="button button--primary">
            Find a debate
          </Link>
        </div>
      ) : (
        <>
          <table className="board">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Debater</th>
                <th scope="col" className="num">
                  Rating
                </th>
                <th scope="col" className="num">
                  Won
                </th>
                <th scope="col" className="num">
                  Lost
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.uid} className={player.uid === profile.uid ? 'is-me' : ''}>
                  <td>{index + 1}</td>
                  <td>
                    {player.name}
                    {player.uid === profile.uid && <span className="board__you"> (you)</span>}
                  </td>
                  <td className="num board__elo">{player.elo}</td>
                  <td className="num">{player.wins ?? 0}</td>
                  <td className="num">{player.losses ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ranked && (
            <p className="muted">
              You&rsquo;ll appear here after your first judged debate.{' '}
              <Link to="/play">Find a debate</Link>
            </p>
          )}
        </>
      )}
    </Shell>
  )
}
