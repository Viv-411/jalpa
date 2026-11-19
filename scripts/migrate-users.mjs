// One-off cleanup of profiles created by the first version of the app:
// removes the email address (profiles are now public for the leaderboard)
// and the old topic list, and fills in the record fields.
//   node scripts/migrate-users.mjs
import fs from 'node:fs'
import { collection, deleteField, getDocs, updateDoc } from 'firebase/firestore/lite'

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && process.env[match[1]] === undefined) {
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, '')
  }
}

const { getDb } = await import('../server/firebase.js')
const db = await getDb()
const users = await getDocs(collection(db, 'users'))
let changed = 0

for (const user of users.docs) {
  const data = user.data()
  const patch = {}
  if ('email' in data) patch.email = deleteField()
  if ('usedTopics' in data) patch.usedTopics = deleteField()
  for (const field of ['wins', 'losses', 'debates']) {
    if (typeof data[field] !== 'number') patch[field] = 0
  }
  if (typeof data.elo !== 'number') patch.elo = 1000
  if (typeof data.name !== 'string' || !data.name.trim()) patch.name = 'Debater'
  if (Object.keys(patch).length > 0) {
    await updateDoc(user.ref, patch)
    changed += 1
  }
}

console.log(`Checked ${users.size} profiles, updated ${changed}.`)
process.exit(0)
