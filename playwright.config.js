import { defineConfig } from '@playwright/test'

// End-to-end tests: two real browsers debate each other against the Firebase
// emulators, with a stand-in judge. Run with `npm run test:e2e`.
const PORT = 5199

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.js',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_USE_EMULATORS: '1',
      JALPA_EMULATORS: '1',
      JALPA_MOCK_AI: '1',
      JALPA_TIME_SCALE: '0.1',
      JALPA_PREP_SECONDS: '25',
      JALPA_TRANSCRIPT_GRACE_MS: '4000',
    },
  },
})
