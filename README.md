# Jalpa

Live one-on-one voice debates on real tournament resolutions, judged by an AI
judge and rated with Elo.

You pick a subject, get matched with someone near your rating, and are handed
a resolution and a side. After a minute of prep you alternate six speeches
over voice. A judge reads the transcript, writes a ballot with scores and
feedback, and both ratings move.

## How a round runs

| Speech | Time |
| --- | --- |
| Pro constructive | 2:00 |
| Con constructive | 2:00 |
| Pro rebuttal | 1:30 |
| Con rebuttal | 1:30 |
| Pro closing | 1:00 |
| Con closing | 1:00 |

Only the current speaker's microphone is open. Either debater can forfeit, and
if one disconnects for 30 seconds the other can claim the win.

The 80 resolutions in `shared/topics.js` are past National Speech & Debate
Association Lincoln-Douglas and Public Forum topics, in eight subject areas.

## How it is built

| Part | Where | What it does |
| --- | --- | --- |
| Web app | `src/` | React + Vite. Reads Firestore live; never writes results. |
| API | `api/`, `server/` | Vercel functions: matchmaking, the debate clock, voice tokens, transcription, judging, ratings. |
| Shared rules | `shared/` | Debate format, Elo maths and topics, used by both sides. |
| Database | Firestore | Locked down by `firestore.rules`. |
| Voice | LiveKit Cloud | One audio room per debate. |
| Judge | Gemini via Firebase AI Logic | Free tier, no separate API key. |

Players can only read their own debates and rename themselves. Everything
that affects a rating is written by the API, which signs in to Firebase as a
dedicated "judge bot" account that `firestore.rules` trusts by UID.

After each speech the speaker's browser uploads the recording; the API
transcribes it and stores the text. When the last speech ends the API sends
all six transcripts to the judge, checks the ballot, and applies the rating
change in one transaction.

## Running it locally

```sh
npm install
npm run dev
```

`npm run dev` serves the web app and the API functions together. It needs a
`.env.local` with:

```
VITE_FIREBASE_API_KEY=            # Firebase web app config
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_LIVEKIT_URL=                 # wss://<project>.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
JUDGE_BOT_EMAIL=                  # the Firebase account the API signs in as
JUDGE_BOT_PASSWORD=
```

To try a debate by yourself, sign in as two different accounts in two browser
windows (one of them private) and search for a debate in both.

## Tests

```sh
npm test                  # unit tests: Elo, format, flow, matchmaking, ballots
npm run test:integration  # API functions + security rules on Firebase emulators
npm run test:e2e          # two real browsers play a full debate
npm run test:all
```

The emulator tests need Java. If it isn't installed, unpack a JRE into
`.tools/` and the test script will find it. They use a stand-in judge and
shortened timers, and never touch the live project.

Two scripts exercise the real services (they use a little free Gemini quota):

```sh
node scripts/check-ai.mjs tests/fixtures/pro.webm tests/fixtures/con.mp4
node scripts/smoke.mjs https://jalpadebate.vercel.app tests/fixtures/pro.webm tests/fixtures/con.mp4
```

`smoke.mjs` plays a whole debate with two throwaway accounts and deletes them
afterwards.

## Deploying

- **Web app and API:** pushing to `main` deploys to Vercel. The Vercel project
  needs every variable listed above.
- **Database rules and indexes:** `npm run deploy:rules`.

If the judge bot account is ever recreated, put its new UID in
`firestore.rules` and redeploy the rules.

## Settings

Optional environment variables for the API:

| Variable | Purpose |
| --- | --- |
| `JALPA_JUDGE_MODELS` | Comma-separated Gemini models for judging, tried in order. |
| `JALPA_TRANSCRIBE_MODELS` | Same, for transcription. |
| `JALPA_TIME_SCALE`, `JALPA_PREP_SECONDS` | Shorten timers (tests only). |
| `JALPA_MOCK_AI`, `JALPA_EMULATORS` | Stand-in judge and local emulators (tests only). |
