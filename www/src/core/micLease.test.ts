import { describe, test, expect } from 'vitest'
import { release, onHide, type HideNow } from './micLease.ts'

const idle: HideNow = { micOpen: true, opening: false, recording: false, native: false, metroPlaying: false }

describe('letting go of the mic for a while (hidden screen, editor)', () => {
  test('an open mic is closed, one that is still opening is cancelled, a recording keeps it', () => {
    expect(release({ micOpen: true, opening: false, recording: false })).toBe('close')
    expect(release({ micOpen: false, opening: true, recording: false })).toBe('cancel')
    expect(release({ micOpen: true, opening: false, recording: true })).toBe('keep')
    expect(release({ micOpen: false, opening: false, recording: false })).toBe('keep')
  })
})

describe('the screen goes to the background', () => {
  test('nothing sounding: the mic is let go', () => {
    expect(onHide(idle)).toEqual({ stopRec: false, stopMetro: false, release: 'close' })
  })
  test('the metronome is stopped and the mic let go', () => {
    expect(onHide({ ...idle, metroPlaying: true })).toEqual({ stopRec: false, stopMetro: true, release: 'close' })
  })
  test('on the web a recording keeps the mic (a recording must not break)', () => {
    expect(onHide({ ...idle, recording: true })).toEqual({ stopRec: false, stopMetro: false, release: 'keep' })
  })
  test('in the Android app a recording is saved first, then the mic is let go (the recorder says how the save went)', () => {
    expect(onHide({ ...idle, native: true, recording: true, metroPlaying: true }))
      .toEqual({ stopRec: true, stopMetro: true, release: 'close' })
  })
  test('hidden while the mic is still opening: the opening is cancelled', () => {
    expect(onHide({ ...idle, micOpen: false, opening: true }).release).toBe('cancel')
  })
})
