import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { doc as serverDoc, setDoc as serverSetDoc } from 'firebase/firestore/lite'
import { clearFirestore, closePlayers, ensureBot, loadEnv, makePlayer } from './helpers.js'

loadEnv()
const { getDb } = await import('../../server/firebase.js')

const denied = (promise) => expect(promise).rejects.toMatchObject({ code: 'permission-denied' })

describe('firestore rules', () => {
  let ana, ben, cat, botDb

  beforeAll(async () => {
    await ensureBot()
    await clearFirestore()
    botDb = await getDb()
    ana = await makePlayer('Ana')
    ben = await makePlayer('Ben')
    cat = await makePlayer('Cat')
    await serverSetDoc(serverDoc(botDb, 'debates', 'd1'), {
      players: [ana.uid, ben.uid],
      status: 'live',
      createdAt: 1,
    })
    await serverSetDoc(serverDoc(botDb, 'debates', 'd1', 'speeches', '0'), { text: 'hello' })
    await serverSetDoc(serverDoc(botDb, 'queue', ana.uid), { status: 'waiting' })
  })

  afterAll(closePlayers)

  it('lets a new player create only a clean starting profile', async () => {
    const dan = await makePlayer('Dan', { withProfile: false })
    const ref = doc(dan.db, 'users', dan.uid)
    const clean = { name: 'Dan', elo: 1000, wins: 0, losses: 0, debates: 0, createdAt: serverTimestamp() }
    await denied(setDoc(ref, { ...clean, elo: 2400 }))
    await denied(setDoc(ref, { ...clean, wins: 50 }))
    await denied(setDoc(ref, { ...clean, admin: true }))
    await denied(setDoc(ref, { ...clean, name: '' }))
    await denied(setDoc(doc(dan.db, 'users', ana.uid), clean))
    await setDoc(ref, clean)
  })

  it('lets players rename themselves but never touch ratings or records', async () => {
    const ref = doc(ana.db, 'users', ana.uid)
    await updateDoc(ref, { name: 'Ana B' })
    await denied(updateDoc(ref, { elo: 3000 }))
    await denied(updateDoc(ref, { wins: 99 }))
    await denied(updateDoc(ref, { name: 'x'.repeat(31) }))
    await denied(updateDoc(doc(ana.db, 'users', ben.uid), { name: 'Loser' }))
    await denied(deleteDoc(ref))
  })

  it('lets any signed-in player read profiles (for the leaderboard)', async () => {
    const snap = await getDoc(doc(cat.db, 'users', ana.uid))
    expect(snap.data().name).toBe('Ana B')
  })

  it('keeps debates private to the two debaters and read-only', async () => {
    expect((await getDoc(doc(ana.db, 'debates', 'd1'))).exists()).toBe(true)
    await denied(getDoc(doc(cat.db, 'debates', 'd1')))
    await denied(updateDoc(doc(ana.db, 'debates', 'd1'), { status: 'complete' }))
    await denied(setDoc(doc(ana.db, 'debates', 'forged'), { players: [ana.uid], status: 'complete' }))

    const mine = await getDocs(
      query(collection(ben.db, 'debates'), where('players', 'array-contains', ben.uid)),
    )
    expect(mine.size).toBe(1)
    await denied(
      getDocs(query(collection(cat.db, 'debates'), where('players', 'array-contains', ana.uid))),
    )
  })

  it('keeps transcripts private and server-written', async () => {
    const speech = await getDoc(doc(ben.db, 'debates', 'd1', 'speeches', '0'))
    expect(speech.data().text).toBe('hello')
    await denied(getDoc(doc(cat.db, 'debates', 'd1', 'speeches', '0')))
    await denied(setDoc(doc(ana.db, 'debates', 'd1', 'speeches', '2'), { text: 'I win' }))
  })

  it('lets debaters write only their own heartbeat', async () => {
    await setDoc(doc(ana.db, 'debates', 'd1', 'presence', ana.uid), { at: serverTimestamp() })
    await denied(setDoc(doc(ana.db, 'debates', 'd1', 'presence', ben.uid), { at: serverTimestamp() }))
    await denied(setDoc(doc(ana.db, 'debates', 'd1', 'presence', ana.uid), { at: new Date(0) }))
    await denied(setDoc(doc(cat.db, 'debates', 'd1', 'presence', cat.uid), { at: serverTimestamp() }))
    expect((await getDoc(doc(ben.db, 'debates', 'd1', 'presence', ana.uid))).exists()).toBe(true)
  })

  it('hides the matchmaking queue from players', async () => {
    await denied(getDoc(doc(ana.db, 'queue', ana.uid)))
    await denied(setDoc(doc(ana.db, 'queue', ana.uid), { status: 'matched', debateId: 'd1' }))
  })
})
