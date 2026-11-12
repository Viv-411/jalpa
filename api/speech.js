// POST /api/speech  { debateId, phase, audio (base64), mimeType, captions, lastTry }
// Uploads the recording of a speech you just gave so it can be transcribed.
import { endpoint } from '../server/http.js'
import { submitSpeech } from '../server/speech.js'

export default endpoint(async ({ uid, body }) => submitSpeech(uid, body))
