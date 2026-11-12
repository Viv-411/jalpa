// Firebase access for the API functions.
//
// The functions run on Vercel without a service account. Instead they sign in
// as a dedicated "judge bot" Firebase user, and firestore.rules grants that one
// UID write access to ratings, matches and results. Players can never write
// those documents themselves.

import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  initializeAuth,
  inMemoryPersistence,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore/lite'
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose'
import { HttpError } from './errors.js'

export const usingEmulators = () => process.env.JALPA_EMULATORS === '1'

export function projectId() {
  return process.env.VITE_FIREBASE_PROJECT_ID
}

let appPromise = null

async function boot() {
  const app = initializeApp(
    {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: projectId(),
      appId: process.env.VITE_FIREBASE_APP_ID,
    },
    'jalpa-server',
  )
  const auth = initializeAuth(app, { persistence: inMemoryPersistence })
  const db = getFirestore(app)

  if (usingEmulators()) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }

  const email = process.env.JUDGE_BOT_EMAIL
  const password = process.env.JUDGE_BOT_PASSWORD
  if (!email || !password) {
    throw new Error('JUDGE_BOT_EMAIL and JUDGE_BOT_PASSWORD are not configured')
  }
  await signInWithEmailAndPassword(auth, email, password)

  return { app, auth, db }
}

export function getServer() {
  if (!appPromise) {
    appPromise = boot().catch((err) => {
      appPromise = null
      throw err
    })
  }
  return appPromise
}

export async function getDb() {
  return (await getServer()).db
}

let jwks = null

// Verifies the caller's Firebase ID token and returns their uid.
export async function verifyIdToken(token) {
  if (!token) throw new HttpError(401, 'Sign in to continue.')

  try {
    if (usingEmulators()) {
      // Auth emulator tokens are unsigned; only ever accepted in emulator mode.
      const payload = decodeJwt(token)
      if (!payload.sub) throw new Error('missing sub')
      return payload.sub
    }

    jwks ??= createRemoteJWKSet(
      new URL(
        'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
      ),
    )
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${projectId()}`,
      audience: projectId(),
    })
    if (!payload.sub) throw new Error('missing sub')
    return payload.sub
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.')
  }
}
