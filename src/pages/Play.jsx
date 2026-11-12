import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import { api } from '../lib/api'
import { formatClock, PREP_SECONDS, SPEECHES } from '../../shared/format'
import { ANY_CATEGORY, CATEGORIES } from '../../shared/topics'

const POLL_MS = 2500

const CHOICES = [
  { id: ANY_CATEGORY, name: 'Any subject', blurb: 'Fastest match. The topic could come from anywhere.' },
  ...CATEGORIES,
]

function Searching({ choice, onCancel }) {
  const navigate = useNavigate()
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const matchedRef = useRef(false)

  useEffect(() => {
    let stopped = false
    let timer = null

    async function poll() {
      try {
        const result = await api('matchmake', { action: 'search', category: choice.id })
        if (stopped) return
        setError('')
        if (result.status === 'matched') {
          matchedRef.current = true
          navigate(`/debate/${result.debateId}`)
          return
        }
      } catch (err) {
        if (stopped) return
        setError(err.message)
      }
      timer = setTimeout(poll, POLL_MS)
    }
    poll()

    const clock = setInterval(() => setSeconds((value) => value + 1), 1000)

    return () => {
      stopped = true
      clearTimeout(timer)
      clearInterval(clock)
      // Step out of the queue unless we're leaving because we got a match.
      if (!matchedRef.current) api('matchmake', { action: 'leave' }).catch(() => {})
    }
  }, [choice.id, navigate])

  return (
    <section className="sheet searching" aria-live="polite">
      <div className="searching__pulse" aria-hidden="true">
        <span />
        <span />
      </div>
      <h1>Looking for an opponent</h1>
      <p>
        {choice.name}, waiting {formatClock(seconds)}
      </p>
      <p className="muted">
        {seconds < 30
          ? 'Searching near your rating first, then widening.'
          : 'Now matching against any rating. Keep this tab open; you’ll go straight in when someone joins.'}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="button" onClick={onCancel}>
        Stop searching
      </button>
    </section>
  )
}

export default function Play() {
  const [choice, setChoice] = useState(null)

  if (choice) {
    return (
      <Shell quiet>
        <Searching choice={choice} onCancel={() => setChoice(null)} />
      </Shell>
    )
  }

  return (
    <Shell>
      <section className="pad-head">
        <div>
          <h1>What do you want to argue about?</h1>
          <p className="muted">
            You choose the subject. The resolution and your side are assigned when you&rsquo;re
            matched.
          </p>
        </div>
      </section>

      <ul className="category-grid">
        {CHOICES.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              className={`category${category.id === ANY_CATEGORY ? ' category--any' : ''}`}
              onClick={() => setChoice(category)}
            >
              <span className="category__name">{category.name}</span>
              <span className="category__blurb">{category.blurb}</span>
            </button>
          </li>
        ))}
      </ul>

      <section className="format">
        <h2>How a round runs</h2>
        <p>
          After you&rsquo;re matched you get {PREP_SECONDS} seconds to prepare. Then you alternate
          speeches. Only the speaker&rsquo;s microphone is on, and a judge reads the transcript to
          decide the round.
        </p>
        <ol className="format__list">
          {SPEECHES.map((speech) => (
            <li key={speech.key} className={`format__item format__item--${speech.side}`}>
              <span className="format__name">{speech.name}</span>
              <span className="format__time">{formatClock(speech.seconds)}</span>
              <span className="format__blurb">{speech.blurb}</span>
            </li>
          ))}
        </ol>
      </section>
    </Shell>
  )
}
