import { describe, test, expect } from 'vitest'
import { createSpectrum } from './spectrum.ts'
import { createYinFast } from './yinFast.ts'
import { createAnalyzer } from './analyzer.ts'

const sr = 44100, N = 4096
const tone = (f: number, harm = 1, amp = (h: number) => 1 / h) => Float32Array.from({ length: N }, (_, i) => { let s = 0; for (let h = 1; h <= harm; h++) s += amp(h) * Math.sin(2 * Math.PI * f * h * i / sr); return 0.3 * s })
let seed = 3; const noise = Float32Array.from({ length: N }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; return 0.3 * (seed / 0x80000000 - 1) })

describe('spectrum', () => {
  const sp = createSpectrum(N)
  test('harmonic count: 6-harmonic tone ≥ 5, sine = 1, noise ≈ 0', () => {
    sp.update(tone(220, 6), sr); expect(sp.harmonicCount(220)).toBeGreaterThanOrEqual(5)
    sp.update(tone(440, 1), sr); expect(sp.harmonicCount(440)).toBe(1)
    sp.update(noise, sr); expect(sp.harmonicCount(440)).toBeLessThanOrEqual(1)
  })
  test('flatness: tone low, noise high', () => {
    sp.update(tone(220, 6), sr); const ft = sp.flatness()
    sp.update(noise, sr); const fn = sp.flatness()
    expect(ft).toBeLessThan(0.1); expect(fn).toBeGreaterThan(0.3)
  })
  test('rivalMargin: how strong another note is next to the shown one — its own partials against the shown note\'s own', () => {
    const sum = (...xs: Float32Array[]) => Float32Array.from(xs[0]!, (_, i) => xs.reduce((v, x) => v + x[i]!, 0)), at = (x: Float32Array, g: number) => x.map(v => v * g)
    const A4 = tone(440, 8), A3 = tone(220, 8), D4 = tone(293.66, 8)
    // 라4 만 울린다: 없는 음은 어느 간격이든 훨씬 약하다 — 반음 옆(피크가 두 빈 안)도 라4 의 피크를 제 것으로 세지 않는다
    sp.update(D4, sr); expect(sp.rivalMargin(277.18, 293.66)).toBeLessThan(-20); expect(sp.rivalMargin(311.13, 293.66)).toBeLessThan(-20)
    sp.update(A4, sr); for (const f of [220, 146.83, 293.66, 329.63, 392, 466.16, 659.26]) expect(sp.rivalMargin(f, 440), `${f} Hz`).toBeLessThan(-20)
    // 한 옥타브 아래: 라4 의 배음은 전부 라3 의 배음이라 라4 전체와 견준다. 같은 세기면 약하지 않고, 20 dB 아래면 약하다
    sp.update(sum(A4, A3), sr); expect(sp.rivalMargin(220, 440)).toBeGreaterThan(-8)
    sp.update(sum(A4, at(A3, 0.1)), sr); expect(sp.rivalMargin(220, 440)).toBeLessThan(-8)
    // 5도 아래: 서로에게만 있는 배음끼리
    sp.update(sum(A4, D4), sr); expect(Math.abs(sp.rivalMargin(293.66, 440))).toBeLessThan(6)
    sp.update(sum(A4, at(D4, 0.1)), sr); expect(sp.rivalMargin(293.66, 440)).toBeLessThan(-8)
    // 화면의 음이 멎었으면(그 음만의 자리가 비었다) 새 음은 약하지 않다
    sp.update(D4, sr); expect(sp.rivalMargin(293.66, 440)).toBeGreaterThan(20)
    // 견줄 수 없는 경우: 화면 음의 위 배수(제 것만의 배음이 없다), 배음 간격이 6 빈이 안 되는 저음
    sp.update(sum(A4, A3), sr); expect(sp.rivalMargin(880, 440)).toBeNaN(); expect(sp.rivalMargin(41.2, 440)).toBeNaN(); expect(sp.rivalMargin(440, 41.2)).toBeNaN()
  })
  test('octaveCorrect: keeps correct f0, fixes sub-octave error, fixes double error', () => {
    sp.update(tone(220, 8), sr)
    expect(sp.octaveCorrect(220)).toBeCloseTo(220, 5)
    expect(sp.octaveCorrect(440)).toBeCloseTo(220, 5) // YIN 이 한 옥타브 위를 냈을 때 (기본음 220 존재)
    // 기본음이 약한 소리(짝수 배음만) → 110 으로 내려가면 안 됨: 110 의 홀수 배음(110, 330..) 없음
    expect(sp.octaveCorrect(220)).toBeCloseTo(220, 5)
    sp.update(tone(110, 8, h => h % 2 === 0 ? 0 : 1 / h), sr) // 홀수 배음만 (클라리넷풍) → f0=110
    expect(sp.octaveCorrect(110)).toBeCloseTo(110, 5)
  })
})

describe('double-stop interpretation', () => {
  const SR = 48000, WN = 4096
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const mi = (n: string) => { const m = /^([A-G]#?)(-?\d)$/.exec(n)!; return NOTE.indexOf(m[1]!) + (+m[2]! + 1) * 12 }
  const fq = (n: string) => 440 * Math.pow(2, (mi(n) - 69) / 12)
  /** 현악기다운 배음 구조(1/k 감쇠 + 홀짝 변조)로 한 음을 더한다 */
  function add(buf: Float32Array, f: number, amp: number): void {
    for (let i = 0; i < buf.length; i++) {
      const t = i / SR; let s = 0
      for (let k = 1; k <= 10; k++) { if (f * k > SR / 2) break; s += (amp / k) * (k % 2 ? 1 : 0.7) * Math.sin(2 * Math.PI * f * k * t + k * 0.7) }
      buf[i] = buf[i]! + s
    }
  }
  /** 두 음을 겹쳐 정상상태 한 창을 만든다 */
  function frame(a: string, b: string): Float32Array {
    const x = new Float32Array(SR); add(x, fq(a), 0.45); add(x, fq(b), 0.45)
    return x.subarray(SR - WN) as Float32Array
  }

  // 두 음이 겹치면 합성 신호의 주기가 두 주파수의 최대공약수에서 생겨, YIN 은 연주되지 않은
  // '가상 기본음' 을 높은 신뢰도로 낸다. 완전5도 → 아래 음의 한 옥타브 밑, 장3도 → 두 옥타브 밑 등.
  // octaveCorrect 는 그 배수 자리를 조사해 실제로 울리는 음으로 되돌려야 한다.
  const PAIRS: [string, string][] = [
    ['G3', 'D4'], ['D4', 'A4'], ['A4', 'E5'],   // 완전5도 (개방현 조합)
    ['G3', 'B3'], ['A3', 'C#4'], ['D4', 'F#4'], // 장3도
    ['G3', 'E4'], ['A3', 'F#4'],                // 장6도
    ['E4', 'A4'], ['G4', 'C5'],                 // 완전4도
    ['D4', 'D5'], ['A4', 'A5'],                 // 옥타브
  ]
  test.each(PAIRS)('%s + %s → never shows a note that was not played', (a, b) => {
    const sp = createSpectrum(WN)
    const w = frame(a, b)
    sp.update(w, SR)
    const yin = createYinFast(WN, { threshold: 0.10, hzMin: 40, hzMax: 4200 })
    const y = yin.process(w, SR)
    expect(y.hz).toBeGreaterThan(0)
    const out = sp.octaveCorrect(y.hz)
    const m = 12 * Math.log2(out / 440) + 69
    // 실제로 울리는 두 음 중 하나여야 한다
    const hit = Math.abs(m - mi(a)) < 0.6 || Math.abs(m - mi(b)) < 0.6
    expect(hit).toBe(true)
  })

  test('leaves single notes alone (including low strings with a weak fundamental)', () => {
    for (const [n, weak] of [['A4', false], ['C2', false], ['C2', true], ['G3', true]] as const) {
      const sp = createSpectrum(WN)
      const x = new Float32Array(SR)
      add(x, fq(n), 0.5)
      if (weak) { // 기본음만 깎아 'missing fundamental' 을 만든다
        const f = fq(n)
        for (let i = 0; i < x.length; i++) x[i] = x[i]! - 0.42 * Math.sin(2 * Math.PI * f * i / SR + 0.7)
      }
      const w = x.subarray(SR - WN) as Float32Array
      sp.update(w, SR)
      const y = createYinFast(WN, { threshold: 0.10, hzMin: 40, hzMax: 4200 }).process(w, SR)
      const out = sp.octaveCorrect(y.hz)
      const cents = Math.abs(1200 * Math.log2(out / fq(n)))
      expect(cents).toBeLessThan(60)
    }
  })
})

describe('the tuner shows the loudest sound, never a second voice above it', () => {
  const SR = 48000, N = 4096, HOP = 1024
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const mi = (n: string) => { const m = /^([A-G]#?)(-?\d)$/.exec(n)!; return NOTE.indexOf(m[1]!) + (+m[2]! + 1) * 12 }
  const fq = (n: string) => 440 * Math.pow(2, (mi(n) - 69) / 12)
  let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - .5 }
  /** 현악기다운 음 하나 — 1/k 배음, 느린 진폭 흔들림(활 압력), 시작 시각 */
  type Voice = { note: string; gain: number; from?: number; wobbleHz?: number }
  function mix(voices: Voice[], sec = 1.2, noise = 0.02): Float32Array {
    const n = Math.floor(SR * sec), x = new Float32Array(n)
    for (const [vi, v] of voices.entries()) {
      const f = fq(v.note), from = v.from ?? 0, wob = v.wobbleHz ?? 5.3 + vi * .8
      for (let i = 0; i < n; i++) { const t = i / SR; if (t < from) continue
        const a = 0.45 * v.gain * (1 + 0.15 * Math.sin(2 * Math.PI * wob * t + vi))
        let s = 0
        for (let k = 1; k <= 10; k++) { if (f * k < SR / 2) s += (a / k) * (k % 2 ? 1 : .7) * Math.sin(2 * Math.PI * f * k * t + k * .7 + vi) }
        x[i] = x[i]! + s * .4 }
    }
    for (let i = 0; i < n; i++) x[i] = x[i]! + rnd() * noise
    return x
  }
  /** skipSec 뒤 프레임 중 음이름이 note 인 비율 */
  function rate(x: Float32Array, note: string, skipSec: number): number {
    const an = createAnalyzer({ sampleRate: SR }); an.setSettings({ rmsMin: .014, smoothing: .14, refHz: 440, tolCents: 15 })
    const w = new Float32Array(N); let U = 0, F = 0
    for (let end = HOP; end <= x.length; end += HOP) { w.fill(0); const s0 = Math.max(0, end - N); w.set(x.subarray(s0, end), N - (end - s0))
      const f = an.process(w); if (end / SR < skipSec) continue; F++; if (f.midi === mi(note)) U++ }
    return U / F
  }
  const PAIRS: [string, string][] = [['G3', 'D4'], ['D4', 'A4'], ['A4', 'E5'], ['G3', 'B3'], ['D4', 'F#4'], ['G3', 'E4'], ['A3', 'C#4'], ['E4', 'A4']]
  // 다른 연주자: 내 음보다 10 dB 작은 음이 중음 간격(5도·3도·6도·4도) 위에서 울려도 화면은 내 음이다 — 강당에서 조율할 수 있어야 한다
  test.each(PAIRS)('%s with another player on %s at −10 dB → shows %s', (mine, other) => {
    expect(rate(mix([{ note: mine, gain: 1 }, { note: other, gain: 0.316 }]), mine, .35)).toBeGreaterThan(0.98)
  })
  test.each(PAIRS)('%s with another player on %s at −10 dB who started first → still %s from the first frames', (mine, other) => {
    expect(rate(mix([{ note: other, gain: 0.316 }, { note: mine, gain: 1, from: 0.3 }]), mine, .65)).toBeGreaterThan(0.98)
  })
  // 두 명이 같은 세기로 위아래에서 연주하면 어느 쪽인지 알 길이 없다 — 가장 낮은 배음렬(아래 음)을 흔들림 없이 보여 준다
  test.each(PAIRS)('%s + %s at the same level → the lower note, steadily', (lo, up) => {
    expect(rate(mix([{ note: lo, gain: 1 }, { note: up, gain: 1 }]), lo, .35)).toBeGreaterThan(0.98)
  })
  test.each(PAIRS)('%s + %s with the upper 6 dB louder → still the lower note', (lo, up) => {
    expect(rate(mix([{ note: lo, gain: 1 }, { note: up, gain: 2 }]), lo, .35)).toBeGreaterThan(0.98)
  })
  test('the label doesn’t wobble while two notes are held', () => {
    const an = createAnalyzer({ sampleRate: SR }); an.setSettings({ rmsMin: .014, smoothing: .14, refHz: 440, tolCents: 15 })
    const x = mix([{ note: 'D4', gain: 3 }, { note: 'A4', gain: 1 }]), w = new Float32Array(N); let last = -1, sw = 0
    for (let end = HOP; end <= x.length; end += HOP) { w.fill(0); const s0 = Math.max(0, end - N); w.set(x.subarray(s0, end), N - (end - s0))
      const f = an.process(w); if (end / SR < .35) continue; if (last >= 0 && f.midi !== last) sw++; last = f.midi }
    expect(sw).toBe(0)
  })
})

describe('the open strings in a room with low rumble — the tuning routine', () => {
  // 피드백 #12(2026-10-24): 아이폰 웹앱에서 솔(G3)만 안 잡히고 두 현을 같이 그으면 뚝뚝 끊겼다. 바이올린 G 현은 기본음이 2·3배음보다 15~25 dB 약하고,
  // 방·폰의 저역 웅웅 잡음은 밴드 중앙값보다 20~30 dB 높다 — 그 둔덕을 피크로 세면 옥타브 내리기가 솔3 를 솔2 로, 5도 중음의 최대공약수(레3)가 레4 자리를 빼앗았다
  const SR = 48000, N = 4096, HOP = 1024
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const mi = (n: string) => { const m = /^([A-G]#?)(-?\d)$/.exec(n)!; return NOTE.indexOf(m[1]!) + (+m[2]! + 1) * 12 }
  const fq = (n: string) => 440 * Math.pow(2, (mi(n) - 69) / 12)
  const gauss = (seed: number) => { let s = seed; return () => { let u = 0, v = 0; while (!u) u = (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; while (!v) v = (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) } }
  /** 현 하나: 배음 세기(dB) h2 = 0, h3 −3, h4 −6, h5 −10, h6 −12, 그 위 −14 − 2(h−7); 기본음은 f0Db. 비브라토 ±5 ¢, 어택 80 ms */
  function string(note: string, f0Db: number, seed: number, sec: number, levels?: (h: number) => number): Float32Array {
    const f = fq(note), n = Math.round(sec * SR), x = new Float32Array(n); let ph = 0
    const hdb = levels ?? ((h: number) => h === 1 ? f0Db : h === 2 ? 0 : h === 3 ? -3 : h === 4 ? -6 : h === 5 ? -10 : h === 6 ? -12 : -14 - 2 * (h - 7))
    for (let i = 0; i < n; i++) { const t = i / SR, env = Math.min(1, t / 0.08), ff = f * 2 ** (5 * Math.sin(2 * Math.PI * 5.3 * t + seed) / 1200); ph += 2 * Math.PI * ff / SR
      let s = 0; for (let h = 1; h <= 20; h++) { if (ff * h > SR * .45) break; s += 10 ** (hdb(h) / 20) * Math.sin(ph * h + h * 0.7) }
      x[i] = 0.18 * s * env }
    return x
  }
  /** 저역 웅웅 잡음(갈색, 1/f²): 세기는 현의 가장 센 배음 대비 dB */
  function rumble(n: number, db: number, seed: number): Float32Array {
    const g = gauss(seed), x = new Float32Array(n); let b = 0
    for (let i = 0; i < n; i++) { b = 0.997 * b + g() * 0.08; x[i] = 0.18 * 10 ** (db / 20) * b }
    return x
  }
  const sum = (...xs: Float32Array[]) => { const y = new Float32Array(xs[0]!.length); for (const x of xs) for (let i = 0; i < y.length; i++) y[i] = y[i]! + x[i]!; return y }
  /** t ≥ skip 의 프레임이 보여 준 음이름 분포 { midi → 비율 } */
  function shown(x: Float32Array, skip = 0.4): Map<number, number> {
    const an = createAnalyzer({ sampleRate: SR, windowSize: N, hzMin: 40, hzMax: 4200 }); an.setSettings({ rmsMin: .005, smoothing: .2, refHz: 440, tolCents: 15 })
    const m = new Map<number, number>(); let F = 0
    for (let end = N; end <= x.length; end += HOP) { const f = an.process(x.subarray(end - N, end)); if (end / SR < skip) continue; F++; const k = f.hz > 0 ? f.midi : -1; m.set(k, (m.get(k) ?? 0) + 1) }
    for (const [k, v] of m) m.set(k, v / F)
    return m
  }
  const only = (m: Map<number, number>, note: string) => (m.get(mi(note)) ?? 0)

  test.each([[-20, -20], [-20, -30], [-30, -20], [-12, -20]])('G3 alone, fundamental %i dB, rumble %i dB → G3 in every frame', (f0Db, nz) => {
    for (const seed of [3, 4, 5]) expect(only(shown(sum(string('G3', f0Db, 7, 1.6), rumble(Math.round(1.6 * SR), nz, seed))), 'G3')).toBe(1)
  }, 20000)
  const FIFTHS: Array<[string, string, number]> = []
  for (const [lo, up] of [['G3', 'D4'], ['D4', 'A4'], ['A4', 'E5']] as const) for (const nz of [-20, -25]) FIFTHS.push([lo, up, nz])
  test.each(FIFTHS)('%s + %s bowed together over rumble at %i dB → the lower note in every frame', (lo, up, nz) => {
    for (const seed of [3, 5, 7])
      expect(only(shown(sum(string(lo, lo === 'G3' ? -20 : 0, 7, 1.6), string(up, 0, 13, 1.6), rumble(Math.round(1.6 * SR), nz, seed))), lo), `${lo}+${up} rumble ${nz} seed ${seed}`).toBe(1)
  }, 20000)
  // 5도 중음의 최대공약수 배음렬을 알아보는 규칙(5·7 배음 자리가 비었다)이 한 음을 중음으로 오해해 한 옥타브 올리면 안 된다 —
  // 배음 세기가 들쭉날쭉한(몸통 공명의 골, ±12 dB) 단음도, 기본음이 약한 단음도
  test.each(['G3', 'D4', 'A4', 'C3', 'A2'])('%s with an irregular spectrum is never shown an octave up', note => {
    for (let seed = 1; seed <= 8; seed++) {
      const g = gauss(seed * 7919), dips = Array.from({ length: 21 }, () => 12 * (2 * (g() > 0 ? 1 : 0) - 1) * Math.abs(g()) / 2)
      const x = string(note, -20 + dips[1]!, seed, 1.0, h => (h === 1 ? -20 : h === 2 ? 0 : h === 3 ? -3 : -6 - 2 * (h - 4)) + dips[h]!)
      const m = shown(sum(x, rumble(x.length, -25, seed)), 0.3)
      expect(m.get(mi(note) + 12) ?? 0, `${note} seed ${seed} shown an octave up`).toBe(0)
      expect(m.get(mi(note) + 19) ?? 0, `${note} seed ${seed} shown a twelfth up`).toBe(0)
      expect(only(m, note), `${note} seed ${seed}`).toBeGreaterThan(0.97)
    }
  }, 20000)
})

describe('tuning in a room full of people playing', () => {
  // 사람 많은 곳에서 음이름이 내 음의 한 옥타브·12도 아래로 튀었다: 다른 소리가 섞이면 YIN 은 내 주기의 2·3 배를 내고,
  // 그 아래 음의 배음 자리마다 배경 소리가 피크로 서 있어 '실제로 울리는 음' 으로 통과했다. 내 소리는 방 전체보다 8 dB 크다
  const SR = 48000, N = 4096, HOP = 1024
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const mi = (n: string) => { const m = /^([A-G]#?)(-?\d)$/.exec(n)!; return NOTE.indexOf(m[1]!) + (+m[2]! + 1) * 12 }
  const lcg = (seed: number) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32 }
  const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)
  /** 내 개방현: 1/h 배음, 바이올린 몸통처럼 280 Hz 아래 배음은 20 dB 약하다 */
  function mine(note: string, sec: number): Float32Array {
    const f = 440 * 2 ** ((mi(note) - 69) / 12), n = Math.round(sec * SR), x = new Float32Array(n)
    for (let i = 0; i < n; i++) { const t = i / SR; let s = 0
      for (let h = 1; h <= 16 && f * h < SR * .45; h++) s += (f * h < 280 ? 0.1 : 1) / h * Math.sin(2 * Math.PI * f * h * t + h)
      x[i] = s * Math.min(1, t / .06) }
    return x
  }
  /** 끝 40 ms 를 줄여 이어 붙일 수 있게 */
  const faded = (x: Float32Array): Float32Array => x.map((v, i) => v * Math.min(1, (x.length - i) / (.04 * SR)))
  /** 각자 연습하는 사람들: 한 사람이 0.3~1.0 s 짜리 음을 이어 켠다 (G2~D6) */
  function room(sec: number, players: number, seed: number): Float32Array {
    const r = lcg(seed), n = Math.round(sec * SR), x = new Float32Array(n)
    for (let p = 0; p < players; p++) { let t = -r() * 0.5, m = 43 + Math.floor(r() * 40), ph = 0
      while (t < sec) { const d = 0.3 + r() * 0.7, f = 440 * 2 ** ((m - 69 + (r() - .5) * .3) / 12), a = 0.6 + r() * 0.8
        for (let i = Math.max(0, Math.round(t * SR)); i < Math.min(n, Math.round((t + d) * SR)); i++) { const u = i / SR - t; ph += 2 * Math.PI * f / SR
          let s = 0; for (let h = 1; h <= 12 && f * h < SR * .45; h++) s += Math.sin(ph * h) / h
          x[i] = x[i]! + a * s * Math.min(1, u / .05, (d - u) / .05) }
        t += d; m = Math.max(40, Math.min(86, m + Math.round((r() - .5) * 10))) } }
    for (let i = 0; i < n; i++) x[i] = x[i]! + (r() - .5) * 0.05
    return x
  }
  /** 0.5 s 뒤 프레임 중 화면 음이 note 인 비율 — 시드 셋 중 가장 낮은 값 */
  function worst(note: string, snrDb: number): number {
    let w = 1
    for (const seed of [1, 2, 3]) {
      const me = mine(note, 3), bg = room(3, 12, seed * 101 + mi(note)), g = rms(me) / rms(bg) / 10 ** (snrDb / 20) / 8
      const x = me.map((v, i) => v / 8 + bg[i]! * g)
      const an = createAnalyzer({ sampleRate: SR, windowSize: N, hzMin: 29, hzMax: 4200 }); an.setSettings({ rmsMin: .005, smoothing: .2, refHz: 440, tolCents: 10 })
      let F = 0, ok = 0
      for (let end = N; end <= x.length; end += HOP) { const f = an.process(x.subarray(end - N, end)); if (end / SR < .5) continue; F++; if (f.midi === mi(note)) ok++ }
      w = Math.min(w, ok / F)
    }
    return w
  }
  test.each([['A4', 0.97], ['D4', 0.97], ['G3', 0.85], ['E5', 0.85]] as const)('%s, 8 dB above twelve other players → the note that is played (over %f of the time)', (note, min) => {
    expect(worst(note, 8)).toBeGreaterThan(min)
  }, 30000)
  // 프레임마다 가르고도 남는 것: 남의 소리가 섞인 몇 프레임이 내 음의 아래 배수나 남의 음으로 읽힌다. 내 음이 그대로 울리는 중이고 그 음의 배음이 훨씬 약하면
  // 이어질 때만 바꾼다 — 6 dB 차이에서도 라4·레4 는 흔들리지 않는다
  test.each([['A4', 6, 0.99], ['D4', 6, 0.99], ['E5', 8, 0.95], ['E5', 6, 0.85]] as const)('%s, %i dB above twelve other players → held steadily (over %f of the time)', (note, snr, min) => {
    expect(worst(note, snr)).toBeGreaterThan(min)
  }, 30000)
  /** x 를 분석해 t ≥ from 에서 note 가 처음 뜨는 시각 − from (ms). 안 뜨면 Infinity */
  function shownAfter(x: Float32Array, note: string, from: number): number {
    const an = createAnalyzer({ sampleRate: SR, windowSize: N, hzMin: 29, hzMax: 4200 }); an.setSettings({ rmsMin: .005, smoothing: .2, refHz: 440, tolCents: 10 })
    for (let end = N; end <= x.length; end += HOP) { const f = an.process(x.subarray(end - N, end)); if (end / SR >= from && f.midi === mi(note)) return (end / SR - from) * 1000 }
    return Infinity
  }
  // 그 규칙이 진짜 연주를 늦추지 않는다: 바꿔 켠 아래 음은 그 음만의 배음이 세서 평소대로 두 프레임에 바뀐다
  test.each([['A4', 'A3'], ['D5', 'D4'], ['G4', 'G3'], ['E5', 'E4'], ['E5', 'A3'], ['D5', 'G3'], ['A5', 'A3']] as const)('a played leap %s → %s (an octave, a twelfth, two octaves down) shows within 0.12 s', (hi, lo) => {
    const a = faded(mine(hi, 1)), b = faded(mine(lo, 1)), x = new Float32Array(a.length + b.length)
    x.set(a.map(v => v / 8)); x.set(b.map(v => v / 8), a.length)
    expect(shownAfter(x, lo, 1)).toBeLessThanOrEqual(120)
  })
  // 위 음을 켜는 중에 아래 옥타브를 더하면(옥타브 두 줄) 화면은 아래 음으로 간다 — 아래 음이 여려도 여섯 프레임(0.13 s) 더 기다린 뒤에는
  test.each([['A4', 'A3', 0], ['D5', 'D4', 0], ['D5', 'D4', -6]] as const)('the lower octave %s → %s joined at %i dB under a held note takes over within 0.35 s', (hi, lo, db) => {
    const a = faded(mine(hi, 2.2)), b = faded(mine(lo, 1.2)), x = Float32Array.from(a, v => v / 8), g = 10 ** (db / 20)
    for (let i = 0; i < b.length; i++) x[SR + i] = x[SR + i]! + g * b[i]! / 8
    expect(shownAfter(x, lo, 1)).toBeLessThanOrEqual(350)
  })
})
