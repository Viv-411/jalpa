// Pure debate state transitions. No I/O, so these are easy to unit test.
// All times are epoch milliseconds from the server clock.

import { HttpError } from './errors.js'

export const CLOCK_SLACK_MS = 750
export const STALE_AFTER_MS = 120_000
export const PRESENCE_TIMEOUT_MS = 30_000

export function isParticipant(debate, uid) {
  return Array.isArray(debate?.players) && debate.players.includes(uid)
}

export function opponentOf(debate, uid) {
  return debate.players.find((player) => player !== uid)
}

export function isActive(debate) {
  return debate?.status === 'prep' || debate?.status === 'live'
}

export function speakerOf(debate, phase = debate.phase) {
  const speech = debate.schedule.speeches[phase]
  return speech ? debate[speech.side] : null
}

// Nobody has moved the debate along well past its deadline: both players left.
export function isStale(debate, now) {
  return isActive(debate) && now > debate.phaseEndsAt + STALE_AFTER_MS
}

function startPhase(debate, phase, now) {
  const speech = debate.schedule.speeches[phase]
  const startsAt = now + debate.schedule.leadSeconds * 1000
  return {
    status: 'live',
    phase,
    phaseStartsAt: startsAt,
    phaseEndsAt: startsAt + speech.seconds * 1000,
  }
}

// A player marks themselves ready during prep. When both are, speeches begin.
export function readyPatch(debate, uid, now) {
  if (debate.status !== 'prep') return null
  const ready = { ...debate.ready, [uid]: true }
  const everyoneReady = debate.players.every((player) => ready[player])
  return everyoneReady ? { ready, ...startPhase(debate, 0, now) } : { ready }
}

// Moves from `phase` to the next one. Allowed when the clock has run out
// (either player may report it) or when the current speaker yields early.
// Returns null when the debate has already moved past `phase` (idempotent).
export function advancePatch(debate, uid, phase, now) {
  if (!isActive(debate)) return null
  if (debate.phase > phase) return null
  if (debate.phase < phase) {
    throw new HttpError(409, 'The debate has not reached that speech yet.', 'too_early')
  }

  const timeUp = now >= debate.phaseEndsAt - CLOCK_SLACK_MS

  if (debate.status === 'prep') {
    if (!timeUp) throw new HttpError(409, 'Prep time is still running.', 'too_early')
    return startPhase(debate, 0, now)
  }

  const isSpeaker = speakerOf(debate) === uid
  const started = now >= debate.phaseStartsAt
  if (!timeUp && !(isSpeaker && started)) {
    throw new HttpError(409, 'Only the current speaker can end a speech early.', 'too_early')
  }

  const next = phase + 1
  if (next >= debate.schedule.speeches.length) {
    return { status: 'judging', phase: next, endedAt: now }
  }
  return startPhase(debate, next, now)
}

// Whether `uid` may claim a win because the opponent has gone silent.
export function canClaim(debate, opponentSeenAt, now) {
  if (!isActive(debate)) return false
  const baseline = Math.max(opponentSeenAt ?? 0, debate.createdAt)
  return now - baseline > PRESENCE_TIMEOUT_MS
}
