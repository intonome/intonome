import { describe, test, expect } from 'vitest'
import { evictIndex, holdNotice, toastMs } from './toast.ts'

describe('holdNotice — notices that arrive while the app is hidden', () => {
  test('kept in order, shown on return', () => {
    expect(holdNotice(holdNotice([], { msg: 'a', ms: 1 }), { msg: 'b', ms: 2 }).map(h => h.msg)).toEqual(['a', 'b'])
  })
  test('the same notice twice is one, with the later time', () => {
    expect(holdNotice([{ msg: 'a', ms: 1 }, { msg: 'b', ms: 2 }], { msg: 'a', ms: 9 })).toEqual([{ msg: 'a', ms: 9 }, { msg: 'b', ms: 2 }])
  })
  test('notices with an action (undo) are each kept', () => {
    const f = () => {}, g = () => {}
    expect(holdNotice([{ msg: 'a', ms: 1, action: f }], { msg: 'a', ms: 1, action: g })).toHaveLength(2)
  })
})

describe('evictIndex — which toast goes when there are too many', () => {
  test('oldest one without an action first', () => {
    expect(evictIndex([true, false, false])).toBe(1)
    expect(evictIndex([false, true, true])).toBe(0)
  })
  test('oldest one when all have actions', () => expect(evictIndex([true, true, true])).toBe(0))
  test('empty list', () => expect(evictIndex([])).toBe(-1))
})

describe('toastMs — on screen as long as it takes to read', () => {
  test('a short notice is not held for long, but never under 2 s', () => {
    expect(toastMs('녹음 완료', false)).toBe(2000)
    expect(toastMs('Saved', false)).toBe(2000)
  })
  test('longer text stays longer; Korean, Japanese and Chinese count more per character', () => {
    const ko = toastMs('녹음 시작 · 녹음에 섞이지 않게 메트로놈 소리를 껐어요', false)
    expect(ko).toBeGreaterThan(3000); expect(ko).toBeLessThan(5000)
    expect(toastMs('가나다라마바사아자차', false)).toBeGreaterThan(toastMs('abcdefghij', false))
  })
  test('a plain notice is gone within 5 s however long it is', () => expect(toastMs('가'.repeat(200), false)).toBe(5000))
  test('a notice with an action leaves 5 to 8 s to reach it', () => {
    expect(toastMs('삭제됨 · 실행 취소', true)).toBe(5000)
    expect(toastMs('가'.repeat(200), true)).toBe(8000)
  })
})
