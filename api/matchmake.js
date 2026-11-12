// POST /api/matchmake  { action: 'search' | 'leave', category }
import { HttpError } from '../server/errors.js'
import { endpoint } from '../server/http.js'
import { leave, search } from '../server/matchmaking.js'

export default endpoint(async ({ uid, body }) => {
  if (body.action === 'search') return search(uid, body.category)
  if (body.action === 'leave') return leave(uid)
  throw new HttpError(400, 'Unknown action.')
})
