import { auth } from '../firebase'

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Difference between the server clock and this device's clock, so both
// debaters see the same countdown even if one laptop's clock is off.
let clockOffset = 0
let bestRoundTrip = Infinity

export function serverNow() {
  return Date.now() + clockOffset
}

export async function api(path, body = {}) {
  const user = auth.currentUser
  if (!user) throw new ApiError('Sign in to continue.', 401)
  const token = await user.getIdToken()

  const sentAt = Date.now()
  let response
  try {
    response = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Can’t reach Jalpa. Check your connection.', 0, 'network')
  }
  const receivedAt = Date.now()
  const data = await response.json().catch(() => ({}))

  if (typeof data.now === 'number') {
    const roundTrip = receivedAt - sentAt
    if (roundTrip <= bestRoundTrip + 50) {
      bestRoundTrip = Math.min(bestRoundTrip, roundTrip)
      clockOffset = data.now - (sentAt + receivedAt) / 2
    }
  }

  if (!response.ok) {
    throw new ApiError(data.error || 'Something went wrong. Try again.', response.status, data.code)
  }
  return data
}
