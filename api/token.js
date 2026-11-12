// POST /api/token  { debateId }  ->  { token, url }
// Issues a LiveKit voice-room token to a debater in that debate.
import { AccessToken } from 'livekit-server-sdk'
import { loadDebate } from '../server/debates.js'
import { HttpError } from '../server/errors.js'
import { isActive } from '../server/flow.js'
import { endpoint } from '../server/http.js'

export default endpoint(async ({ uid, body }) => {
  const debate = await loadDebate(body.debateId, uid)
  if (!isActive(debate)) throw new HttpError(409, 'This debate has ended.', 'ended')

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) throw new Error('LiveKit credentials are not configured')

  const token = new AccessToken(apiKey, apiSecret, {
    identity: uid,
    name: debate.names?.[uid] ?? 'Debater',
    ttl: '45m',
  })
  token.addGrant({
    roomJoin: true,
    room: `debate-${debate.id}`,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  return { token: await token.toJwt(), url: process.env.VITE_LIVEKIT_URL }
})
