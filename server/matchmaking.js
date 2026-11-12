// Matchmaking. Browsers call `search` every few seconds while they wait; each
// call refreshes the caller's place in the queue and tries to pair them with
// the longest-waiting compatible opponent.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore/lite'
import { matchWindow, STARTING_ELO } from '../shared/elo.js'
import { buildSchedule } from '../shared/format.js'
import {
  getCategory,
  isValidCategoryChoice,
  pickTopic,
  resolveCategory,
} from '../shared/topics.js'
import { abandon } from './debates.js'
import { HttpError } from './errors.js'
import { getDb } from './firebase.js'
import { isActive, isStale } from './flow.js'

export const HEARTBEAT_TIMEOUT_MS = 12_000
const RECENT_TOPICS_KEPT = 30

function timeScale() {
  const scale = Number(process.env.JALPA_TIME_SCALE)
  return scale > 0 ? scale : 1
}

// Pure: can these two queue entries be matched right now?
export function compatible(me, them, now) {
  if (me.uid === them.uid) return false
  if (them.status !== 'waiting') return false
  if (now - them.heartbeatAt > HEARTBEAT_TIMEOUT_MS) return false
  if (resolveCategory(me.category, them.category, () => 0) === null) return false
  const waited = Math.max(now - me.joinedAt, now - them.joinedAt) / 1000
  return Math.abs(me.elo - them.elo) <= matchWindow(waited)
}

// Pure: order candidates so the person who has waited longest goes first.
export function rankCandidates(me, entries, now) {
  return entries
    .filter((entry) => compatible(me, entry, now))
    .sort((a, b) => a.joinedAt - b.joinedAt)
}

async function activeDebateFor(db, user) {
  if (!user.activeDebateId) return null
  const snap = await getDoc(doc(db, 'debates', user.activeDebateId))
  if (!snap.exists()) return null
  const debate = { id: snap.id, ...snap.data() }
  if (!isActive(debate)) return null
  if (isStale(debate, Date.now())) {
    await abandon(debate.id)
    return null
  }
  return debate
}

async function pair(db, meUid, themUid) {
  const debateRef = doc(collection(db, 'debates'))
  const refs = {
    meQueue: doc(db, 'queue', meUid),
    themQueue: doc(db, 'queue', themUid),
    meUser: doc(db, 'users', meUid),
    themUser: doc(db, 'users', themUid),
  }

  return runTransaction(db, async (tx) => {
    const meQueue = await tx.get(refs.meQueue)
    const themQueue = await tx.get(refs.themQueue)
    const meUser = await tx.get(refs.meUser)
    const themUser = await tx.get(refs.themUser)
    const now = Date.now()

    if (!meQueue.exists() || !themQueue.exists() || !meUser.exists() || !themUser.exists()) {
      return null
    }
    const me = meQueue.data()
    const them = themQueue.data()
    if (me.status !== 'waiting' || !compatible(me, them, now)) return null

    // Never pull someone who is already in a live debate into a second one.
    for (const userSnap of [meUser, themUser]) {
      const activeId = userSnap.data().activeDebateId
      if (!activeId) continue
      const activeSnap = await tx.get(doc(db, 'debates', activeId))
      if (activeSnap.exists() && isActive(activeSnap.data()) && !isStale(activeSnap.data(), now)) {
        return null
      }
    }

    const categoryId = resolveCategory(me.category, them.category)
    const meRecent = meUser.data().recentTopics ?? []
    const themRecent = themUser.data().recentTopics ?? []
    const topic = pickTopic(categoryId, [...meRecent, ...themRecent])
    const category = getCategory(categoryId)

    const meIsPro = Math.random() < 0.5
    const pro = meIsPro ? meUid : themUid
    const con = meIsPro ? themUid : meUid
    const schedule = buildSchedule(timeScale())

    tx.set(debateRef, {
      players: [meUid, themUid],
      names: {
        [meUid]: meUser.data().name ?? 'Debater',
        [themUid]: themUser.data().name ?? 'Debater',
      },
      elos: {
        [meUid]: meUser.data().elo ?? STARTING_ELO,
        [themUid]: themUser.data().elo ?? STARTING_ELO,
      },
      sides: { [pro]: 'pro', [con]: 'con' },
      pro,
      con,
      categoryId,
      categoryName: category.name,
      topicId: topic.id,
      topic: topic.text,
      topicSource: topic.source,
      schedule,
      status: 'prep',
      ready: { [meUid]: false, [themUid]: false },
      phase: -1,
      phaseStartsAt: now,
      phaseEndsAt: now + schedule.prepSeconds * 1000,
      createdAt: now,
      updatedAt: now,
    })

    const matched = { status: 'matched', debateId: debateRef.id, matchedAt: now }
    tx.update(refs.meQueue, matched)
    tx.update(refs.themQueue, matched)
    tx.update(refs.meUser, {
      activeDebateId: debateRef.id,
      recentTopics: [...meRecent, topic.id].slice(-RECENT_TOPICS_KEPT),
    })
    tx.update(refs.themUser, {
      activeDebateId: debateRef.id,
      recentTopics: [...themRecent, topic.id].slice(-RECENT_TOPICS_KEPT),
    })

    return debateRef.id
  })
}

export async function search(uid, category) {
  if (!isValidCategoryChoice(category)) throw new HttpError(400, 'Pick a category first.')

  const db = await getDb()
  const userSnap = await getDoc(doc(db, 'users', uid))
  if (!userSnap.exists()) {
    throw new HttpError(409, 'Your profile is still being set up. Try again in a moment.')
  }
  const user = userSnap.data()

  const current = await activeDebateFor(db, user)
  if (current) return { status: 'matched', debateId: current.id }

  const queueRef = doc(db, 'queue', uid)
  const queueSnap = await getDoc(queueRef)
  const existing = queueSnap.exists() ? queueSnap.data() : null
  const now = Date.now()

  const keepPlace =
    existing?.status === 'waiting' &&
    existing.category === category &&
    now - existing.heartbeatAt <= HEARTBEAT_TIMEOUT_MS

  const me = {
    uid,
    name: user.name ?? 'Debater',
    elo: user.elo ?? STARTING_ELO,
    category,
    status: 'waiting',
    joinedAt: keepPlace ? existing.joinedAt : now,
    heartbeatAt: now,
  }
  await setDoc(queueRef, me)

  const waiting = await getDocs(query(collection(db, 'queue'), where('status', '==', 'waiting')))
  const candidates = rankCandidates(
    me,
    waiting.docs.map((entry) => entry.data()),
    now,
  )

  for (const candidate of candidates.slice(0, 3)) {
    try {
      const debateId = await pair(db, uid, candidate.uid)
      if (debateId) return { status: 'matched', debateId }
    } catch (err) {
      // Lost a race for this opponent; try the next one.
      console.warn('[matchmaking] pair failed', err?.code ?? err?.message)
    }
    // Someone else may have just matched us.
    const mine = await getDoc(queueRef)
    if (mine.exists() && mine.data().status === 'matched') {
      return { status: 'matched', debateId: mine.data().debateId }
    }
  }

  return { status: 'waiting', waitedMs: now - me.joinedAt, searching: waiting.size }
}

export async function leave(uid) {
  const db = await getDb()
  const queueRef = doc(db, 'queue', uid)
  const snap = await getDoc(queueRef)
  if (snap.exists() && snap.data().status === 'waiting') await deleteDoc(queueRef)
  return { status: 'left' }
}
