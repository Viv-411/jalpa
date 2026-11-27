// Small building blocks shared across pages.

export function Logo({ withWord = true }) {
  return (
    <span className="logo">
      <svg className="logo__mark" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M14.5 3a13 13 0 0 0 0 26z" fill="var(--pro)" />
        <path d="M17.5 3a13 13 0 0 1 0 26z" fill="var(--con)" />
      </svg>
      {withWord && <span className="logo__word">Jalpa</span>}
    </span>
  )
}

export function Avatar({ name, side, size = 'md' }) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span className={`avatar avatar--${size}${side ? ` avatar--${side}` : ''}`} aria-hidden="true">
      {initial}
    </span>
  )
}

export function SideTag({ side }) {
  return <span className={`side-tag side-tag--${side}`}>{side === 'pro' ? 'Pro' : 'Con'}</span>
}

export function Spinner({ label }) {
  return (
    <span className="spinner" role="status">
      <span className="spinner__ring" aria-hidden="true" />
      {label && <span className="spinner__label">{label}</span>}
    </span>
  )
}

// The resolution being debated, with where it came from.
export function Resolution({ debate, compact = false }) {
  return (
    <section className={`resolution${compact ? ' resolution--compact' : ''}`} aria-label="Resolution">
      <p className="resolution__meta">
        <span className="resolution__category">{debate.categoryName}.</span>{' '}
        <span className="resolution__source">{debate.topicSource}</span>
      </p>
      <p className="resolution__text">{debate.topic}</p>
    </section>
  )
}
