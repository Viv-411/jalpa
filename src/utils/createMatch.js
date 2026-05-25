import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { TOPICS } from '../data/topics'

function getCreatedAtMillis(entry) {
  const createdAt = entry.createdAt
  if (!createdAt) return 0
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis()
  return 0
}

export function isHostUser(hostUid, guestUid, hostEntry, guestEntry) {
  const hostTime = getCreatedAtMillis(hostEntry)
  const guestTime = getCreatedAtMillis(guestEntry)

  if (hostTime !== guestTime) return hostTime < guestTime
  return hostUid < guestUid
}

export async function createMatch(hostUid, guestUid, category) {
  const [hostUserSnap, guestUserSnap] = await Promise.all([
    getDoc(doc(db, 'users', hostUid)),
    getDoc(doc(db, 'users', guestUid)),
  ])

  const hostUsed = hostUserSnap.data()?.usedTopics ?? []
  const guestUsed = guestUserSnap.data()?.usedTopics ?? []
  const available = TOPICS[category].filter(
    (topic) => !hostUsed.includes(topic) && !guestUsed.includes(topic),
  )

  if (available.length === 0) {
    return { success: false, reason: 'no_topics' }
  }

  const topic = available[Math.floor(Math.random() * available.length)]
  const hostIsPro = Math.random() < 0.5
  const sides = {
    [hostUid]: hostIsPro ? 'Pro' : 'Con',
    [guestUid]: hostIsPro ? 'Con' : 'Pro',
  }

  const debateRef = doc(collection(db, 'debates'))
  const hostMatchRef = doc(db, 'matchmaking', hostUid)
  const guestMatchRef = doc(db, 'matchmaking', guestUid)

  await runTransaction(db, async (transaction) => {
    const hostMatchSnap = await transaction.get(hostMatchRef)
    const guestMatchSnap = await transaction.get(guestMatchRef)

    if (
      hostMatchSnap.data()?.status !== 'waiting' ||
      guestMatchSnap.data()?.status !== 'waiting'
    ) {
      throw new Error('match_no_longer_available')
    }

    transaction.set(debateRef, {
      player1uid: hostUid,
      player2uid: guestUid,
      topic,
      sides,
      category,
      status: 'topic_reveal',
      player1ready: false,
      player2ready: false,
      createdAt: serverTimestamp(),
    })

    transaction.update(hostMatchRef, {
      status: 'matched',
      debateId: debateRef.id,
    })

    transaction.update(guestMatchRef, {
      status: 'matched',
      debateId: debateRef.id,
    })

    transaction.update(doc(db, 'users', hostUid), {
      usedTopics: arrayUnion(topic),
    })

    transaction.update(doc(db, 'users', guestUid), {
      usedTopics: arrayUnion(topic),
    })
  })

  return { success: true, debateId: debateRef.id }
}
