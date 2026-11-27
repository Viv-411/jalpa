import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain,
  Briefcase,
  Cpu,
  Globe2,
  HeartPulse,
  Landmark,
  Leaf,
  Scale,
  Shuffle,
  Zap,
} from 'lucide-react'
import Shell from '../components/Shell'
import Timeline from '../components/Timeline'
import { api } from '../lib/api'
import { formatClock, PREP_SECONDS, SPEECHES } from '../../shared/format'
import { ANY_CATEGORY, CATEGORIES } from '../../shared/topics'

const POLL_MS = 2500

const ICONS = {
  [ANY_CATEGORY]: Shuffle,
  world: Globe2,
  economy: Briefcase,
  justice: Scale,
  tech: Cpu,
  environment: Leaf,
  society: HeartPulse,
  democracy: Landmark,
  ethics: Brain,
}

const ANY = {
  id: ANY_CATEGORY,
  name: 'Any subject',
  blurb: 'The fastest way to a match. Your resolution could come from any of the eight subjects.',
}

const TOTAL_SECONDS = PREP_SECONDS + SPEECHES.reduce((total, speech) => total + speech.seconds, 0)

function Searching({ choice, onCancel }) {
  const navigate = useNavigate()
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const matchedRef = useRef(false)
  const Icon = ICONS[choice.id] ?? Shuffle

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
    <section className="searching" aria-live="polite">
      <div className="radar" aria-hidden="true">
        <span className="radar__ring" />
        <span className="radar__ring" />
        <span className="radar__ring" />
        <span className="radar__core">
          <Icon size={28} strokeWidth={1.75} />
        </span>
      </div>
      <h1>Looking for an opponent</h1>
      <p className="searching__subject">{choice.name}</p>
      <p className="searching__clock" aria-label={`Waiting ${formatClock(seconds)}`}>
        {formatClock(seconds)}
      </p>
      <p className="searching__hint">
        {seconds < 30
          ? 'Searching near your rating first, then widening.'
          : 'Now matching against any rating. Keep this tab open and you’ll go straight in when someone joins.'}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="button button--outline" onClick={onCancel}>
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
      <header className="page-head">
        <h1>Pick a subject</h1>
        <p className="page-head__lede">
          You choose what to argue about. The resolution and your side are assigned when you&rsquo;re
          matched.
        </p>
      </header>

      <ul className="subjects">
        <li className="subjects__any">
          <button type="button" className="subject subject--any" onClick={() => setChoice(ANY)}>
            <span className="subject__icon">
              <Shuffle size={24} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="subject__text">
              <span className="subject__name">{ANY.name}</span>
              <span className="subject__blurb">{ANY.blurb}</span>
            </span>
            <span className="subject__badge">
              <Zap size={14} aria-hidden="true" />
              Fastest match
            </span>
          </button>
        </li>
        {CATEGORIES.map((category) => {
          const Icon = ICONS[category.id]
          return (
            <li key={category.id}>
              <button type="button" className="subject" onClick={() => setChoice(category)}>
                <span className="subject__icon">
                  <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="subject__text">
                  <span className="subject__name">{category.name}</span>
                  <span className="subject__blurb">{category.blurb}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <section className="panel format">
        <div className="panel__head">
          <h2>How a round works</h2>
          <span className="panel__aside">About {Math.round(TOTAL_SECONDS / 60)} minutes</span>
        </div>
        <ol className="format__steps">
          <li>
            <strong>Prep for {PREP_SECONDS} seconds.</strong> You see the resolution and your side.
            Both of you can mark yourselves ready to start early.
          </li>
          <li>
            <strong>Take turns speaking.</strong> Only the speaker&rsquo;s microphone is on, and the
            clock moves the round along.
          </li>
          <li>
            <strong>Get the ballot.</strong> A judge reads the transcript, picks a winner, scores both
            sides and tells you what to work on.
          </li>
        </ol>
        <Timeline speeches={SPEECHES} />
      </section>
    </Shell>
  )
}
