// Helpers for tests that run the real API functions against the Firebase
// emulators. Run through `npm run test:integration`.
import fs from 'node:fs'
import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'

export function loadEnv() {
  if (fs.existsSync('.env.local')) {
    for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].trim().replace(/^"|"$/g, '')
      }
    }
  }
  process.env.VITE_FIREBASE_PROJECT_ID ??= 'debate-app-411'
  process.env.VITE_FIREBASE_API_KEY ??= 'fake-api-key'
  process.env.JUDGE_BOT_EMAIL ??= 'judge-bot@example.com'
  process.env.JUDGE_BOT_PASSWORD ??= 'emulator-only-password'
  process.env.JALPA_EMULATORS = '1'
  process.env.JALPA_MOCK_AI = '1'
  process.env.JALPA_TIME_SCALE ??= '0.01'
  process.env.JALPA_TRANSCRIPT_GRACE_MS ??= '1500'
}

export const BOT_UID = 'N2VtCi2OGPQv0Biogfkzq7pXczA3'
const projectId = () => process.env.VITE_FIREBASE_PROJECT_ID

// The emulator lets us create the bot with the same UID the rules name.
export async function ensureBot() {
  const res = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${projectId()}/accounts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({
        localId: BOT_UID,
        email: process.env.JUDGE_BOT_EMAIL,
        password: process.env.JUDGE_BOT_PASSWORD,
      }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    if (!/DUPLICATE|EMAIL_EXISTS/.test(text)) throw new Error(`Could not create bot: ${text}`)
  }
}

export async function clearFirestore() {
  await fetch(
    `http://127.0.0.1:8080/emulator/v1/projects/${projectId()}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
}

let counter = 0
const apps = []

// Signs up a player the way the browser does, including their profile doc.
export async function makePlayer(name, { withProfile = true } = {}) {
  counter += 1
  const app = initializeApp(
    { apiKey: process.env.VITE_FIREBASE_API_KEY, projectId: projectId() },
    `player-${Date.now()}-${counter}`,
  )
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8080)

  const email = `${name.toLowerCase()}-${Date.now()}-${counter}@example.com`
  const { user } = await createUserWithEmailAndPassword(auth, email, 'password123')
  if (withProfile) {
    await setDoc(doc(db, 'users', user.uid), {
      name,
      elo: 1000,
      wins: 0,
      losses: 0,
      debates: 0,
      createdAt: serverTimestamp(),
    })
  }
  return { uid: user.uid, name, db, auth, token: () => user.getIdToken() }
}

export async function closePlayers() {
  await Promise.all(apps.splice(0).map((app) => deleteApp(app)))
}

// Calls an API function the way Vercel would.
export async function call(handler, player, body, { method = 'POST' } = {}) {
  const headers = {}
  if (player) headers.authorization = `Bearer ${await player.token()}`
  let status = 200
  let payload = null
  const res = {
    status(code) {
      status = code
      return res
    },
    json(data) {
      payload = data
      return res
    },
  }
  await handler({ method, headers, body }, res)
  return { http: status, ...payload }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
