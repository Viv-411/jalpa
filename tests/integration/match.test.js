import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'
import { doc as serverDoc, updateDoc as serverUpdate } from 'firebase/firestore/lite'
import {
  call,
  clearFirestore,
  closePlayers,
  ensureBot,
  loadEnv,
  makePlayer,
  sleep,
} from './helpers.js'

loadEnv()
const { getDb } = await import('../../server/firebase.js')
const matchmake = (await import('../../api/matchmake.js')).default
const debateApi = (await import('../../api/debate.js')).default
const speechApi = (await import('../../api/speech.js')).default
const judgeApi = (await import('../../api/judge.js')).default
const tokenApi = (await import('../../api/token.js')).default

const LONG = 'We affirm because compulsory voting raises turnout, improves legitimacy and reduces polarization across every democracy that has tried it.'
const SHORT = 'Voting should stay a free choice for every citizen because liberty matters most.'

async function getDebate(player, debateId) {
  return (await getDoc(doc(player.db, 'debates', debateId))).data()
}
async function profile(player) {
  return (await getDoc(doc(player.db, 'users', player.uid))).data()
}

async function matchUp(a, b, categoryA = 'tech', categoryB = 'tech') {
  const first = await call(matchmake, a, { action: 'search', category: categoryA })
  expect(first.status).toBe('waiting')
  const second = await call(matchmake, b, { action: 'search', category: categoryB })
  expect(second.status).toBe('matched')
  const again = await call(matchmake, a, { action: 'search', category: categoryA })
  expect(again.debateId).toBe(second.debateId)
  return second.debateId
}

// Both ready up, then each speaker gives their speech and yields.
async function playThrough(a, b, debateId, textFor) {
  await call(debateApi, a, { debateId, action: 'ready' })
  const started = await call(debateApi, b, { debateId, action: 'ready' })
  expect(started).toMatchObject({ status: 'live', phase: 0 })

  const debate = await getDebate(a, debateId)
  const byUid = { [a.uid]: a, [b.uid]: b }
  for (let phase = 0; phase < debate.schedule.speeches.length; phase += 1) {
    const side = debate.schedule.speeches[phase].side
    const speaker = byUid[debate[side]]
    const now = (await getDebate(a, debateId)).phaseStartsAt
    await sleep(Math.max(0, now - Date.now()) + 30)
    const text = textFor(side, phase)
    if (text !== null) {
      const saved = await call(speechApi, speaker, { debateId, phase, captions: text })
      expect(saved.saved).toBe(true)
    }
    const moved = await call(debateApi, speaker, { debateId, action: 'advance', phase })
    expect(moved.http).toBe(200)
  }
  return debate
}

async function judgeUntilDone(player, debateId) {
  for (let i = 0; i < 20; i += 1) {
    const res = await call(judgeApi, player, { debateId })
    if (res.status === 'complete') return res
    await sleep(300)
  }
  throw new Error('judging never finished')
}

describe('a full match', () => {
  let ana, ben, cat

  beforeAll(async () => {
    await ensureBot()
  })
  beforeEach(async () => {
    await clearFirestore()
    ana = await makePlayer('Ana')
    ben = await makePlayer('Ben')
    cat = await makePlayer('Cat')
  })
  afterAll(closePlayers)

  it('rejects unauthenticated and malformed requests', async () => {
    expect((await call(matchmake, null, { action: 'search', category: 'tech' })).http).toBe(401)
    expect((await call(matchmake, ana, { action: 'search', category: 'nope' })).http).toBe(400)
    expect((await call(matchmake, ana, { action: 'dance' })).http).toBe(400)
    expect((await call(matchmake, ana, {}, { method: 'GET' })).http).toBe(405)
    expect((await call(debateApi, ana, { debateId: 'missing', action: 'ready' })).http).toBe(404)
  })

  it('matches two players, runs six speeches, judges, and moves ratings', async () => {
    const debateId = await matchUp(ana, ben)
    const created = await getDebate(ana, debateId)
    expect(created.status).toBe('prep')
    expect(created.categoryId).toBe('tech')
    expect(created.topic).toMatch(/\.$/)
    expect(new Set([created.pro, created.con])).toEqual(new Set([ana.uid, ben.uid]))
    expect((await profile(ana)).activeDebateId).toBe(debateId)

    // Outsiders are locked out of every endpoint.
    expect((await call(debateApi, cat, { debateId, action: 'ready' })).http).toBe(403)
    expect((await call(tokenApi, cat, { debateId })).http).toBe(403)
    expect((await call(judgeApi, cat, { debateId })).http).toBe(403)

    // Judging is refused while the debate is still running.
    expect((await call(judgeApi, ana, { debateId })).http).toBe(409)

    const debate = await playThrough(ana, ben, debateId, (side) => (side === 'pro' ? LONG : SHORT))
    expect((await getDebate(ana, debateId)).status).toBe('judging')

    await judgeUntilDone(ana, debateId)
    const done = await getDebate(ben, debateId)
    expect(done.status).toBe('complete')
    expect(done.result.reason).toBe('decision')
    expect(done.result.winner).toBe(debate.pro)
    expect(done.result.judgment.winner).toBe('pro')
    expect(done.result.elo[debate.pro]).toEqual({ before: 1000, after: 1016, change: 16 })
    expect(done.result.elo[debate.con]).toEqual({ before: 1000, after: 984, change: -16 })

    const byUid = { [ana.uid]: ana, [ben.uid]: ben }
    const winner = await profile(byUid[debate.pro])
    const loser = await profile(byUid[debate.con])
    expect(winner).toMatchObject({ elo: 1016, wins: 1, losses: 0, debates: 1, activeDebateId: null })
    expect(loser).toMatchObject({ elo: 984, wins: 0, losses: 1, debates: 1, activeDebateId: null })

    const speeches = await getDocs(collection(ana.db, 'debates', debateId, 'speeches'))
    expect(speeches.size).toBe(6)

    // Judging again changes nothing.
    await call(judgeApi, ben, { debateId })
    expect((await profile(byUid[debate.pro])).elo).toBe(1016)

    // Both can queue again afterwards.
    expect((await call(matchmake, ana, { action: 'search', category: 'any' })).status).toBe('waiting')
  }, 60_000)

  it('enforces turn order and speech ownership', async () => {
    const debateId = await matchUp(ana, ben, 'any', 'ethics')
    const debate = await getDebate(ana, debateId)
    expect(debate.categoryId).toBe('ethics')
    const byUid = { [ana.uid]: ana, [ben.uid]: ben }
    const pro = byUid[debate.pro]
    const con = byUid[debate.con]

    // Prep can't be skipped by one player, and speeches can't be filed early.
    expect((await call(debateApi, pro, { debateId, action: 'advance', phase: -1 })).http).toBe(409)
    expect((await call(speechApi, pro, { debateId, phase: 0, captions: LONG })).http).toBe(409)

    await call(debateApi, pro, { debateId, action: 'ready' })
    await call(debateApi, con, { debateId, action: 'ready' })
    const live = await getDebate(ana, debateId)
    await sleep(Math.max(0, live.phaseStartsAt - Date.now()) + 30)

    // Con can't end Pro's speech, file Pro's speech, or jump ahead.
    expect((await call(debateApi, con, { debateId, action: 'advance', phase: 0 })).http).toBe(409)
    expect((await call(speechApi, con, { debateId, phase: 0, captions: 'mine now' })).http).toBe(403)
    expect((await call(speechApi, con, { debateId, phase: 1, captions: 'early' })).http).toBe(409)
    expect((await call(debateApi, pro, { debateId, action: 'advance', phase: 3 })).http).toBe(409)

    // A speech can only be filed once.
    await call(speechApi, pro, { debateId, phase: 0, captions: LONG })
    await call(speechApi, pro, { debateId, phase: 0, captions: 'rewritten' })
    const speech = await getDoc(doc(pro.db, 'debates', debateId, 'speeches', '0'))
    expect(speech.data().text).toBe(LONG)

    // When the clock runs out, either player's browser may move things on.
    await sleep(Math.max(0, live.phaseEndsAt - Date.now()) + 50)
    const moved = await call(debateApi, con, { debateId, action: 'advance', phase: 0 })
    expect(moved).toMatchObject({ status: 'live', phase: 1 })
    const repeat = await call(debateApi, pro, { debateId, action: 'advance', phase: 0 })
    expect(repeat).toMatchObject({ status: 'live', phase: 1 })
  }, 60_000)

  it('starts automatically when prep time runs out', async () => {
    const debateId = await matchUp(ana, ben)
    const debate = await getDebate(ana, debateId)
    await sleep(Math.max(0, debate.phaseEndsAt - Date.now()) + 50)
    const started = await call(debateApi, ana, { debateId, action: 'advance', phase: -1 })
    expect(started).toMatchObject({ status: 'live', phase: 0 })
  }, 30_000)

  it('awards a forfeit to the opponent', async () => {
    const debateId = await matchUp(ana, ben)
    const res = await call(debateApi, ana, { debateId, action: 'forfeit' })
    expect(res.status).toBe('complete')
    const done = await getDebate(ana, debateId)
    expect(done.result).toMatchObject({ winner: ben.uid, loser: ana.uid, reason: 'forfeit' })
    expect((await profile(ben)).elo).toBe(1016)
    expect((await profile(ana)).elo).toBe(984)

    // Forfeiting twice (or after the fact) changes nothing.
    await call(debateApi, ben, { debateId, action: 'forfeit' })
    expect((await profile(ben)).elo).toBe(1016)
  }, 30_000)

  it('only lets a player claim the win once the opponent is really gone', async () => {
    const debateId = await matchUp(ana, ben)
    const early = await call(debateApi, ana, { debateId, action: 'claim' })
    expect(early.http).toBe(409)

    // Pretend the debate began a while ago and Ben never sent a heartbeat.
    const botDb = await getDb()
    await serverUpdate(serverDoc(botDb, 'debates', debateId), { createdAt: Date.now() - 40_000 })
    const claimed = await call(debateApi, ana, { debateId, action: 'claim' })
    expect(claimed.status).toBe('complete')
    const done = await getDebate(ana, debateId)
    expect(done.result).toMatchObject({ winner: ana.uid, reason: 'disconnect' })
  }, 30_000)

  it('gives the round to the only debater who spoke', async () => {
    const debateId = await matchUp(ana, ben)
    const debate = await playThrough(ana, ben, debateId, (side) => (side === 'con' ? SHORT : null))
    await judgeUntilDone(ben, debateId)
    const done = await getDebate(ana, debateId)
    expect(done.result).toMatchObject({ winner: debate.con, reason: 'no_show' })
    expect(done.result.judgment).toBeNull()
  }, 60_000)

  it('calls it a no contest when nobody speaks, leaving ratings alone', async () => {
    const debateId = await matchUp(ana, ben)
    await playThrough(ana, ben, debateId, () => null)
    await judgeUntilDone(ana, debateId)
    const done = await getDebate(ana, debateId)
    expect(done.result).toMatchObject({ winner: null, reason: 'no_contest' })
    expect(await profile(ana)).toMatchObject({ elo: 1000, debates: 0, activeDebateId: null })
    expect(await profile(ben)).toMatchObject({ elo: 1000, debates: 0 })
  }, 60_000)

  it('sends a player back to their unfinished debate instead of re-queueing', async () => {
    const debateId = await matchUp(ana, ben)
    const res = await call(matchmake, ana, { action: 'search', category: 'world' })
    expect(res).toMatchObject({ status: 'matched', debateId })
    // And nobody else can be matched against them meanwhile.
    expect((await call(matchmake, cat, { action: 'search', category: 'any' })).status).toBe('waiting')
  }, 30_000)

  it('closes debates both players walked away from', async () => {
    const debateId = await matchUp(ana, ben)
    const botDb = await getDb()
    await serverUpdate(serverDoc(botDb, 'debates', debateId), { phaseEndsAt: Date.now() - 200_000 })
    const res = await call(matchmake, ana, { action: 'search', category: 'tech' })
    expect(res.status).toBe('waiting')
    expect((await getDebate(ana, debateId)).status).toBe('abandoned')
    expect((await profile(ben)).elo).toBe(1000)
  }, 30_000)

  it('does not match different categories, and lets players leave the queue', async () => {
    expect((await call(matchmake, ana, { action: 'search', category: 'tech' })).status).toBe('waiting')
    expect((await call(matchmake, ben, { action: 'search', category: 'world' })).status).toBe('waiting')
    await call(matchmake, ana, { action: 'leave' })
    expect((await call(matchmake, cat, { action: 'search', category: 'tech' })).status).toBe('waiting')
    expect((await call(matchmake, ben, { action: 'search', category: 'any' })).status).toBe('matched')
  }, 30_000)

  it('issues voice tokens only to the debaters, only while the debate is on', async () => {
    const debateId = await matchUp(ana, ben)
    const res = await call(tokenApi, ana, { debateId })
    expect(res.http).toBe(200)
    expect(res.token.split('.')).toHaveLength(3)
    await call(debateApi, ana, { debateId, action: 'forfeit' })
    expect((await call(tokenApi, ana, { debateId })).http).toBe(409)
  }, 30_000)
})
