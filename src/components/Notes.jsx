import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'

function read(key) {
  try {
    return sessionStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

// Private scratch paper for the round. Stays on this device.
export default function Notes({ debateId }) {
  const key = `jalpa-notes-${debateId}`
  const [text, setText] = useState(() => read(key))

  useEffect(() => {
    try {
      sessionStorage.setItem(key, text)
    } catch {
      // Storage is unavailable (private window); notes just won't survive a reload.
    }
  }, [key, text])

  return (
    <aside className="notes">
      <div className="notes__head">
        <label htmlFor="round-notes" className="notes__title">
          Your notes
        </label>
        <span className="notes__hint">
          <Lock size={12} strokeWidth={2.5} aria-hidden="true" />
          Only you can see these
        </span>
      </div>
      <textarea
        id="round-notes"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={'Your case, their arguments, what to answer…'}
        spellCheck="false"
      />
    </aside>
  )
}
