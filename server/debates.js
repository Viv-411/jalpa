// Debate lifecycle on the server: loading, moving through speeches, and
// writing final results with rating changes.

import { doc, getDoc, runTransaction } from 'firebase/firestore/lite'
import { applyResult, STARTING_ELO } from '../shared/elo.js'
import { HttpError } from './errors.js'
import { getDb } from './firebase.js'
import {
  advancePatch,
  canClaim,
  isActive,
  isParticipant,
  opponentOf,
  readyPatch,
} from './flow.js'

export async function loadDebate(debateId, uid) {
  if (typeof debateId !== 'string' || !debateId || debateId.includes('/')) {
    throw new HttpError(400, 'Missing debate.')
  }
  const db = await getDb()
  const snap = await getDoc(doc(db, 'debates', debateId))
  if (!snap.exists()) throw new HttpError(404, 'That debate does not exist.')
  const debate = { id: snap.id, ...snap.data() }
  if (uid && !isParticipant(debate, uid)) {
    throw new HttpError(403, 'You are not part of that debate.')
  }
  return debate
}

async function mutate(debateId, uid, buildPatch) {
  const db = await getDb()
  const ref = doc(db, 'debates', debateId)
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new HttpError(404, 'That debate does not exist.')
    const debate = { id: snap.id, ...snap.data() }
    if (!isParticipant(debate, uid)) {
      throw new HttpError(403, 'You are not part of that debate.')
    }
    const patch = buildPatch(debate)
    if (patch) tx.update(ref, { ...patch, updatedAt: Date.now() })
    return { ...debate, ...(patch ?? {}) }
  })
}

export function markReady(debateId, uid) {
  return mutate(debateId, uid, (debate) => readyPatch(debate, uid, Date.now()))
}

export function advance(debateId, uid, phase) {
  if (!Number.isInteger(phase) || phase < -1) throw new HttpError(400, 'Bad phase.')
  return mutate(debateId, uid, (debate) => advancePatch(debate, uid, phase, Date.now()))
}

// Writes the final result. Idempotent: a debate is only ever finalized once.
//   outcome.winner  uid of the winner, or null for a no contest
//   outcome.reason  'decision' | 'forfeit' | 'disconnect' | 'no_show' | 'no_contest'
//   outcome.judgment  the judge's ballot, when there is one
export async function finalize(debateId, decide) {
  const db = await getDb()
  const debateRef = doc(db, 'debates', debateId)

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(debateRef)
    if (!snap.exists()) throw new HttpError(404, 'That debate does not exist.')
    const debate = { id: snap.id, ...snap.data() }
    if (debate.status === 'complete' || debate.status === 'abandoned') return debate

    const outcome = decide(debate)
    if (!outcome) return debate

    const [a, b] = debate.players
    const refs = { [a]: doc(db, 'users', a), [b]: doc(db, 'users', b) }
    const snaps = { [a]: await tx.get(refs[a]), [b]: await tx.get(refs[b]) }
    const profile = (uid) => snaps[uid].data() ?? {}
    const rating = (uid) => profile(uid).elo ?? STARTING_ELO
    const now = Date.now()

    const elo = {}
    if (outcome.winner) {
      const winner = outcome.winner
      const loser = opponentOf(debate, winner)
      const change = applyResult(rating(winner), rating(loser))
      elo[winner] = { before: rating(winner), after: change.winnerAfter, change: change.winnerChange }
      elo[loser] = { before: rating(loser), after: change.loserAfter, change: change.loserChange }
    } else {
      for (const uid of debate.players) {
        elo[uid] = { before: rating(uid), after: rating(uid), change: 0 }
      }
    }

    for (const uid of debate.players) {
      if (!snaps[uid].exists()) continue
      const data = profile(uid)
      const update = { elo: elo[uid].after }
      if (data.activeDebateId === debateId) update.activeDebateId = null
      if (outcome.winner) {
        update.debates = (data.debates ?? 0) + 1
        if (uid === outcome.winner) update.wins = (data.wins ?? 0) + 1
        else update.losses = (data.losses ?? 0) + 1
      }
      tx.update(refs[uid], update)
    }

    const result = {
      winner: outcome.winner ?? null,
      loser: outcome.winner ? opponentOf(debate, outcome.winner) : null,
      reason: outcome.reason,
      elo,
      judgment: outcome.judgment ?? null,
      completedAt: now,
    }
    const patch = { status: 'complete', result, endedAt: debate.endedAt ?? now, updatedAt: now }
    tx.update(debateRef, patch)
    return { ...debate, ...patch }
  })
}

// The caller gives up; their opponent wins.
export function forfeit(debateId, uid) {
  return finalize(debateId, (debate) => {
    if (!isParticipant(debate, uid)) throw new HttpError(403, 'You are not part of that debate.')
    if (!isActive(debate)) return null
    return { winner: opponentOf(debate, uid), reason: 'forfeit' }
  })
}

// The caller claims the win because their opponent has disconnected.
export async function claimWin(debateId, uid) {
  const db = await getDb()
  const debate = await loadDebate(debateId, uid)
  const opponent = opponentOf(debate, uid)
  const presence = await getDoc(doc(db, 'debates', debateId, 'presence', opponent))
  const seenAt = presence.exists() ? presence.data().at?.toMillis?.() ?? 0 : 0

  if (!canClaim(debate, seenAt, Date.now())) {
    throw new HttpError(409, 'Your opponent is still connected.', 'still_here')
  }
  return finalize(debateId, (fresh) => {
    if (!isActive(fresh)) return null
    return { winner: uid, reason: 'disconnect' }
  })
}

// Both players walked away mid-debate. Close it without touching ratings.
export async function abandon(debateId) {
  const db = await getDb()
  const debateRef = doc(db, 'debates', debateId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(debateRef)
    if (!snap.exists()) return
    const debate = snap.data()
    if (!isActive(debate)) return
    const userSnaps = []
    for (const uid of debate.players) {
      userSnaps.push([uid, await tx.get(doc(db, 'users', uid))])
    }
    for (const [uid, userSnap] of userSnaps) {
      if (userSnap.exists() && userSnap.data().activeDebateId === debateId) {
        tx.update(doc(db, 'users', uid), { activeDebateId: null })
      }
    }
    tx.update(debateRef, { status: 'abandoned', endedAt: Date.now(), updatedAt: Date.now() })
  })
}
