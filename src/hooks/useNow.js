import { useEffect, useState } from 'react'
import { serverNow } from '../lib/api'

// Re-renders on an interval and returns the current server time.
export function useNow(intervalMs = 250, enabled = true) {
  const [now, setNow] = useState(() => serverNow())
  useEffect(() => {
    if (!enabled) return undefined
    setNow(serverNow())
    const timer = setInterval(() => setNow(serverNow()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, enabled])
  return now
}
