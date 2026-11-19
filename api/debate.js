// POST /api/debate  { debateId, action, phase? }
//   sync     -> just returns the server clock
//   ready    -> mark yourself ready during prep
//   advance  -> move past `phase` (time is up, or the speaker yields)
//   forfeit  -> concede the debate
//   claim    -> claim the win after your opponent disconnects
import { advance, claimWin, forfeit, markReady } from '../server/debates.js'
import { HttpError } from '../server/errors.js'
import { endpoint } from '../server/http.js'

export default endpoint(async ({ uid, body }) => {
  const { debateId, action } = body
  if (action === 'sync') return {}

  let debate
  if (action === 'ready') debate = await markReady(debateId, uid)
  else if (action === 'advance') debate = await advance(debateId, uid, body.phase)
  else if (action === 'forfeit') debate = await forfeit(debateId, uid)
  else if (action === 'claim') debate = await claimWin(debateId, uid)
  else throw new HttpError(400, 'Unknown action.')

  return { status: debate.status, phase: debate.phase }
})
