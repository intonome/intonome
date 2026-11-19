import { describe, test, expect } from 'vitest'
import { beatCount, beatDurS, ticksPerBeat, isBeatStart, sweepX, lightKind, flashDurS, FLASH_FACE_S, FLASH_RING_S } from './sweep.ts'
import { tickKind } from './sequencer.ts'

/** 세이코식: 끝에서 박, 사이에서 분할, 박마다 방향 반전. 소리(sequencer)와 같은 틱 격자를 써야 한다. */
describe('Seiko-style beat display', () => {
  test('main beats — two in 6/8, one in beats-only mode', () => {
    expect(beatCount({ timeSig: 4 })).toBe(4)
    expect(beatCount({ timeSig: 6 })).toBe(2)
    expect(beatCount({ timeSig: 1 })).toBe(1)
  })
  test('beat length — the tempo number is always the beat, in 6/8 the dotted quarter', () => {
    expect(beatDurS({ bpm: 60, timeSig: 4, subDiv: 1 })).toBeCloseTo(1)
    expect(beatDurS({ bpm: 120, timeSig: 3, subDiv: 2 })).toBeCloseTo(0.5)
    expect(beatDurS({ bpm: 60, timeSig: 6, subDiv: 1 })).toBeCloseTo(1) // ♩. = 60 → 한 박 1 s, 8분음표 3 개
  })
  test('ticks per beat and beat numbers match the sequencer grid', () => {
    expect(ticksPerBeat({ timeSig: 4, subDiv: 3 })).toBe(3)
    expect(ticksPerBeat({ timeSig: 4, subDiv: 'd' })).toBe(2)
    expect(ticksPerBeat({ timeSig: 6, subDiv: 1 })).toBe(3)
  })
  test('the bar reaches an end only on the first tick of a main beat', () => {
    expect([0, 1, 2, 3, 4, 5].map(t => isBeatStart({ timeSig: 6, subDiv: 1 }, t))).toEqual([true, false, false, true, false, false])
    expect([0, 1, 2, 3].map(t => isBeatStart({ timeSig: 4, subDiv: 1 }, t))).toEqual([true, true, true, true])
  })
  test('bar position — left→right / right→left, waits at the end if the next beat is late', () => {
    expect(sweepX(0, 1)).toBe(0); expect(sweepX(0.5, 1)).toBe(0.5); expect(sweepX(1, 1)).toBe(1)
    expect(sweepX(0, -1)).toBe(1); expect(sweepX(0.25, -1)).toBe(0.75); expect(sweepX(1, -1)).toBe(0)
    expect(sweepX(1.4, 1)).toBe(1); expect(sweepX(-0.1, -1)).toBe(1)
  })
})

/** 점·카드 번쩍임의 박 종류 — 소리와 같되, 박자표 없음은 매 박이 첫 박처럼 보인다 */
describe('what the dots and the card flash show', () => {
  test('with a time signature it is the sound: the first beat of a bar, the other beats, subdivisions', () => {
    const p = { timeSig: 4 as const, subDiv: 2 as const }
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(t => lightKind(p, t))).toEqual(['accent', 'sub', 'beat', 'sub', 'beat', 'sub', 'beat', 'sub'])
    const q = { timeSig: 6 as const, subDiv: 1 as const }
    expect([0, 1, 2, 3, 4, 5].map(t => lightKind(q, t))).toEqual([0, 1, 2, 3, 4, 5].map(t => tickKind(q, t)))
  })
  test('with no time signature every beat looks like a first beat (there is no bar); subdivisions stay subdivisions and the sound is unchanged', () => {
    const p = { timeSig: 1 as const, subDiv: 2 as const }
    expect([0, 1, 2, 3].map(t => lightKind(p, t))).toEqual(['accent', 'sub', 'accent', 'sub'])
    expect([0, 1, 2, 3].map(t => tickKind(p, t))).toEqual(['beat', 'sub', 'beat', 'sub'])
  })
  test('the flash lasts its full length unless the next flash comes sooner — never more than 60 % of the gap', () => {
    expect(flashDurS({ bpm: 80, timeSig: 4, subDiv: 1 }, FLASH_RING_S)).toBe(FLASH_RING_S) // 한 마디 3 s
    expect(flashDurS({ bpm: 200, timeSig: 2, subDiv: 1 }, FLASH_RING_S)).toBeCloseTo(0.36) // 2/4 마디 0.6 s × 60 %
    expect(flashDurS({ bpm: 200, timeSig: 1, subDiv: 1 }, FLASH_RING_S)).toBeCloseTo(0.18) // 박자표 없음은 매 박 0.3 s
    expect(flashDurS({ bpm: 120, timeSig: 1, subDiv: 1 }, FLASH_FACE_S)).toBe(FLASH_FACE_S)
    expect(flashDurS({ bpm: 60, timeSig: 6, subDiv: 1 }, FLASH_RING_S)).toBe(FLASH_RING_S) // 6/8 ♩.=60 → 마디 2 s
  })
})
