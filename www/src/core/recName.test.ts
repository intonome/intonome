import { describe, expect, test } from 'vitest'
import { uniqueName } from './recName.ts'

describe('uniqueName', () => {
  test('a free name stays as is', () => { expect(uniqueName('Lesson', new Set(['Other']), 40)).toBe('Lesson') })
  test('a taken name gets (2), then (3)', () => {
    expect(uniqueName('Lesson', new Set(['Lesson']), 40)).toBe('Lesson (2)')
    expect(uniqueName('Lesson', new Set(['Lesson', 'Lesson (2)']), 40)).toBe('Lesson (3)')
  })
  test('the suffix fits inside the length limit', () => {
    const r = uniqueName('a'.repeat(40), new Set(['a'.repeat(40)]), 40)
    expect(r).toBe('a'.repeat(36) + ' (2)'); expect(r.length).toBe(40)
  })
  test('the shown name of another recording counts as taken (11/8 01:07)', () => {
    expect(uniqueName('11/8 01:07', new Set(['20261108_0107', '11/8 01:07']), 40)).toBe('11/8 01:07 (2)')
  })
})
