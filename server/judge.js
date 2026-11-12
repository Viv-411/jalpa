// Judging: gathers the transcripts, asks the model for a ballot, then writes
// the result and rating changes. Safe to call repeatedly; browsers poll it
// from the results screen until the debate is complete.

import { collection, doc, getDocs, runTransaction } from 'firebase/firestore/lite'
import { finalize, loadDebate } from './debates.js'
import { HttpError } from './errors.js'
import { getDb } from './firebase.js'
import {
  buildJudgePrompt,
  JUDGE_SYSTEM,
  mockJudgment,
  normalizeJudgment,
  wordsBySide,
} from './judging.js'
import { generateJson, mockAi } from './llm.js'

// How long to wait for late transcripts after the final speech ends.
export const TRANSCRIPT_GRACE_MS = 45_000
const LOCK_MS = 75_000
const MAX_ATTEMPTS = 4
const MIN_WORDS = 12

function graceMs() {
  const override = Number(process.env.JALPA_TRANSCRIPT_GRACE_MS)
  return override >= 0 && process.env.JALPA_TRANSCRIPT_GRACE_MS ? override : TRANSCRIPT_GRACE_MS
}

async function loadSpeeches(db, debateId) {
  const snap = await getDocs(collection(db, 'debates', debateId, 'speeches'))
  const speeches = {}
  for (const entry of snap.docs) speeches[Number(entry.id)] = entry.data()
  return speeches
}

// Takes the judging lock, so two browsers polling at once only trigger one ballot.
async function takeLock(db, debateId) {
  const ref = doc(db, 'debates', debateId)
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const debate = snap.data()
    if (debate.status !== 'judging') return { locked: false }
    const now = Date.now()
    if (debate.judgeLockAt && now - debate.judgeLockAt < LOCK_MS) return { locked: false }
    const attempts = (debate.judgeAttempts ?? 0) + 1
    tx.update(ref, { judgeLockAt: now, judgeAttempts: attempts })
    return { locked: true, attempts }
  })
}

async function releaseLock(db, debateId) {
  const ref = doc(db, 'debates', debateId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists() && snap.data().status === 'judging') tx.update(ref, { judgeLockAt: 0 })
  })
}

async function decide(debate, speeches) {
  const words = wordsBySide(debate, speeches)

  // A speech was given but we failed to transcribe it. Judging without it
  // would be unfair, so the round doesn't count.
  if (Object.values(speeches).some((speech) => speech.source === 'failed')) {
    return { winner: null, reason: 'judge_unavailable' }
  }

  // Nobody really spoke: nothing to judge, ratings stay put.
  if (words.pro < MIN_WORDS && words.con < MIN_WORDS) {
    return { winner: null, reason: 'no_contest' }
  }
  // Only one debater showed up to speak.
  if (words.pro < MIN_WORDS || words.con < MIN_WORDS) {
    const side = words.pro < MIN_WORDS ? 'con' : 'pro'
    return { winner: debate[side], reason: 'no_show' }
  }

  const judgment = mockAi()
    ? mockJudgment(debate, speeches)
    : normalizeJudgment(
        await generateJson({ system: JUDGE_SYSTEM, prompt: buildJudgePrompt(debate, speeches) }),
      )
  return { winner: debate[judgment.winner], reason: 'decision', judgment }
}

export async function judge(debateId, uid) {
  const db = await getDb()
  const debate = await loadDebate(debateId, uid)

  if (debate.status === 'complete' || debate.status === 'abandoned') {
    return { status: debate.status }
  }
  if (debate.status !== 'judging') {
    throw new HttpError(409, 'The debate is still in progress.', 'in_progress')
  }

  const speeches = await loadSpeeches(db, debateId)
  const expected = debate.schedule.speeches.length
  const received = Object.keys(speeches).length
  const waitedMs = Date.now() - (debate.endedAt ?? 0)
  if (received < expected && waitedMs < graceMs()) {
    return { status: 'judging', stage: 'transcribing', received, expected }
  }

  const lock = await takeLock(db, debateId)
  if (!lock.locked) return { status: 'judging', stage: 'deliberating' }

  let outcome
  try {
    outcome = await decide(debate, speeches)
  } catch (err) {
    console.error('[judge] attempt failed', err)
    if (lock.attempts >= MAX_ATTEMPTS) {
      // The judge is unreachable. Close the debate without moving ratings
      // rather than leaving both players stuck.
      await finalize(debateId, () => ({ winner: null, reason: 'judge_unavailable' }))
      return { status: 'complete' }
    }
    await releaseLock(db, debateId)
    return { status: 'judging', stage: 'retrying' }
  }

  await finalize(debateId, (fresh) => (fresh.status === 'judging' ? outcome : null))
  return { status: 'complete' }
}
