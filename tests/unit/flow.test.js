import { describe, expect, it } from 'vitest'
import { buildSchedule } from '../../shared/format.js'
import {
  advancePatch,
  canClaim,
  isStale,
  readyPatch,
  speakerOf,
} from '../../server/flow.js'
import { compatible, rankCandidates } from '../../server/matchmaking.js'

const T0 = 1_000_000

function makeDebate(overrides = {}) {
  const schedule = buildSchedule()
  return {
    players: ['a', 'b'],
    pro: 'a',
    con: 'b',
    schedule,
    status: 'prep',
    ready: { a: false, b: false },
    phase: -1,
    phaseStartsAt: T0,
    phaseEndsAt: T0 + schedule.prepSeconds * 1000,
    createdAt: T0,
    ...overrides,
  }
}

function live(phase, now = T0) {
  const debate = makeDebate()
  const speech = debate.schedule.speeches[phase]
  return {
    ...debate,
    status: 'live',
    phase,
    phaseStartsAt: now + 4000,
    phaseEndsAt: now + 4000 + speech.seconds * 1000,
  }
}

describe('ready', () => {
  it('waits for both players', () => {
    const patch = readyPatch(makeDebate(), 'a', T0 + 1000)
    expect(patch).toEqual({ ready: { a: true, b: false } })
  })

  it('starts the first speech once both are ready, after a lead-in', () => {
    const patch = readyPatch(makeDebate({ ready: { a: true, b: false } }), 'b', T0 + 5000)
    expect(patch.status).toBe('live')
    expect(patch.phase).toBe(0)
    expect(patch.phaseStartsAt).toBe(T0 + 5000 + 4000)
    expect(patch.phaseEndsAt).toBe(T0 + 5000 + 4000 + 120_000)
  })

  it('does nothing once the debate is live', () => {
    expect(readyPatch(live(0), 'a', T0)).toBeNull()
  })
})

describe('advance', () => {
  it('refuses to end prep early but starts when time is up', () => {
    const debate = makeDebate()
    expect(() => advancePatch(debate, 'a', -1, T0 + 10_000)).toThrow(/Prep/)
    const patch = advancePatch(debate, 'b', -1, debate.phaseEndsAt)
    expect(patch.status).toBe('live')
    expect(patch.phase).toBe(0)
  })

  it('lets only the speaker yield early, and only after the speech starts', () => {
    const debate = live(0)
    expect(speakerOf(debate)).toBe('a')
    expect(() => advancePatch(debate, 'b', 0, debate.phaseStartsAt + 5000)).toThrow()
    expect(() => advancePatch(debate, 'a', 0, debate.phaseStartsAt - 1000)).toThrow()
    const patch = advancePatch(debate, 'a', 0, debate.phaseStartsAt + 5000)
    expect(patch.phase).toBe(1)
  })

  it('lets either player advance when the clock runs out', () => {
    const debate = live(1)
    const patch = advancePatch(debate, 'a', 1, debate.phaseEndsAt)
    expect(patch.phase).toBe(2)
    expect(patch.phaseEndsAt - patch.phaseStartsAt).toBe(90_000)
  })

  it('is idempotent when both browsers report the same deadline', () => {
    const debate = live(3)
    expect(advancePatch(debate, 'a', 2, debate.phaseEndsAt)).toBeNull()
    expect(() => advancePatch(debate, 'a', 4, debate.phaseEndsAt)).toThrow()
  })

  it('hands the debate to the judge after the last speech', () => {
    const debate = live(5)
    const patch = advancePatch(debate, 'b', 5, debate.phaseStartsAt + 1000)
    expect(patch).toMatchObject({ status: 'judging', phase: 6 })
    expect(advancePatch({ ...debate, ...patch }, 'a', 5, T0)).toBeNull()
  })
})

describe('disconnects', () => {
  it('only allows a claim after 30 seconds of silence', () => {
    const debate = live(0)
    expect(canClaim(debate, T0 + 50_000, T0 + 60_000)).toBe(false)
    expect(canClaim(debate, T0 + 20_000, T0 + 60_000)).toBe(true)
    expect(canClaim(debate, 0, T0 + 10_000)).toBe(false)
    expect(canClaim({ ...debate, status: 'judging' }, 0, T0 + 999_999)).toBe(false)
  })

  it('treats a long-overdue debate as abandoned', () => {
    const debate = live(2)
    expect(isStale(debate, debate.phaseEndsAt + 60_000)).toBe(false)
    expect(isStale(debate, debate.phaseEndsAt + 130_000)).toBe(true)
  })
})

describe('matchmaking rules', () => {
  const now = T0
  const entry = (uid, elo, category, waitedMs = 0, extra = {}) => ({
    uid,
    elo,
    category,
    status: 'waiting',
    joinedAt: now - waitedMs,
    heartbeatAt: now,
    ...extra,
  })

  it('matches same category or anyone open to any category', () => {
    const me = entry('me', 1000, 'tech')
    expect(compatible(me, entry('x', 1000, 'tech'), now)).toBe(true)
    expect(compatible(me, entry('x', 1000, 'any'), now)).toBe(true)
    expect(compatible(me, entry('x', 1000, 'world'), now)).toBe(false)
    expect(compatible(me, me, now)).toBe(false)
  })

  it('keeps ratings close at first and widens with waiting', () => {
    const me = entry('me', 1000, 'any')
    expect(compatible(me, entry('x', 1400, 'any'), now)).toBe(false)
    expect(compatible(me, entry('x', 1400, 'any', 6000), now)).toBe(true)
    expect(compatible(me, entry('x', 2500, 'any', 31_000), now)).toBe(true)
  })

  it('ignores players who stopped polling or already matched', () => {
    const me = entry('me', 1000, 'any')
    expect(compatible(me, entry('x', 1000, 'any', 0, { heartbeatAt: now - 20_000 }), now)).toBe(false)
    expect(compatible(me, entry('x', 1000, 'any', 0, { status: 'matched' }), now)).toBe(false)
  })

  it('serves the longest-waiting opponent first', () => {
    const me = entry('me', 1000, 'any')
    const ranked = rankCandidates(
      me,
      [entry('new', 1000, 'any', 1000), entry('old', 1010, 'any', 9000), me],
      now,
    )
    expect(ranked.map((candidate) => candidate.uid)).toEqual(['old', 'new'])
  })
})
