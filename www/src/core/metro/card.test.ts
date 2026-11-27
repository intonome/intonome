import { describe, test, expect } from 'vitest'
import { stageOf, stageChange, sizeBtnTarget, dragTarget, dragProgress, dragCommits, stepCommits } from './card.ts'

describe('metronome card stages', () => {
  test('the stage shown comes from the stored values - full wins over collapsed', () => {
    expect(stageOf(true, false)).toBe('c')
    expect(stageOf(false, false)).toBe('e')
    expect(stageOf(true, true)).toBe('f')
  })
  test('size button: full → expanded; otherwise it toggles collapsed ⇄ expanded', () => {
    expect(sizeBtnTarget('f')).toBe('e')
    expect(sizeBtnTarget('c')).toBe('e'); expect(sizeBtnTarget('e')).toBe('c')
  })
  test('stored values for each stage', () => {
    expect(stageChange('f')).toEqual({ full: true })
    expect(stageChange('e')).toEqual({ full: false, collapsed: false })
    expect(stageChange('c')).toEqual({ collapsed: true })
  })
})

describe('dragging the card', () => {
  test('up goes c → e → f, down the reverse; nothing past the ends', () => {
    expect(dragTarget('c', -1)).toBe('e'); expect(dragTarget('e', -1)).toBe('f'); expect(dragTarget('f', -1)).toBe(null)
    expect(dragTarget('f', 1)).toBe('e'); expect(dragTarget('e', 1)).toBe('c'); expect(dragTarget('c', 1)).toBe(null)
  })
  test('height follows the finger between the two stage heights', () => {
    expect(dragProgress(100, 300, -50)).toEqual({ h: 150, p: 0.25 })
    expect(dragProgress(100, 300, -500)).toEqual({ h: 300, p: 1 })
    expect(dragProgress(100, 300, 40)).toEqual({ h: 100, p: 0 })
    expect(dragProgress(300, 100, 100)).toEqual({ h: 200, p: 0.5 })
  })
  test('commit when dragged 30 % or flicked that way after moving a little', () => {
    expect(dragCommits(0.3, 0, -1)).toBe(true); expect(dragCommits(0.29, 0, -1)).toBe(false)
    expect(dragCommits(0.05, -0.5, -1)).toBe(true); expect(dragCommits(0.02, -0.5, -1)).toBe(false)
    expect(dragCommits(0.05, 0.5, -1)).toBe(false)
  })
  test('without live drag, 40 px that way is one stage', () => {
    expect(stepCommits(-40, -1)).toBe(true); expect(stepCommits(-39, -1)).toBe(false); expect(stepCommits(40, -1)).toBe(false)
  })
})
