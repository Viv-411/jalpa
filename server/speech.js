// Receives the recording of one speech from the debater who gave it,
// transcribes it, and stores the transcript for the judge.

import { doc, getDoc, setDoc } from 'firebase/firestore/lite'
import { loadDebate } from './debates.js'
import { HttpError } from './errors.js'
import { getDb } from './firebase.js'
import { speakerOf } from './flow.js'
import { MAX_SPEECH_CHARS } from './judging.js'
import { mockAi, transcribeAudio } from './llm.js'

const MAX_AUDIO_BASE64 = 4_200_000
const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/mpeg']

function cleanText(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_SPEECH_CHARS)
}

export async function submitSpeech(uid, { debateId, phase, audio, mimeType, captions, lastTry }) {
  const debate = await loadDebate(debateId, uid)

  if (!Number.isInteger(phase) || phase < 0 || phase >= debate.schedule.speeches.length) {
    throw new HttpError(400, 'Unknown speech.')
  }
  if (speakerOf(debate, phase) !== uid) {
    throw new HttpError(403, 'That speech belongs to your opponent.')
  }
  if (debate.status === 'prep' || debate.phase < phase) {
    throw new HttpError(409, 'That speech has not started yet.')
  }
  if (debate.status === 'complete' || debate.status === 'abandoned') {
    return { saved: false }
  }

  const db = await getDb()
  const ref = doc(db, 'debates', debateId, 'speeches', String(phase))
  const existing = await getDoc(ref)
  if (existing.exists()) return { saved: true, source: existing.data().source }

  const fallback = cleanText(captions)
  let text = ''
  let source = 'none'

  const baseType = typeof mimeType === 'string' ? mimeType.split(';')[0].trim().toLowerCase() : ''
  const hasAudio = typeof audio === 'string' && audio.length > 0

  if (hasAudio && audio.length > MAX_AUDIO_BASE64) {
    throw new HttpError(413, 'That recording is too large.')
  }

  if (mockAi()) {
    text = fallback
    source = fallback ? 'captions' : 'none'
  } else if (hasAudio && AUDIO_TYPES.includes(baseType)) {
    try {
      text = cleanText(await transcribeAudio({ base64: audio, mimeType: baseType }))
      source = 'transcript'
    } catch (err) {
      console.error('[speech] transcription failed', err)
    }
  }

  // If transcription was unavailable, fall back to the browser's live captions.
  if (source !== 'transcript' && fallback) {
    text = fallback
    source = 'captions'
  }

  // We had audio but could not transcribe it. Ask the browser to retry; if it
  // was the last try, record the failure so the round isn't judged unfairly.
  if (source === 'none' && hasAudio && !mockAi()) {
    if (!lastTry) throw new HttpError(503, 'Transcription is busy. Retrying.', 'transcription_failed')
    source = 'failed'
  }

  const speech = debate.schedule.speeches[phase]
  await setDoc(ref, {
    phase,
    uid,
    side: speech.side,
    name: speech.name,
    text,
    source,
    createdAt: Date.now(),
  })
  return { saved: true, source }
}
