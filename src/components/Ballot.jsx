import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Lightbulb, Sparkles, Swords, Trophy } from 'lucide-react'
import { opponentOf, outcomeFor, reasonText, signed } from '../lib/results'
import { sideLabel } from '../../shared/format'
import { Avatar, Resolution } from './ui'

const CRITERIA = [
  { key: 'argument', name: 'Arguments', help: 'Strength and logic of the case' },
  { key: 'evidence', name: 'Evidence', help: 'Support and reasoning behind claims' },
  { key: 'clash', name: 'Clash', help: 'Direct answers to the opponent' },
  { key: 'clarity', name: 'Clarity', help: 'Structure and ease of following' },
]

const HEADLINE = { won: 'You won', lost: 'You lost', void: 'No contest' }

function ScoreCell({ side, value, max = 10 }) {
  return (
    <td className={`scores__cell scores__cell--${side}`}>
      <span className="scores__bar" aria-hidden="true">
        <span className="scores__fill" style={{ transform: `scaleX(${value / max})` }} />
      </span>
      <span className="scores__value">{value}</span>
    </td>
  )
}

function FeedbackList({ title, icon: Icon, tone, points }) {
  if (!points?.length) return null
  return (
    <div className={`feedback__block feedback__block--${tone}`}>
      <h3>
        <Icon size={16} aria-hidden="true" />
        {title}
      </h3>
      <ul>
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  )
}

// The judge's ballot: decision, scores, feedback and the transcript.
export default function Ballot({ debate, uid, speeches }) {
  const outcome = outcomeFor(debate, uid)
  const result = debate.result ?? {}
  const judgment = result.judgment
  const mySide = debate.sides[uid]
  const opponent = opponentOf(debate, uid)
  const rating = result.elo?.[uid]
  const nameFor = (side) => (debate[side] === uid ? 'You' : debate.names[debate[side]])
  const myFeedback = judgment?.feedback?.[mySide]
  const transcriptCount = Object.keys(speeches).length
  const winnerSide = result.winner ? debate.sides[result.winner] : null

  return (
    <article className="ballot">
      <header className={`verdict verdict--${outcome.kind}`}>
        <div className="verdict__main">
          <span className="verdict__icon" aria-hidden="true">
            {outcome.kind === 'won' ? <Trophy size={26} /> : <Swords size={26} />}
          </span>
          <div>
            <h1>{HEADLINE[outcome.kind] ?? 'Result'}</h1>
            <p className="verdict__reason">{reasonText(debate, uid)}</p>
          </div>
        </div>
        {rating && (
          <div className="verdict__rating" aria-label="Rating change">
            <span className="ballot__change">{signed(rating.change)}</span>
            <span className="verdict__rating-line">
              Rating {rating.before} to {rating.after}
            </span>
          </div>
        )}
      </header>

      <div className="ballot__grid">
        <div className="ballot__main">
          <Resolution debate={debate} compact />
          <p className="ballot__sides">
            You argued <strong>{sideLabel(mySide)}</strong> against {debate.names[opponent]}.
          </p>

          {judgment && (
            <>
              <section className="panel ballot__section ballot__section--decision">
                <h2>Reason for decision</h2>
                <p className="ballot__decision">{judgment.decision}</p>
              </section>

              {judgment.keyClash?.length > 0 && (
                <section className="panel ballot__section ballot__section--clash">
                  <h2>Where the round was decided</h2>
                  <ul className="clash-list">
                    {judgment.keyClash.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </section>
              )}

              {myFeedback && (myFeedback.strengths?.length > 0 || myFeedback.improvements?.length > 0) && (
                <section className="panel ballot__section ballot__section--feedback">
                  <h2>Feedback for you</h2>
                  <div className="feedback">
                    <FeedbackList title="What you did well" icon={Sparkles} tone="good" points={myFeedback.strengths} />
                    <FeedbackList
                      title="What to work on"
                      icon={Lightbulb}
                      tone="work"
                      points={myFeedback.improvements}
                    />
                  </div>
                </section>
              )}
            </>
          )}

          {transcriptCount > 0 && (
            <details className="panel transcript">
              <summary>
                Read the transcript
                <ChevronDown className="transcript__chevron" size={18} aria-hidden="true" />
              </summary>
              <div className="transcript__body">
                {debate.schedule.speeches.map((speech, index) => {
                  const entry = speeches[index]
                  return (
                    <div key={speech.key} className={`transcript__speech transcript__speech--${speech.side}`}>
                      <h3>
                        {speech.name}
                        <span className="transcript__who">{nameFor(speech.side)}</span>
                      </h3>
                      <p>{entry?.text ? entry.text : 'No speech was recorded.'}</p>
                    </div>
                  )
                })}
              </div>
            </details>
          )}
        </div>

        <aside className="ballot__side">
          {judgment && (
            <section className="panel ballot__scores">
              <h2>Scores</h2>
              <table className="scores">
                <caption className="visually-hidden">Scores out of 10</caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="visually-hidden">Criterion</span>
                    </th>
                    <th scope="col" className="scores__head scores__head--pro">
                      <span className="scores__head-inner">
                        <Avatar name={debate.names[debate.pro]} side="pro" size="sm" />
                        <span>
                          Pro
                          <span className="scores__who">{nameFor('pro')}</span>
                        </span>
                      </span>
                    </th>
                    <th scope="col" className="scores__head scores__head--con">
                      <span className="scores__head-inner">
                        <Avatar name={debate.names[debate.con]} side="con" size="sm" />
                        <span>
                          Con
                          <span className="scores__who">{nameFor('con')}</span>
                        </span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CRITERIA.map((criterion) => (
                    <tr key={criterion.key}>
                      <th scope="row">
                        {criterion.name}
                        <span className="scores__help">{criterion.help}</span>
                      </th>
                      <ScoreCell side="pro" value={judgment.scores.pro[criterion.key]} />
                      <ScoreCell side="con" value={judgment.scores.con[criterion.key]} />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total out of 40</th>
                    <td className={`scores__total${winnerSide === 'pro' ? ' is-winner' : ''}`}>
                      {judgment.totals.pro}
                    </td>
                    <td className={`scores__total${winnerSide === 'con' ? ' is-winner' : ''}`}>
                      {judgment.totals.con}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>
          )}

          <div className="ballot__actions">
            <Link to="/play" className="button button--primary button--block button--large">
              Find another debate
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/leaderboard" className="button button--outline button--block">
              Leaderboard
            </Link>
          </div>
        </aside>
      </div>
    </article>
  )
}
