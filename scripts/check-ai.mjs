// Checks the real AI pipeline end to end: transcribes sample recordings and
// asks the judge for a ballot. Uses the live (free) Gemini quota.
//   node scripts/check-ai.mjs path/to/pro.webm path/to/con.mp4
import fs from 'node:fs'
import { buildSchedule } from '../shared/format.js'

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && process.env[match[1]] === undefined) {
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, '')
  }
}

const { transcribeAudio, generateJson } = await import('../server/llm.js')
const { buildJudgePrompt, JUDGE_SYSTEM, normalizeJudgment } = await import('../server/judging.js')

const TYPES = { webm: 'audio/webm', mp4: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg' }
const speeches = {}
const files = process.argv.slice(2)

for (const [index, file] of files.entries()) {
  const mimeType = TYPES[file.split('.').pop()]
  const started = Date.now()
  const text = await transcribeAudio({ base64: fs.readFileSync(file).toString('base64'), mimeType })
  console.log(`\n[${mimeType}, ${Date.now() - started}ms] ${text}`)
  speeches[index] = { text }
}

const debate = { topic: 'In a democracy, voting ought to be compulsory.', schedule: buildSchedule() }
const started = Date.now()
const ballot = await generateJson({
  system: JUDGE_SYSTEM,
  prompt: buildJudgePrompt(debate, speeches),
  parse: normalizeJudgment,
})
console.log(`\n[judge, ${Date.now() - started}ms]`)
console.log(JSON.stringify(ballot, null, 2))
process.exit(0)
