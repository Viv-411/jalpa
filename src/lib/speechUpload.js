import { api } from './api'

const MAX_TRIES = 4
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// Sends a finished speech to be transcribed. Retries in the background so a
// blip in the connection doesn't cost a debater their speech.
export async function uploadSpeech({ debateId, phase, blob, captions }) {
  let audio = ''
  try {
    if (blob && blob.size > 0) audio = await toBase64(blob)
  } catch {
    audio = ''
  }

  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    try {
      await api('speech', {
        debateId,
        phase,
        audio,
        mimeType: blob?.type ?? '',
        captions: captions ?? '',
        lastTry: attempt === MAX_TRIES,
      })
      return true
    } catch (err) {
      // 4xx (other than "busy") means the server won't take it; stop trying.
      const retryable = !err.status || err.status >= 500 || err.status === 429
      if (!retryable || attempt === MAX_TRIES) {
        console.warn('Speech upload failed', err)
        return false
      }
      await wait(1500 * attempt)
    }
  }
  return false
}
