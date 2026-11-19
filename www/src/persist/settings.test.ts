import { describe, test, expect } from 'vitest'
import { parseStored, firstRunLang } from './settings.ts'
import { RMS_LEVELS, SMOOTH_LEVELS } from '../state/index.ts'

describe('parseStored', () => {
  test('empty / broken → {}', () => { expect(parseStored(null)).toEqual({}); expect(parseStored('{oops')).toEqual({}); expect(parseStored('"x"')).toEqual({}) })
  test('only the current format (v: 3) is read; records from 2.4.x and earlier are ignored (the defaults apply)', () => {
    expect(parseStored(JSON.stringify({ cents: 10, rms: .005, smooth: .05, bpm: 120, timeSig: 3, subDiv: 'd', refHz: 415, vol: .5, savedAt: 0 }))).toEqual({})
    expect(parseStored(JSON.stringify({ v: 2, tolCents: 5, rmsMin: RMS_LEVELS[1], bpm: 60, timeSig: 6, subDiv: 1, refHz: 442, metroVol: 1 }))).toEqual({})
  })
  test('current sensitivity values pass through; others are ignored', () => {
    for (const v of RMS_LEVELS) expect(parseStored(JSON.stringify({ v: 3, rmsMin: v })).rmsMin).toBe(v)
    expect(parseStored(JSON.stringify({ v: 3, rmsMin: .014 }))).toEqual({})
  })
  test('v3 response speed passes through; unknown values are ignored', () => {
    for (const v of SMOOTH_LEVELS) expect(parseStored(JSON.stringify({ v: 3, smoothing: v })).smoothing).toBe(v)
    expect(parseStored(JSON.stringify({ v: 3, smoothing: .5 }))).toEqual({})
  })
  test('v3 round trip', () => {
    const v3 = { v: 3, tolCents: 5, rmsMin: RMS_LEVELS[1], smoothing: SMOOTH_LEVELS[2], wakeLock: true, bpm: 60, timeSig: 6, subDiv: 1, refHz: 442, metroVol: 1 }
    const { v, wakeLock, ...rest } = v3 // 옛 저장값의 wakeLock 은 읽지 않는다(설정 없음, 늘 켬)
    expect(parseStored(JSON.stringify(v3))).toEqual(rest)
  })
  test('tolerance: 5/10/15 pass; 20 and 25 from older versions are ignored (the default ±10 applies)', () => {
    for (const v of [5, 10, 15]) expect(parseStored(JSON.stringify({ v: 3, tolCents: v })).tolCents).toBe(v)
    for (const v of [20, 25, 12, '10']) expect(parseStored(JSON.stringify({ v: 3, tolCents: v }))).toEqual({})
  })
  test('bad timeSig is ignored', () => expect(parseStored(JSON.stringify({ v: 3, timeSig: 5 }))).toEqual({}))
  test('theme: only dark/light pass, anything else is ignored (the default applies)', () => {
    expect(parseStored(JSON.stringify({ v: 3, theme: 'light' })).theme).toBe('light')
    expect(parseStored(JSON.stringify({ v: 3, theme: 'dark' })).theme).toBe('dark')
    expect(parseStored(JSON.stringify({ v: 3, theme: 'auto' }))).toEqual({})
  })
  test('language: only ko/en pass, anything else is ignored (the first-run language applies)', () => {
    expect(parseStored(JSON.stringify({ v: 3, lang: 'en' })).lang).toBe('en')
    expect(parseStored(JSON.stringify({ v: 3, lang: 'ko' })).lang).toBe('ko')
    expect(parseStored(JSON.stringify({ v: 3, lang: 'fr' }))).toEqual({})
  })
  test('Play A octave: only 2/3/4 pass (A2 double bass, A3 cello, A4 violin/viola), anything else keeps A4', () => {
    for (const v of [2, 3, 4] as const) expect(parseStored(JSON.stringify({ v: 3, aOctave: v })).aOctave).toBe(v)
    for (const v of [1, 5, '3', null, 3.5]) expect(parseStored(JSON.stringify({ v: 3, aOctave: v }))).toEqual({})
  })
})

describe('parseStored hardening', () => {
  test('bpm clamped and rounded', () => {
    // 범위 밖 저장값은 CFG.metro 범위로 끌어들인다
    expect(parseStored(JSON.stringify({ v: 3, bpm: -5 })).bpm).toBe(40)
    expect(parseStored(JSON.stringify({ v: 3, bpm: 999 })).bpm).toBe(200)
    expect(parseStored(JSON.stringify({ v: 3, bpm: 20 })).bpm).toBe(40) // 옛 범위(20~220)로 저장된 값도 새 범위로 끌어들인다
    expect(parseStored(JSON.stringify({ v: 3, bpm: 220 })).bpm).toBe(200)
    expect(parseStored(JSON.stringify({ v: 3, bpm: 80.6 })).bpm).toBe(81)
    expect(parseStored(JSON.stringify({ v: 3, bpm: 'x' })).bpm).toBeUndefined()
  })
  // 6/8 은 세분이 없다
  test('6/8 normalizes subDiv to 1', () => {
    expect(parseStored(JSON.stringify({ v: 3, timeSig: 6, subDiv: 'd' }))).toMatchObject({ timeSig: 6, subDiv: 1 })
    expect(parseStored(JSON.stringify({ v: 3, timeSig: 6, subDiv: 2 }))).toMatchObject({ timeSig: 6, subDiv: 1 })
    expect(parseStored(JSON.stringify({ v: 3, timeSig: 4, subDiv: 3 }))).toMatchObject({ timeSig: 4, subDiv: 3 })
  })
})

describe('first run language (nothing saved yet)', () => {
  test('follows the phone: Korean, Japanese or Chinese first → that language, anything else → English', () => {
    expect(firstRunLang(['ko-KR', 'en-US'], 'ko-KR')).toBe('ko')
    expect(firstRunLang(['ko'], 'ko')).toBe('ko')
    expect(firstRunLang(['ja-JP'], 'ja-JP')).toBe('ja')
    expect(firstRunLang(['zh-CN', 'en'], 'zh-CN')).toBe('zh-Hans')
    expect(firstRunLang(['zh'], 'zh')).toBe('zh-Hans')
    expect(firstRunLang(['zh-SG'], 'zh-SG')).toBe('zh-Hans')
    expect(firstRunLang(['zh-Hant-TW'], 'zh-TW')).toBe('zh-Hant')
    expect(firstRunLang(['zh-TW'], 'zh-TW')).toBe('zh-Hant')
    expect(firstRunLang(['zh-HK'], 'zh-HK')).toBe('zh-Hant')
    expect(firstRunLang(['zh-Hant'], 'zh-Hant')).toBe('zh-Hant')
    expect(firstRunLang(['es-MX', 'en'], 'es-MX')).toBe('es')
    expect(firstRunLang(['es'], 'es')).toBe('es')
    expect(firstRunLang(['et-EE'], 'et-EE')).toBe('en') // 에스토니아어 — 겉보기만 es
    expect(firstRunLang(['jа'], 'jа')).toBe('en') // 키릴 'а' — 겉보기만 ja
    expect(firstRunLang(undefined, 'ko-KR')).toBe('ko')
    expect(firstRunLang(['en-US', 'ko-KR'], 'en-US'), 'the first language decides').toBe('en')
    expect(firstRunLang(['kok-IN'], 'kok-IN'), 'Konkani is not Korean').toBe('en')
    expect(firstRunLang([], '')).toBe('en')
    expect(firstRunLang(undefined, undefined)).toBe('en')
  })
})
