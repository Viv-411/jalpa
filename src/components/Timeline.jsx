import { formatClock } from '../../shared/format'

function shortName(name) {
  const label = name.replace(/^(Pro|Con) /, '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// The round as one bar: each speech is a segment sized by its length and
// colored by side. The current speech fills as its clock runs.
//
//   speeches  the schedule
//   names     { pro, con } labels for the legend, or null to hide it
//   phase     index of the current speech, or -1 before the round starts
//   live      true once speeches are underway
export default function Timeline({ speeches, names = null, phase = -1, live = false, startsAt, endsAt, now }) {
  return (
    <section className="timeline" aria-label="Order of speeches">
      {names && (
        <div className="timeline__legend">
          <span className="timeline__key timeline__key--pro">Pro: {names.pro}</span>
          <span className="timeline__key timeline__key--con">Con: {names.con}</span>
        </div>
      )}
      <ol className="timeline__track">
        {speeches.map((speech, index) => {
          const state = !live ? 'next' : index < phase ? 'done' : index === phase ? 'now' : 'next'
          const started = state === 'now' && now >= startsAt
          const total = Math.max(1, endsAt - startsAt)
          const progress =
            state === 'done' ? 1 : started ? Math.min(1, Math.max(0, (now - startsAt) / total)) : 0
          return (
            <li
              key={speech.key}
              className={`timeline__seg timeline__seg--${speech.side} timeline__seg--${state}`}
              style={{ flexGrow: speech.seconds }}
              aria-current={state === 'now' ? 'step' : undefined}
            >
              <span className="timeline__bar" aria-hidden="true">
                <span className="timeline__fill" style={{ transform: `scaleX(${progress})` }} />
              </span>
              <span className="timeline__name">
                <span className="visually-hidden">{speech.side === 'pro' ? 'Pro ' : 'Con '}</span>
                {shortName(speech.name)}
              </span>
              <span className="timeline__time">
                {state === 'done'
                  ? 'Done'
                  : started
                    ? formatClock((endsAt - now) / 1000)
                    : formatClock(speech.seconds)}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
