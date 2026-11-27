import { describe, test, expect } from 'vitest'
import { fitScale, fitWidth, isPaneWindow, FIT_MIN_W, FIT_MIN_H, FIT_MAX, PANE_FIT_W, PANE_FIT_H, PANE_MIN_W } from './fit.ts'

describe('fitScale — how much a large window is magnified', () => {
  test('phones are left alone, in either dimension', () => {
    for (const [w, h] of [[320, 568], [360, 780], [390, 844], [412, 915], [430, 932], [480, 1000]] as [number, number][]) expect(fitScale(w, h)).toBe(1)
  })
  test('a tall tablet grows until the layout is as narrow as a large phone', () => {
    expect(fitWidth(800, 1400)).toBe(FIT_MIN_W); expect(fitScale(600, 1000)).toBeCloseTo(1.25, 5)
  })
  test('a near-square foldable grows only as far as its height allows; the rest of the width stays as layout width', () => {
    const z = fitScale(750, 832); expect(z).toBeCloseTo(832 / FIT_MIN_H, 5); expect(fitWidth(750, 832)).toBeGreaterThan(600)
  })
  test('a landscape tablet grows until the two panes are as small as they may get', () => {
    expect(fitScale(1280, 800)).toBeCloseTo(800 / PANE_FIT_H, 5); expect(fitScale(1366, 1024)).toBeCloseTo(1366 / PANE_FIT_W, 5); expect(fitScale(900, 700)).toBe(1)
  })
  test('never more than the maximum, never less than 1, and a short split-screen window is not magnified', () => {
    expect(fitScale(2000, 3000)).toBe(FIT_MAX); expect(fitScale(1280, 380)).toBe(1); expect(fitScale(420, 400)).toBe(1); expect(fitScale(0, 0)).toBe(1); expect(fitScale(NaN, 800)).toBe(1)
  })
  test('continuous: one more dp of width or height never jumps the scale', () => {
    for (let w = 300; w < 1500; w += 7) for (let h = 300; h < 1500; h += 11) {
      if (isPaneWindow(w + 1, h) !== isPaneWindow(w, h) || isPaneWindow(w, h + 1) !== isPaneWindow(w, h)) continue // 한 칸 ⇄ 두 칸으로 넘어가는 자리는 배치가 바뀌는 곳이라 배율도 바뀐다
      expect(Math.abs(fitScale(w + 1, h) - fitScale(w, h))).toBeLessThan(0.005); expect(Math.abs(fitScale(w, h + 1) - fitScale(w, h))).toBeLessThan(0.005)
    }
  })
  test('the magnified layout is never narrower or shorter than the minimum', () => {
    for (let w = 480; w < 1500; w += 13) for (let h = FIT_MIN_H; h < 1500; h += 17) {
      if (isPaneWindow(w, h)) continue
      const z = fitScale(w, h); expect(w / z).toBeGreaterThanOrEqual(FIT_MIN_W - 1e-6); expect(h / z).toBeGreaterThanOrEqual(FIT_MIN_H - 1e-6)
    }
  })
  test('two panes: wide and tall enough for the metronome pane; the window keeps being one after it is magnified', () => {
    expect(isPaneWindow(1280, 800)).toBe(true); expect(isPaneWindow(1024, 768)).toBe(true)
    expect(isPaneWindow(750, 832)).toBe(false); expect(isPaneWindow(800, 1280)).toBe(false) // 펼친 폴드 · 세로 태블릿
    expect(isPaneWindow(844, 390)).toBe(false); expect(isPaneWindow(1280, 380)).toBe(false); expect(isPaneWindow(1000, 600)).toBe(false) // 가로로 돌린 폰 · 낮은 분할 창 · 낮은 가로 창
    for (let w = PANE_MIN_W; w < 2600; w += 13) for (let h = PANE_FIT_H; h < 1700; h += 17) {
      if (!isPaneWindow(w, h)) continue
      const z = fitScale(w, h); expect(w / z).toBeGreaterThanOrEqual(PANE_MIN_W - 1e-6); expect(h / z).toBeGreaterThanOrEqual(PANE_FIT_H - 1e-6)
    }
  })
})
