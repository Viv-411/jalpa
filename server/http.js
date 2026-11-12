import { verifyIdToken } from './firebase.js'

import { HttpError } from './errors.js'

export { HttpError }

function readBody(req) {
  if (req.body == null) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      throw new HttpError(400, 'Request body must be JSON.')
    }
  }
  return req.body
}

// Wraps an API function: POST only, authenticated, JSON in and out.
// Every response carries `now` (server clock) so browsers can sync timers.
export function endpoint(fn) {
  return async function handler(req, res) {
    try {
      if (req.method !== 'POST') {
        throw new HttpError(405, 'Method not allowed.')
      }
      const header = req.headers?.authorization ?? ''
      const token = header.startsWith('Bearer ') ? header.slice(7) : ''
      const uid = await verifyIdToken(token)
      const result = await fn({ uid, body: readBody(req) })
      res.status(200).json({ ...result, now: Date.now() })
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message, code: err.code, now: Date.now() })
        return
      }
      console.error('[api]', err)
      res.status(500).json({ error: 'Something went wrong on our side. Try again.', now: Date.now() })
    }
  }
}
