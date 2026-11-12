import { describe, expect, it } from 'vitest'
import { buildSchedule, formatClock, SPEECHES } from '../../shared/format.js'
import {
  ANY_CATEGORY,
  CATEGORIES,
  pickTopic,
  resolveCategory,
} from '../../shared/topics.js'

describe('topics', () => {
  const all = CATEGORIES.flatMap((category) => category.topics)

  it('has eight categories with at least eight resolutions each', () => {
    expect(CATEGORIES).toHaveLength(8)
    for (const category of CATEGORIES) expect(category.topics.length).toBeGreaterThanOrEqual(8)
  })

  it('has unique ids and no duplicate resolutions', () => {
    expect(new Set(all.map((topic) => topic.id)).size).toBe(all.length)
    expect(new Set(all.map((topic) => topic.text)).size).toBe(all.length)
  })

  it('writes every resolution as a sentence with a source', () => {
    for (const topic of all) {
      expect(topic.text).toMatch(/^[A-Z].*\.$/)
      expect(topic.source).toMatch(/^(Lincoln-Douglas|Public Forum), /)
    }
  })

  it('resolves categories between two players', () => {
    expect(resolveCategory('tech', 'tech')).toBe('tech')
    expect(resolveCategory('tech', 'world')).toBeNull()
    expect(resolveCategory(ANY_CATEGORY, 'world')).toBe('world')
    expect(resolveCategory('ethics', ANY_CATEGORY)).toBe('ethics')
    expect(CATEGORIES.map((c) => c.id)).toContain(resolveCategory(ANY_CATEGORY, ANY_CATEGORY))
  })

  it('avoids recently debated topics, then falls back', () => {
    const tech = CATEGORIES.find((category) => category.id === 'tech')
    const allButOne = tech.topics.slice(1).map((topic) => topic.id)
    expect(pickTopic('tech', allButOne).id).toBe(tech.topics[0].id)
    expect(pickTopic('tech', tech.topics.map((topic) => topic.id))).toBeTruthy()
    expect(pickTopic('nope')).toBeNull()
  })
})

describe('format', () => {
  it('alternates sides and gives both equal time', () => {
    const time = { pro: 0, con: 0 }
    SPEECHES.forEach((speech, index) => {
      expect(speech.side).toBe(index % 2 === 0 ? 'pro' : 'con')
      time[speech.side] += speech.seconds
    })
    expect(time.pro).toBe(time.con)
  })

  it('scales timers for tests without hitting zero', () => {
    const fast = buildSchedule(0.01)
    expect(fast.prepSeconds).toBeGreaterThanOrEqual(2)
    expect(fast.leadSeconds).toBeGreaterThanOrEqual(1)
    for (const speech of fast.speeches) expect(speech.seconds).toBeGreaterThanOrEqual(2)
    expect(buildSchedule().speeches[0].seconds).toBe(120)
  })

  it('formats clocks', () => {
    expect(formatClock(120)).toBe('2:00')
    expect(formatClock(59.2)).toBe('1:00')
    expect(formatClock(-3)).toBe('0:00')
  })
})
