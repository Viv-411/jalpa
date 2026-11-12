// Standard Elo rating. Zero-sum: the winner gains exactly what the loser drops.

export const STARTING_ELO = 1000
export const K_FACTOR = 32
export const ELO_FLOOR = 100

export function expectedScore(rating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400))
}

// Points transferred from loser to winner. Always at least 1.
export function eloDelta(winnerRating, loserRating, k = K_FACTOR) {
  const delta = Math.round(k * (1 - expectedScore(winnerRating, loserRating)))
  return Math.max(1, delta)
}

export function applyResult(winnerRating, loserRating) {
  const delta = eloDelta(winnerRating, loserRating)
  const loserAfter = Math.max(ELO_FLOOR, loserRating - delta)
  return {
    delta,
    winnerAfter: winnerRating + delta,
    loserAfter,
    winnerChange: delta,
    loserChange: loserAfter - loserRating,
  }
}

// Rating gap two players may be matched across, widening the longer they wait.
export function matchWindow(waitedSeconds) {
  if (waitedSeconds >= 30) return Infinity
  return 150 + 50 * Math.max(0, waitedSeconds)
}
