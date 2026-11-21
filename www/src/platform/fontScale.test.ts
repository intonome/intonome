import { describe, test, expect } from 'vitest'
import { fontScaleFor, FONT_SCALE_MAX, FONT_SCALE_MIN } from './index.ts'

describe('fontScaleFor — Android system font size into the app type scale', () => {
  test('default stays at 1, and a smaller system size does not shrink the app', () => { expect(fontScaleFor(1)).toBe(1); expect(fontScaleFor(0.9)).toBe(1); expect(fontScaleFor(0.5)).toBe(1); expect(FONT_SCALE_MIN).toBe(1) })
  test('larger sizes grow the text, up to 1.3', () => { expect(fontScaleFor(1.15)).toBe(1.15); expect(fontScaleFor(2)).toBe(FONT_SCALE_MAX) })
  test('a bad value is ignored', () => { expect(fontScaleFor(NaN)).toBe(1); expect(fontScaleFor(0)).toBe(1) })
})
