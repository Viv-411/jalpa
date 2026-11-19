import { describe, expect, it } from 'vitest'
import { applyResult, eloDelta, expectedScore, matchWindow } from '../../shared/elo.js'

describe('elo', () => {
  it('gives even players a 50% expectation and a 16 point swing', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5)
    expect(eloDelta(1000, 1000)).toBe(16)
  })

  it('rewards upsets more than expected wins', () => {
    const upset = eloDelta(1000, 1400)
    const expected = eloDelta(1400, 1000)
    expect(upset).toBeGreaterThan(25)
    expect(expected).toBeLessThan(6)
    expect(expected).toBeGreaterThanOrEqual(1)
  })

  it('is zero-sum', () => {
    const result = applyResult(1210, 1090)
    expect(result.winnerAfter - 1210).toBe(1090 - result.loserAfter)
    expect(result.winnerChange).toBe(-result.loserChange)
  })

  it('never drops a rating below the floor', () => {
    const result = applyResult(100, 105)
    expect(result.loserAfter).toBe(100)
    expect(result.loserChange).toBe(-5)
  })

  it('widens the matchmaking window as players wait', () => {
    expect(matchWindow(0)).toBe(150)
    expect(matchWindow(10)).toBe(650)
    expect(matchWindow(30)).toBe(Infinity)
  })
})
