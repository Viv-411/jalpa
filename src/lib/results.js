// Describes a debate from one debater's point of view.

export function opponentOf(debate, uid) {
  return debate.players.find((player) => player !== uid)
}

export function outcomeFor(debate, uid) {
  if (debate.status === 'abandoned') return { kind: 'void', label: 'Abandoned', change: 0 }
  if (debate.status !== 'complete') return { kind: 'open', label: 'In progress', change: 0 }
  const result = debate.result ?? {}
  const change = result.elo?.[uid]?.change ?? 0
  if (!result.winner) return { kind: 'void', label: 'No contest', change }
  return result.winner === uid
    ? { kind: 'won', label: 'Won', change }
    : { kind: 'lost', label: 'Lost', change }
}

export function signed(change) {
  if (change > 0) return `+${change}`
  if (change < 0) return `−${Math.abs(change)}`
  return '0'
}

// One sentence on how the debate was decided.
export function reasonText(debate, uid) {
  const result = debate.result ?? {}
  const won = result.winner === uid
  const opponent = debate.names?.[opponentOf(debate, uid)] ?? 'Your opponent'
  switch (result.reason) {
    case 'decision':
      return won ? 'The judge voted for you.' : `The judge voted for ${opponent}.`
    case 'forfeit':
      return won ? `${opponent} forfeited.` : 'You forfeited.'
    case 'disconnect':
      return won ? `${opponent} disconnected and didn’t come back.` : 'You disconnected and the round was awarded to your opponent.'
    case 'no_show':
      return won ? `${opponent} didn’t give any speeches.` : 'The judge didn’t hear any speeches from you.'
    case 'no_contest':
      return 'Neither debater gave a speech, so there was nothing to judge. Ratings didn’t change.'
    case 'judge_unavailable':
      return 'The judge couldn’t be reached, so this round doesn’t count. Ratings didn’t change.'
    default:
      return ''
  }
}

export function shortDate(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
