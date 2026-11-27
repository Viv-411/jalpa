import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Flag,
  LoaderCircle,
  Mic,
  MicOff,
  RefreshCw,
  Volume2,
  WifiOff,
} from 'lucide-react'
import Ballot from '../components/Ballot'
import Notes from '../components/Notes'
import Shell from '../components/Shell'
import Timeline from '../components/Timeline'
import { Avatar, Resolution, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useNow } from '../hooks/useNow'
import { useVoiceRoom } from '../hooks/useVoiceRoom'
import { api } from '../lib/api'
import { opponentOf } from '../lib/results'
import { formatClock, sideLabel } from '../../shared/format'

const HEARTBEAT_MS = 8000
const AWAY_AFTER_MS = 30_000

function useDebate(debateId) {
  // undefined while loading, null if it doesn't exist or isn't ours to see.
  const [loaded, setLoaded] = useState({ id: null, debate: undefined })
  useEffect(() => {
    return onSnapshot(
      doc(db, 'debates', debateId),
      (snapshot) =>
        setLoaded({
          id: debateId,
          debate: snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
        }),
      () => setLoaded({ id: debateId, debate: null }),
    )
  }, [debateId])
  return loaded.id === debateId ? loaded.debate : undefined
}

function Notice({ tone = 'info', icon: Icon = AlertTriangle, children, action }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <Icon className="notice__icon" size={18} aria-hidden="true" />
      <p className="notice__text">{children}</p>
      {action}
    </div>
  )
}

function ConnectionNotices({ voice, opponentName }) {
  return (
    <>
      {voice.connection === 'error' && (
        <Notice
          tone="bad"
          icon={WifiOff}
          action={
            <button type="button" className="button button--small" onClick={voice.retry}>
              <RefreshCw size={14} aria-hidden="true" />
              Reconnect
            </button>
          }
        >
          Couldn&rsquo;t connect to the voice call.
        </Notice>
      )}
      {voice.micBlocked && (
        <Notice
          tone="bad"
          icon={MicOff}
          action={
            <button type="button" className="button button--small" onClick={voice.retry}>
              <RefreshCw size={14} aria-hidden="true" />
              Reconnect
            </button>
          }
        >
          Your microphone is blocked, so {opponentName} and the judge can&rsquo;t hear you. Allow
          microphone access for this site in your browser&rsquo;s address bar, then reconnect.
        </Notice>
      )}
      {voice.audioBlocked && (
        <Notice
          icon={Volume2}
          action={
            <button type="button" className="button button--small button--primary" onClick={voice.unlockAudio}>
              Turn on sound
            </button>
          }
        >
          Your browser is holding the sound until you allow it.
        </Notice>
      )}
    </>
  )
}

function ForfeitControl({ onForfeit }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!confirming) {
    return (
      <button type="button" className="text-button text-button--danger" onClick={() => setConfirming(true)}>
        <Flag size={14} aria-hidden="true" />
        Forfeit
      </button>
    )
  }
  return (
    <div className="confirm" role="group" aria-label="Confirm forfeit">
      <span>Forfeit and take the loss?</span>
      <div className="confirm__actions">
        <button type="button" className="button button--small" onClick={() => setConfirming(false)}>
          Keep debating
        </button>
        <button
          type="button"
          className="button button--small button--danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onForfeit()
            setBusy(false)
          }}
        >
          Forfeit debate
        </button>
      </div>
    </div>
  )
}

function Matchup({ debate, uid }) {
  const opponent = opponentOf(debate, uid)
  const mySide = debate.sides[uid]
  const theirSide = debate.sides[opponent]
  return (
    <section className="matchup" aria-label="Debaters">
      <div className={`matchup__side matchup__side--${mySide}`}>
        <Avatar name={debate.names[uid]} side={mySide} size="lg" />
        <div className="matchup__info">
          <span className="matchup__role">You argue {sideLabel(mySide)}</span>
          <span className="matchup__name">{debate.names[uid]}</span>
          <span className="matchup__elo">Rated {debate.elos[uid]}</span>
        </div>
      </div>
      <span className="matchup__vs" aria-hidden="true">
        vs
      </span>
      <div className={`matchup__side matchup__side--${theirSide} matchup__side--them`}>
        <Avatar name={debate.names[opponent]} side={theirSide} size="lg" />
        <div className="matchup__info">
          <span className="matchup__role">{sideLabel(theirSide)}</span>
          <span className="matchup__name">{debate.names[opponent]}</span>
          <span className="matchup__elo">Rated {debate.elos[opponent]}</span>
        </div>
      </div>
    </section>
  )
}

function PhasePill({ kind, children }) {
  return (
    <span className={`phase-pill phase-pill--${kind}`}>
      <span className="phase-pill__dot" aria-hidden="true" />
      {children}
    </span>
  )
}

function timelineNames(debate, uid) {
  const name = (side) => (debate[side] === uid ? 'You' : debate.names[debate[side]])
  return { pro: name('pro'), con: name('con') }
}

function JudgeSteps({ stage }) {
  const transcribing = !stage || stage.stage === 'transcribing'
  const steps = [
    { label: 'Speeches finished', state: 'done' },
    {
      label:
        stage?.stage === 'transcribing'
          ? `Writing up the speeches (${stage.received} of ${stage.expected})`
          : 'Writing up the speeches',
      state: transcribing ? 'now' : 'done',
    },
    {
      label: stage?.stage === 'retrying' ? 'Judge writing the ballot (trying again)' : 'Judge writing the ballot',
      state: transcribing ? 'next' : 'now',
    },
  ]
  return (
    <ol className="steps">
      {steps.map((step) => (
        <li key={step.label} className={`steps__item steps__item--${step.state}`}>
          <span className="steps__mark" aria-hidden="true">
            {step.state === 'done' ? (
              <Check size={14} strokeWidth={3} />
            ) : step.state === 'now' ? (
              <LoaderCircle size={16} className="spin" />
            ) : null}
          </span>
          {step.label}
        </li>
      ))}
    </ol>
  )
}
export default function Debate() {
  const { debateId } = useParams()
  const { profile } = useAuth()
  const uid = profile.uid
  const debate = useDebate(debateId)

  const status = debate?.status
  const active = status === 'prep' || status === 'live'
  const opponentUid = debate ? opponentOf(debate, uid) : null
  const speech = status === 'live' ? debate.schedule.speeches[debate.phase] : null
  const speakerUid = speech ? debate[speech.side] : null
  const iAmSpeaking = speakerUid === uid

  const now = useNow(250, active)
  const voice = useVoiceRoom({
    debateId,
    opponentUid,
    active,
    speakPhase: iAmSpeaking ? debate.phase : null,
  })

  const [actionError, setActionError] = useState('')
  const [opponentSeenAt, setOpponentSeenAt] = useState(0)
  const [judgeStage, setJudgeStage] = useState(null)
  const [speeches, setSpeeches] = useState({})

  // Line this device's clock up with the server's before any timer matters.
  useEffect(() => {
    api('debate', { action: 'sync' }).catch(() => {})
  }, [])

  // Heartbeat, so the other debater can tell we're still here.
  useEffect(() => {
    if (!active) return undefined
    const ref = doc(db, 'debates', debateId, 'presence', uid)
    const beat = () => setDoc(ref, { at: serverTimestamp() }).catch(() => {})
    beat()
    const timer = setInterval(beat, HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [active, debateId, uid])

  useEffect(() => {
    if (!active || !opponentUid) return undefined
    return onSnapshot(
      doc(db, 'debates', debateId, 'presence', opponentUid),
      (snapshot) => setOpponentSeenAt(snapshot.data()?.at?.toMillis?.() ?? 0),
      () => {},
    )
  }, [active, debateId, opponentUid])

  // When a clock runs out, tell the server. Both browsers do; it only counts once.
  const lastAdvance = useRef({ key: null, at: 0 })
  useEffect(() => {
    if (!active || now < debate.phaseEndsAt) return
    const key = `${debate.id}:${debate.phase}`
    if (lastAdvance.current.key === key && Date.now() - lastAdvance.current.at < 3000) return
    lastAdvance.current = { key, at: Date.now() }
    api('debate', { debateId, action: 'advance', phase: debate.phase }).catch(() => {})
  }, [active, now, debate, debateId])

  // Once the speeches are over, keep asking for the ballot until it's written.
  useEffect(() => {
    if (status !== 'judging') return undefined
    let stopped = false
    let timer = null
    async function ask() {
      try {
        const result = await api('judge', { debateId })
        if (stopped) return
        setJudgeStage(result)
        if (result.status === 'complete') return
      } catch {
        // Keep trying; the debate document will update when it lands.
      }
      if (!stopped) timer = setTimeout(ask, 3000)
    }
    ask()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [status, debateId])

  useEffect(() => {
    if (status !== 'complete' && status !== 'judging') return undefined
    return onSnapshot(
      collection(db, 'debates', debateId, 'speeches'),
      (snapshot) => {
        const next = {}
        snapshot.forEach((entry) => {
          next[Number(entry.id)] = entry.data()
        })
        setSpeeches(next)
      },
      () => {},
    )
  }, [status, debateId])

  const act = useCallback(
    async (action, extra = {}) => {
      setActionError('')
      try {
        await api('debate', { debateId, action, ...extra })
      } catch (err) {
        if (err.code !== 'too_early') setActionError(err.message)
      }
    },
    [debateId],
  )

  if (debate === undefined) {
    return (
      <Shell quiet>
        <div className="center-state">
          <Spinner label="Loading debate…" />
        </div>
      </Shell>
    )
  }

  if (debate === null) {
    return (
      <Shell>
        <section className="center-state">
          <h1>This debate isn&rsquo;t available</h1>
          <p className="muted">It may not exist, or you weren&rsquo;t one of the two debaters.</p>
          <Link to="/" className="button button--outline">
            Back to home
          </Link>
        </section>
      </Shell>
    )
  }

  const opponentName = debate.names[opponentUid]
  const mySide = debate.sides[uid]
  const names = timelineNames(debate, uid)

  if (status === 'abandoned') {
    return (
      <Shell>
        <section className="center-state">
          <h1>This debate was abandoned</h1>
          <p className="muted">
            Both debaters left before it finished, so it doesn&rsquo;t count. Ratings didn&rsquo;t
            change.
          </p>
          <Link to="/play" className="button button--primary">
            Find a debate
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </Shell>
    )
  }

  if (status === 'complete') {
    return (
      <Shell>
        <Ballot debate={debate} uid={uid} speeches={speeches} />
      </Shell>
    )
  }

  if (status === 'judging') {
    return (
      <Shell quiet status={<PhasePill kind="judging">Judging</PhasePill>}>
        <section className="judging" aria-live="polite">
          <div className="judging__mark" aria-hidden="true">
            <span className="judging__half judging__half--pro" />
            <span className="judging__half judging__half--con" />
          </div>
          <h1>The judge is deciding</h1>
          <p className="muted">Reading the round and writing the ballot. This usually takes under a minute.</p>
          <JudgeSteps stage={judgeStage} />
          <Resolution debate={debate} compact />
        </section>
      </Shell>
    )
  }

  // Prep or live from here on.
  const away = now - Math.max(opponentSeenAt, debate.createdAt) > AWAY_AFTER_MS
  const dropped = voice.ready && !voice.opponentPresent

  const opponentNotice = away ? (
    <Notice
      tone="bad"
      icon={WifiOff}
      action={
        <button type="button" className="button button--small button--primary" onClick={() => act('claim')}>
          Claim the win
        </button>
      }
    >
      {opponentName} has been disconnected for over 30 seconds.
    </Notice>
  ) : dropped ? (
    <Notice icon={WifiOff}>
      {opponentName} isn&rsquo;t on the call right now. Waiting for them to reconnect.
    </Notice>
  ) : null

  const errorLine = actionError && (
    <p className="form-error" role="alert">
      {actionError}
    </p>
  )

  if (status === 'prep') {
    const remaining = (debate.phaseEndsAt - now) / 1000
    const total = Math.max(1, debate.phaseEndsAt - debate.phaseStartsAt)
    const left = Math.min(1, Math.max(0, (debate.phaseEndsAt - now) / total))
    const iAmReady = Boolean(debate.ready?.[uid])
    const theyAreReady = Boolean(debate.ready?.[opponentUid])
    const micState =
      voice.connection === 'connected' && !voice.micBlocked
        ? 'Microphone connected. It stays muted until your speech.'
        : voice.connection === 'connecting'
          ? 'Connecting to the voice call…'
          : ''

    return (
      <Shell quiet wide status={<PhasePill kind="prep">Prep</PhasePill>}>
        <div className="room">
          <div className="room__main">
            <Resolution debate={debate} />
            <Matchup debate={debate} uid={uid} />

            <section className="prep" aria-label="Prep">
              <div className="prep__clock" role="timer" aria-label="Prep time left">
                <span className="prep__label">Prep time</span>
                <span className="prep__time">{formatClock(remaining)}</span>
                <span className="meter" aria-hidden="true">
                  <span className="meter__fill" style={{ transform: `scaleX(${left})` }} />
                </span>
              </div>
              <div className="prep__actions">
                {iAmReady ? (
                  <p className="prep__waiting">
                    <span className="prep__check" aria-hidden="true">
                      <Check size={16} strokeWidth={3} />
                    </span>
                    You&rsquo;re ready. {theyAreReady ? 'Starting…' : `Waiting for ${opponentName}.`}
                  </p>
                ) : (
                  <button type="button" className="button button--primary button--large" onClick={() => act('ready')}>
                    I&rsquo;m ready
                  </button>
                )}
                <p className="prep__note">
                  {theyAreReady && !iAmReady ? `${opponentName} is ready. ` : ''}
                  The debate starts when you&rsquo;re both ready or when prep time runs out.{' '}
                  {mySide === 'pro' ? 'You speak first.' : `${opponentName} speaks first.`}
                </p>
              </div>
            </section>

            {micState && (
              <p className="mic-line">
                <Mic size={16} aria-hidden="true" />
                {micState}
              </p>
            )}
            <ConnectionNotices voice={voice} opponentName={opponentName} />
            {opponentNotice}
            {errorLine}

            <Timeline speeches={debate.schedule.speeches} names={names} />
            <div className="room__footer">
              <ForfeitControl onForfeit={() => act('forfeit')} />
            </div>
          </div>
          <Notes debateId={debate.id} />
        </div>
      </Shell>
    )
  }

  // Live.
  const leadIn = now < debate.phaseStartsAt
  const remaining = (debate.phaseEndsAt - Math.max(now, debate.phaseStartsAt)) / 1000
  const total = Math.max(1, debate.phaseEndsAt - debate.phaseStartsAt)
  const left = leadIn ? 1 : Math.min(1, Math.max(0, (debate.phaseEndsAt - now) / total))
  const speakerName = iAmSpeaking ? 'You' : opponentName
  const speakerIsTalking = voice.speakingIds.includes(speakerUid)
  const captionText = voice.caption.phase === debate.phase ? voice.caption.text : ''
  const low = !leadIn && remaining <= 10

  return (
    <Shell quiet wide status={<PhasePill kind="live">Live</PhasePill>}>
      <div className="room">
        <div className="room__main">
          <Resolution debate={debate} compact />

          <section
            className={`stage stage--${speech.side}${iAmSpeaking ? ' stage--mine' : ''}${low ? ' stage--low' : ''}`}
            aria-label="Current speech"
          >
            <div className="stage__top">
              <p className="stage__speech">{speech.name}</p>
              <p className="stage__count">
                Speech {debate.phase + 1} of {debate.schedule.speeches.length}
              </p>
            </div>

            <div className="stage__body">
              <div className="stage__who">
                <span className={`stage__avatar${speakerIsTalking ? ' is-talking' : ''}`}>
                  <Avatar name={debate.names[speakerUid]} side={speech.side} size="xl" />
                </span>
                <div>
                  <p className="stage__speaker">
                    {leadIn
                      ? iAmSpeaking
                        ? 'You’re up next'
                        : `${speakerName} is up next`
                      : iAmSpeaking
                        ? 'You’re speaking'
                        : `${speakerName} is speaking`}
                  </p>
                  <p className="stage__blurb">{speech.blurb}</p>
                </div>
              </div>

              <div className="clock" role="timer" aria-label={leadIn ? 'Speech starts in' : 'Speaking time left'}>
                <span className="clock__label">{leadIn ? 'Starts in' : 'Time left'}</span>
                <span className="clock__time">
                  {leadIn ? Math.max(1, Math.ceil((debate.phaseStartsAt - now) / 1000)) : formatClock(remaining)}
                </span>
              </div>
            </div>

            <span className="stage__meter" aria-hidden="true">
              <span className="stage__meter-fill" style={{ transform: `scaleX(${left})` }} />
            </span>
          </section>

          <div className="stage-controls">
            <p className={`mic-pill${iAmSpeaking ? ' mic-pill--on' : ''}`}>
              {iAmSpeaking ? <Mic size={16} aria-hidden="true" /> : <MicOff size={16} aria-hidden="true" />}
              {iAmSpeaking ? 'Your microphone is on.' : `Your microphone is off while ${opponentName} speaks.`}
            </p>
            {iAmSpeaking && (
              <button
                type="button"
                className="button button--primary"
                disabled={leadIn}
                onClick={() => act('advance', { phase: debate.phase })}
              >
                End my speech
              </button>
            )}
          </div>

          {captionText && (
            <p className="captions" aria-live="off">
              <span className="captions__label">Live captions</span>
              <span className="captions__text">{captionText}</span>
            </p>
          )}

          <ConnectionNotices voice={voice} opponentName={opponentName} />
          {opponentNotice}
          {errorLine}

          <Timeline
            speeches={debate.schedule.speeches}
            names={names}
            phase={debate.phase}
            live
            startsAt={debate.phaseStartsAt}
            endsAt={debate.phaseEndsAt}
            now={now}
          />
          <div className="room__footer">
            <ForfeitControl onForfeit={() => act('forfeit')} />
          </div>
        </div>
        <Notes debateId={debate.id} />
      </div>
    </Shell>
  )
}
