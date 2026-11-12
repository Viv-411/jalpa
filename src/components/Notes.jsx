import { useEffect, useState } from 'react'

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
      <label htmlFor="round-notes">Your notes</label>
      <p className="notes__hint">Only you can see these. The judge doesn&rsquo;t read them.</p>
      <textarea
        id="round-notes"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Jot down your case and what your opponent says…"
        spellCheck="false"
      />
    </aside>
  )
}
