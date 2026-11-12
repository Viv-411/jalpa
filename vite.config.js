import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Serves the Vercel functions in ./api during `npm run dev`, so the whole app
// runs locally with one command.
function localApi() {
  return {
    name: 'jalpa-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([a-z]+)(?:\?.*)?$/)
        if (!match) return next()

        res.status = (code) => {
          res.statusCode = code
          return res
        }
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
          return res
        }

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const raw = Buffer.concat(chunks).toString('utf8')
          req.body = raw ? JSON.parse(raw) : {}
          const mod = await server.ssrLoadModule(`/api/${match[1]}.js`)
          await mod.default(req, res)
        } catch (err) {
          console.error('[local api]', err)
          res.status(500).json({ error: 'Local API error. Check the terminal.' })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Make .env.local visible to the API functions as well as the browser build.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
  return {
    plugins: [react(), localApi()],
    test: { exclude: ['tests/e2e/**', 'node_modules/**', '.tools/**'] },
  }
})
