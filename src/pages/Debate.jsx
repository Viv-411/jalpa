import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import Ballot from '../components/Ballot'
import Flow from '../components/Flow'
import Notes from '../components/Notes'
import Shell from '../components/Shell'
import { useAuth } from '../context/AuthContext'
import { useNow } from '../hooks/useNow'
import { useVoiceRoom } from '../hooks/useVoiceRoom'
import { api } from '../lib/api'
import { opponentOf } from '../lib/results'
import { formatClock, sideLabel } from '../../shared/format'

const HEARTBEAT_MS = 8000
const AWAY_AFTER_MS = 30_000

function useDebate(debateId) {
  const [debate, setDebate] = useState(undefined)
  useEffect(() => {
    setDebate(undefined)
    return onSnapshot(
      doc(db, 'debates', debateId),
      (snapshot) => setDebate(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
      () => setDebate(null),
    )
  }, [debateId])
  return debate
}

function ConnectionNotices({ voice, opponentName }) {
  return (
    <>
      {voice.connection === 'error' && (
        <div className="notice notice--bad" role="alert">
          <p>Couldn&rsquo;t connect to the voice call.</p>
          <button type="button" className="button button--small" onClick={voice.retry}>
            Reconnect
          </button>
        </div>
      )}
      {voice.micBlocked && (
        <div className="notice notice--bad" role="alert">
          <p>
            Your microphone is blocked, so {opponentName} and the judge can&rsquo;t hear you. Allow
            microphone access for this site in your browser&rsquo;s address bar, then reconnect.
          </p>
          <button type="button" className="button button--small" onClick={voice.retry}>
            Reconnect
          </button>
        </div>
      )}
      {voice.audioBlocked && (
        <div className="notice" role="alert">
          <p>Your browser is holding the sound until you allow it.</p>
          <button type="button" className="button button--small" onClick={voice.unlockAudio}>
            Turn on sound
          </button>
        </div>
      )}
    </>
  )
}

function ForfeitControl({ onForfeit }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!confirming) {
    return (
      <button type="button" className="link-button link-button--danger" onClick={() => setConfirming(true)}>
        Forfeit
      </button>
    )
  }
  return (
    <div className="confirm" role="group" aria-label="Confirm forfeit">
      <span>Forfeit and take the loss?</span>
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
      <button type="button" className="link-button" onClick={() => setConfirming(false)}>
        Keep debating
      </button>
    </div>
  )
}

function Matchup({ debate, uid }) {
  const opponent = opponentOf(debate, uid)
  const mySide = debate.sides[uid]
  return (
    <div className="matchup">
      <div className={`matchup__side matchup__side--${mySide}`}>
        <span className="matchup__role">You argue {sideLabel(mySide)}</span>
        <span className="matchup__name">{debate.names[uid]}</span>
        <span className="matchup__elo">Rated {debate.elos[uid]}</span>
      </div>
      <span className="matchup__vs" aria-hidden="true">
        v.
      </span>
      <div className={`matchup__side matchup__side--${debate.sides[opponent]}`}>
        <span className="matchup__role">{sideLabel(debate.sides[opponent])}</span>
        <span className="matchup__name">{debate.names[opponent]}</span>
        <span className="matchup__elo">Rated {debate.elos[opponent]}</span>
      </div>
    </div>
  )
}

function Resolution({ debate, compact = false }) {
  return (
    <div className={`resolution${compact ? ' resolution--compact' : ''}`}>
      <p className="resolution__label">
        Resolved <span className="resolution__source">{debate.categoryName}. {debate.topicSource}</span>
      </p>
      <p className="resolution__text">{debate.topic}</p>
    </div>
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
        <p className="muted" role="status">
          Loading debate…
        </p>
      </Shell>
    )
  }

  if (debate === null) {
    return (
      <Shell>
        <section className="pad-head">
          <div>
            <h1>This debate isn&rsquo;t available</h1>
            <p className="muted">It may not exist, or you weren&rsquo;t one of the two debaters.</p>
            <p>
              <Link to="/">Back to home</Link>
            </p>
          </div>
        </section>
      </Shell>
    )
  }

  const opponentName = debate.names[opponentUid]
  const mySide = debate.sides[uid]

  if (status === 'abandoned') {
    return (
      <Shell>
        <section className="pad-head">
          <div>
            <h1>This debate was abandoned</h1>
            <p className="muted">
              Both debaters left before it finished, so it doesn&rsquo;t count. Ratings didn&rsquo;t
              change.
            </p>
            <p>
              <Link to="/play" className="button button--primary">
                Find a debate
              </Link>
            </p>
          </div>
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
    const stage = judgeStage?.stage
    return (
      <Shell quiet>
        <section className="sheet deliberating" aria-live="polite">
          <div className="searching__pulse" aria-hidden="true">
            <span />
            <span />
          </div>
          <h1>The judge is deciding</h1>
          <p>
            {stage === 'transcribing'
              ? `Writing up the speeches (${judgeStage.received} of ${judgeStage.expected}).`
              : 'Reading the round and writing the ballot. This usually takes under a minute.'}
          </p>
          <Resolution debate={debate} compact />
        </section>
      </Shell>
    )
  }

  // Prep or live from here on.
  const away =
    now - Math.max(opponentSeenAt, debate.createdAt) > AWAY_AFTER_MS
  const dropped = voice.ready && !voice.opponentPresent

  const opponentNotice = away ? (
    <div className="notice notice--bad" role="alert">
      <p>{opponentName} has been disconnected for over 30 seconds.</p>
      <button type="button" className="button button--small button--primary" onClick={() => act('claim')}>
        Claim the win
      </button>
    </div>
  ) : dropped ? (
    <div className="notice" role="status">
      <p>{opponentName} isn&rsquo;t on the call right now. Waiting for them to reconnect.</p>
    </div>
  ) : null

  if (status === 'prep') {
    const remaining = (debate.phaseEndsAt - now) / 1000
    const iAmReady = Boolean(debate.ready?.[uid])
    const theyAreReady = Boolean(debate.ready?.[opponentUid])
    return (
      <Shell quiet wide>
        <div className="room">
          <div className="room__main">
            <Resolution debate={debate} />
            <Matchup debate={debate} uid={uid} />

            <div className="prep">
              <div className="clock" role="timer" aria-label="Prep time left">
                <span className="clock__label">Prep time</span>
                <span className="clock__time">{formatClock(remaining)}</span>
              </div>
              <div className="prep__actions">
                {iAmReady ? (
                  <p className="prep__waiting">
                    You&rsquo;re ready. {theyAreReady ? 'Starting…' : `Waiting for ${opponentName}.`}
                  </p>
                ) : (
                  <button type="button" className="button button--primary button--large" onClick={() => act('ready')}>
                    I&rsquo;m ready
                  </button>
                )}
                <p className="muted">
                  {theyAreReady && !iAmReady ? `${opponentName} is ready. ` : ''}
                  The debate starts when you&rsquo;re both ready or when prep time runs out.{' '}
                  {mySide === 'pro' ? 'You speak first.' : `${opponentName} speaks first.`}
                </p>
              </div>
            </div>

            <p className="mic-line">
              {voice.connection === 'connected' && !voice.micBlocked
                ? 'Microphone connected. It stays muted until your speech.'
                : voice.connection === 'connecting'
                  ? 'Connecting to the voice call…'
                  : ''}
            </p>
            <ConnectionNotices voice={voice} opponentName={opponentName} />
            {opponentNotice}
            {actionError && (
              <p className="form-error" role="alert">
                {actionError}
              </p>
            )}

            <Flow debate={debate} uid={uid} now={now} />
            <ForfeitControl onForfeit={() => act('forfeit')} />
          </div>
          <Notes debateId={debate.id} />
        </div>
      </Shell>
    )
  }

  // Live.
  const leadIn = now < debate.phaseStartsAt
  const remaining = (debate.phaseEndsAt - Math.max(now, debate.phaseStartsAt)) / 1000
  const speakerName = iAmSpeaking ? 'You' : opponentName
  const speakerIsTalking = voice.speakingIds.includes(speakerUid)
  const captionText = voice.caption.phase === debate.phase ? voice.caption.text : ''

  return (
    <Shell quiet wide>
      <div className="room">
        <div className="room__main">
          <Resolution debate={debate} compact />

          <div className={`stage stage--${speech.side}${iAmSpeaking ? ' stage--mine' : ''}`}>
            <div className="stage__who">
              <p className="stage__speech">{speech.name}</p>
              <p className="stage__speaker">
                <span className={`voice-dot${speakerIsTalking ? ' voice-dot--on' : ''}`} aria-hidden="true" />
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
            <div
              className={`clock clock--stage${!leadIn && remaining <= 10 ? ' clock--low' : ''}`}
              role="timer"
              aria-label={leadIn ? 'Speech starts in' : 'Speaking time left'}
            >
              <span className="clock__label">{leadIn ? 'Starts in' : 'Time left'}</span>
              <span className="clock__time">
                {leadIn ? Math.max(1, Math.ceil((debate.phaseStartsAt - now) / 1000)) : formatClock(remaining)}
              </span>
            </div>
          </div>

          <div className="stage-controls">
            <p className="mic-line">
              {iAmSpeaking
                ? 'Your microphone is on.'
                : `Your microphone is off while ${opponentName} speaks.`}
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
              <span className="captions__label">Live captions</span> {captionText}
            </p>
          )}

          <ConnectionNotices voice={voice} opponentName={opponentName} />
          {opponentNotice}
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}

          <Flow debate={debate} uid={uid} now={now} />
          <ForfeitControl onForfeit={() => act('forfeit')} />
        </div>
        <Notes debateId={debate.id} />
      </div>
    </Shell>
  )
}
