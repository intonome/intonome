// 벤치마크 하네스 자체 검증
import { describe, test, expect } from 'vitest'
import { harmonicRel } from './metrics.mjs'

describe('metrics — harmonic relation check', () => {
  test('normal errors aren’t harmonic relations', () => {
    expect(harmonicRel(440, 440)).toBe(null)
    expect(harmonicRel(445, 440)).toBe(null)      // +20 ¢
    expect(harmonicRel(415.3, 440)).toBe(null)    // −100 ¢ (이웃 반음) — 배음 아님
    expect(harmonicRel(391.99, 440)).toBe(null)   // −200 ¢
  })
  test('octave errors (both directions)', () => {
    expect(harmonicRel(220, 440)).toBe('÷2')
    expect(harmonicRel(880, 440)).toBe('×2')
  })
  test('what the old harness missed', () => {
    expect(harmonicRel(110, 440)).toBe('÷4')      // 2옥타브
    expect(harmonicRel(440 / 3, 440)).toBe('÷3')  // 옥타브+5도
    expect(harmonicRel(440 / 5, 440)).toBe('÷5')
    expect(harmonicRel(440 * 3, 440)).toBe('×3')
  })
  test('fifths in double stops', () => {
    expect(harmonicRel(660, 440)).toBe('×3/2')
    expect(harmonicRel(440 * 2 / 3, 440)).toBe('÷3/2')
  })
  test('boundary: inside the tolerance is harmonic, outside isn’t', () => {
    expect(harmonicRel(220 * Math.pow(2, 49 / 1200), 440)).toBe('÷2')   // +49 ¢
    expect(harmonicRel(220 * Math.pow(2, 51 / 1200), 440)).toBe(null)   // +51 ¢
  })
  test('invalid input', () => {
    expect(harmonicRel(-1, 440)).toBe(null)
    expect(harmonicRel(440, 0)).toBe(null)
  })
})
