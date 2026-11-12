// The debate format. Shared by the browser and the API functions.
// A match is six alternating speeches, about nine minutes of speaking.

export const PREP_SECONDS = 60
export const LEAD_SECONDS = 4

export const SPEECHES = [
  {
    key: 'pro-constructive',
    side: 'pro',
    name: 'Pro constructive',
    seconds: 120,
    blurb: 'Lay out your case for the resolution.',
  },
  {
    key: 'con-constructive',
    side: 'con',
    name: 'Con constructive',
    seconds: 120,
    blurb: 'Lay out your case against the resolution.',
  },
  {
    key: 'pro-rebuttal',
    side: 'pro',
    name: 'Pro rebuttal',
    seconds: 90,
    blurb: 'Answer the Con case and defend your own.',
  },
  {
    key: 'con-rebuttal',
    side: 'con',
    name: 'Con rebuttal',
    seconds: 90,
    blurb: 'Answer the Pro case and defend your own.',
  },
  {
    key: 'pro-closing',
    side: 'pro',
    name: 'Pro closing',
    seconds: 60,
    blurb: 'Weigh the round. No new arguments.',
  },
  {
    key: 'con-closing',
    side: 'con',
    name: 'Con closing',
    seconds: 60,
    blurb: 'Weigh the round. No new arguments.',
  },
]

// Builds the schedule stored on each debate. `scale` shortens every timer
// (used by automated tests so a full match takes seconds, not minutes).
export function buildSchedule(scale = 1) {
  const s = (seconds) => Math.max(2, Math.round(seconds * scale))
  return {
    prepSeconds: s(PREP_SECONDS),
    leadSeconds: Math.max(1, Math.round(LEAD_SECONDS * scale)),
    speeches: SPEECHES.map((speech) => ({ ...speech, seconds: s(speech.seconds) })),
  }
}

export function otherSide(side) {
  return side === 'pro' ? 'con' : 'pro'
}

export function sideLabel(side) {
  return side === 'pro' ? 'Pro' : 'Con'
}

export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.ceil(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
