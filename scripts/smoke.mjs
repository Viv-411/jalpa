// Live smoke test: two throwaway accounts play a whole debate through the
// real API, real database rules and the real AI judge, then everything they
// created is deleted again.
//
//   node scripts/smoke.mjs <site url> <pro speech audio> <con speech audio>
//   e.g. node scripts/smoke.mjs https://jalpadebate.vercel.app pro.webm con.mp4
import fs from 'node:fs'
import { deleteApp, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, deleteUser, getAuth } from 'firebase/auth'
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import { collection, deleteDoc, doc as botDoc, getDocs } from 'firebase/firestore/lite'

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && process.env[match[1]] === undefined) {
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, '')
  }
}

const [site, proAudio, conAudio] = process.argv.slice(2)
if (!site || !proAudio || !conAudio) {
  console.error('Usage: node scripts/smoke.mjs <site url> <pro audio> <con audio>')
  process.exit(2)
}
const TYPES = { webm: 'audio/webm', mp4: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg' }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

async function makePlayer(name) {
  const app = initializeApp(config, `smoke-${name}`)
  const auth = getAuth(app)
  const db = getFirestore(app)
  const email = `smoke-${name.toLowerCase()}-${Date.now()}@example.com`
  const { user } = await createUserWithEmailAndPassword(auth, email, `Sm0ke-${Date.now()}-${Math.random()}`)
  await setDoc(doc(db, 'users', user.uid), {
    name: `Smoke ${name}`,
    elo: 1000,
    wins: 0,
    losses: 0,
    debates: 0,
    createdAt: serverTimestamp(),
  })
  return { app, db, user, uid: user.uid, name }
}

async function call(player, path, body) {
  const res = await fetch(`${site}/api/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await player.user.getIdToken()}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${data.error ?? ''}`)
  return data
}

const players = []
let debateId = null
let failed = false

try {
  const ana = await makePlayer('Ana')
  const ben = await makePlayer('Ben')
  players.push(ana, ben)
  console.log('accounts created')

  // An unauthenticated request must be refused.
  const anon = await fetch(`${site}/api/matchmake`, { method: 'POST', body: '{}' })
  if (anon.status !== 401) throw new Error(`expected 401 without a token, got ${anon.status}`)

  await call(ana, 'matchmake', { action: 'search', category: 'democracy' })
  const matched = await call(ben, 'matchmake', { action: 'search', category: 'democracy' })
  if (matched.status !== 'matched') throw new Error('players were not matched')
  debateId = matched.debateId
  let debate = (await getDoc(doc(ana.db, 'debates', debateId))).data()
  console.log(`matched: "${debate.topic}"`)

  const token = await call(ana, 'token', { debateId })
  if (!token.token || !token.url) throw new Error('no voice token')
  console.log('voice token issued')

  await call(ana, 'debate', { debateId, action: 'ready' })
  await call(ben, 'debate', { debateId, action: 'ready' })

  const byUid = { [ana.uid]: ana, [ben.uid]: ben }
  const audio = { pro: proAudio, con: conAudio }
  const followUps = {
    pro: 'My opponent never answered my evidence, so my case stands. Extend my first contention and vote Pro.',
    con: 'Pro dropped my liberty argument entirely. A forced choice is not a free one, and that outweighs. Vote Con.',
  }

  for (let phase = 0; phase < debate.schedule.speeches.length; phase += 1) {
    debate = (await getDoc(doc(ana.db, 'debates', debateId))).data()
    const speech = debate.schedule.speeches[phase]
    const speaker = byUid[debate[speech.side]]
    await sleep(Math.max(0, debate.phaseStartsAt - Date.now()) + 400)
    const body =
      phase < 2
        ? {
            audio: fs.readFileSync(audio[speech.side]).toString('base64'),
            mimeType: TYPES[audio[speech.side].split('.').pop()],
          }
        : phase < 4
          ? { captions: followUps[speech.side] }
          : {}
    const saved = await call(speaker, 'speech', { debateId, phase, lastTry: true, ...body })
    console.log(`${speech.name}: ${saved.source}`)
    await call(speaker, 'debate', { debateId, action: 'advance', phase })
  }

  let done = null
  for (let i = 0; i < 40 && !done; i += 1) {
    const res = await call(ana, 'judge', { debateId })
    if (res.status === 'complete') done = res
    else await sleep(3000)
  }
  if (!done) throw new Error('judging did not finish in two minutes')

  debate = (await getDoc(doc(ben.db, 'debates', debateId))).data()
  const { result } = debate
  console.log(`\nresult: ${result.reason}, winner ${debate.names[result.winner] ?? 'nobody'}`)
  if (result.judgment) {
    console.log(`scores: pro ${result.judgment.totals.pro}, con ${result.judgment.totals.con}`)
    console.log(`decision: ${result.judgment.decision}`)
  }
  for (const player of players) {
    const profile = (await getDoc(doc(player.db, 'users', player.uid))).data()
    console.log(`${player.name}: rating ${profile.elo}, ${profile.wins}-${profile.losses}`)
  }
  if (result.reason !== 'decision') throw new Error(`expected a judged decision, got ${result.reason}`)
  console.log('\nSMOKE TEST PASSED')
} catch (err) {
  failed = true
  console.error('\nSMOKE TEST FAILED:', err.message)
} finally {
  // Remove everything the test created.
  try {
    const { getDb } = await import('../server/firebase.js')
    const db = await getDb()
    if (debateId) {
      for (const sub of ['speeches', 'presence']) {
        const docs = await getDocs(collection(db, 'debates', debateId, sub))
        for (const entry of docs.docs) await deleteDoc(entry.ref)
      }
      await deleteDoc(botDoc(db, 'debates', debateId))
    }
    for (const player of players) {
      await deleteDoc(botDoc(db, 'queue', player.uid))
      await deleteDoc(botDoc(db, 'users', player.uid))
      await deleteUser(player.user)
      await deleteApp(player.app)
    }
    console.log('test data removed')
  } catch (err) {
    console.error('cleanup failed:', err.message)
  }
  process.exit(failed ? 1 : 0)
}
