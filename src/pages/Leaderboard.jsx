import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ArrowRight } from 'lucide-react'
import { db } from '../firebase'
import Shell from '../components/Shell'
import { Avatar, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'

function winRate(player) {
  const played = (player.wins ?? 0) + (player.losses ?? 0)
  return played ? `${Math.round(((player.wins ?? 0) / played) * 100)}%` : '–'
}

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
  const myRank = players ? players.findIndex((player) => player.uid === profile.uid) + 1 : 0

  return (
    <Shell>
      <header className="page-head page-head--split">
        <div>
          <h1>Leaderboard</h1>
          <p className="page-head__lede">
            Everyone starts at 1000. Beating a higher-rated debater moves you further than beating a
            lower-rated one.
          </p>
        </div>
        {myRank > 0 && (
          <p className="my-rank">
            <span className="my-rank__label">Your rank</span>
            <span className="my-rank__value">{myRank}</span>
          </p>
        )}
      </header>

      {failed ? (
        <p className="form-error" role="alert">
          Couldn&rsquo;t load the leaderboard. Check your connection and reload.
        </p>
      ) : players === null ? (
        <div className="center-state">
          <Spinner label="Loading…" />
        </div>
      ) : players.length === 0 ? (
        <section className="hero">
          <div className="hero__body">
            <h2 className="hero__title">No one is ranked yet</h2>
            <p className="hero__text">The board fills in as debates finish. Yours could be the first.</p>
          </div>
          <Link to="/play" className="button button--light button--large">
            Find a debate
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <>
          <div className="panel panel--flush">
            <table className="board">
              <thead>
                <tr>
                  <th scope="col" className="board__rank-col">
                    Rank
                  </th>
                  <th scope="col">Debater</th>
                  <th scope="col" className="num board__wide">
                    Won
                  </th>
                  <th scope="col" className="num board__wide">
                    Lost
                  </th>
                  <th scope="col" className="num board__wide">
                    Win rate
                  </th>
                  <th scope="col" className="num">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, index) => (
                  <tr key={player.uid} className={player.uid === profile.uid ? 'is-me' : ''}>
                    <td className="board__rank-col">
                      <span className={`rank rank--${index + 1}`}>{index + 1}</span>
                    </td>
                    <td>
                      <span className="board__player">
                        <Avatar name={player.name} size="sm" />
                        <span className="board__name">
                          <span>
                            {player.name}
                            {player.uid === profile.uid && <span className="you-badge">You</span>}
                          </span>
                          <span className="board__record">
                            {player.wins ?? 0} won, {player.losses ?? 0} lost
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="num board__wide">{player.wins ?? 0}</td>
                    <td className="num board__wide">{player.losses ?? 0}</td>
                    <td className="num board__wide">{winRate(player)}</td>
                    <td className="num board__elo">{player.elo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!ranked && (
            <p className="board__note">
              You&rsquo;ll appear here after your first judged debate.{' '}
              <Link to="/play">Find a debate</Link>
            </p>
          )}
        </>
      )}
    </Shell>
  )
}
