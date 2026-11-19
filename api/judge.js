// POST /api/judge  { debateId }
// Judges a finished debate. Safe to call repeatedly until status is 'complete'.
import { endpoint } from '../server/http.js'
import { judge } from '../server/judge.js'

export default endpoint(async ({ uid, body }) => judge(body.debateId, uid))
