import { Link } from 'react-router-dom'
import { opponentOf, outcomeFor, reasonText, signed } from '../lib/results'
import { sideLabel } from '../../shared/format'

const CRITERIA = [
  { key: 'argument', name: 'Arguments', help: 'Strength and logic of the case' },
  { key: 'evidence', name: 'Evidence', help: 'Support and reasoning behind claims' },
  { key: 'clash', name: 'Clash', help: 'Direct answers to the opponent' },
  { key: 'clarity', name: 'Clarity', help: 'Structure and ease of following' },
]

const HEADLINE = { won: 'You won', lost: 'You lost', void: 'No contest' }

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

  return (
    <article className="ballot">
      <header className={`ballot__verdict ballot__verdict--${outcome.kind}`}>
        <div>
          <h1>{HEADLINE[outcome.kind] ?? 'Result'}</h1>
          <p>{reasonText(debate, uid)}</p>
        </div>
        {rating && (
          <div className="ballot__rating" aria-label="Rating change">
            <span className="ballot__change">{signed(rating.change)}</span>
            <span className="ballot__rating-line">
              Rating {rating.before} to {rating.after}
            </span>
          </div>
        )}
      </header>

      <section className="sheet ballot__sheet">
        <p className="resolution__label">
          Resolved <span className="resolution__source">{debate.categoryName}. {debate.topicSource}</span>
        </p>
        <p className="resolution__text">{debate.topic}</p>
        <p className="muted">
          You argued {sideLabel(mySide)} against {debate.names[opponent]}.
        </p>

        {judgment && (
          <>
            <h2>Reason for decision</h2>
            <p className="ballot__decision">{judgment.decision}</p>

            <table className="scores">
              <caption className="visually-hidden">Scores out of 10</caption>
              <thead>
                <tr>
                  <th scope="col">Scored out of 10</th>
                  <th scope="col" className="num scores__pro">
                    Pro, {nameFor('pro')}
                  </th>
                  <th scope="col" className="num scores__con">
                    Con, {nameFor('con')}
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
                    <td className="num">{judgment.scores.pro[criterion.key]}</td>
                    <td className="num">{judgment.scores.con[criterion.key]}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total out of 40</th>
                  <td className="num">{judgment.totals.pro}</td>
                  <td className="num">{judgment.totals.con}</td>
                </tr>
              </tfoot>
            </table>

            {judgment.keyClash?.length > 0 && (
              <>
                <h2>Where the round was decided</h2>
                <ul className="ballot__list">
                  {judgment.keyClash.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </>
            )}

            {myFeedback && (
              <div className="feedback">
                {myFeedback.strengths?.length > 0 && (
                  <div>
                    <h2>What you did well</h2>
                    <ul className="ballot__list">
                      {myFeedback.strengths.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {myFeedback.improvements?.length > 0 && (
                  <div>
                    <h2>What to work on</h2>
                    <ul className="ballot__list">
                      {myFeedback.improvements.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {transcriptCount > 0 && (
          <details className="transcript">
            <summary>Read the transcript</summary>
            {debate.schedule.speeches.map((speech, index) => {
              const entry = speeches[index]
              return (
                <div key={speech.key} className={`transcript__speech transcript__speech--${speech.side}`}>
                  <h3>
                    {speech.name}, {nameFor(speech.side)}
                  </h3>
                  <p>{entry?.text ? entry.text : 'No speech was recorded.'}</p>
                </div>
              )
            })}
          </details>
        )}
      </section>

      <div className="ballot__actions">
        <Link to="/play" className="button button--primary">
          Find another debate
        </Link>
        <Link to="/leaderboard" className="button">
          Leaderboard
        </Link>
      </div>
    </article>
  )
}
