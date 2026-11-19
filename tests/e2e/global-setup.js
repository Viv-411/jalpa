import { clearFirestore, ensureBot, loadEnv } from '../integration/helpers.js'

export default async function globalSetup() {
  loadEnv()
  await ensureBot()
  await clearFirestore()
}
