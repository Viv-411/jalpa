import { formatClock, sideLabel } from '../../shared/format'

// The round laid out like a debater's flow sheet: Pro down the left column,
// Con down the right, speeches in the order they happen.
export default function Flow({ debate, uid, now }) {
  const { speeches } = debate.schedule
  const live = debate.status === 'live'

  const header = (side) => {
    const who = debate[side]
    return (
      <div className={`flow__head flow__head--${side}`}>
        <span className="flow__side">{sideLabel(side)}</span>
        <span className="flow__who">{who === uid ? 'You' : debate.names[who]}</span>
      </div>
    )
  }

  return (
    <section className="flow" aria-label="Order of speeches">
      {header('pro')}
      {header('con')}
      {speeches.map((speech, index) => {
        const state = !live ? 'next' : index < debate.phase ? 'done' : index === debate.phase ? 'now' : 'next'
        const started = state === 'now' && now >= debate.phaseStartsAt
        const label = speech.name.replace(/^(Pro|Con) /, '')
        return (
          <div
            key={speech.key}
            className={`flow__cell flow__cell--${speech.side} flow__cell--${state}`}
            aria-current={state === 'now' ? 'step' : undefined}
          >
            <span className="flow__name">{label.charAt(0).toUpperCase() + label.slice(1)}</span>
            <span className="flow__time">
              {state === 'done'
                ? 'Done'
                : started
                  ? formatClock((debate.phaseEndsAt - now) / 1000)
                  : formatClock(speech.seconds)}
            </span>
          </div>
        )
      })}
    </section>
  )
}
