import { describe, test, expect } from 'vitest'
import { createTracker, DEFAULT_TRACKER, type Tracker } from './tracker.ts'

const A = 0.14
const { acquireFrames: WARM, coldAcquireFrames: COLD, coldAcquireGap: COLD_GAP, releaseFrames: REL, warmNoteFrames: PLAYED, coldAfterFrames: QUIET } = DEFAULT_TRACKER
/** 무음에서 음을 띄운다(새 트래커 = 첫 시작 — 고른 소리라 6 프레임에 뜨고 이어진다). 다른 동작을 보는 테스트의 준비 단계 */
const acquire = (t: Tracker, hz = 440, a = A): Tracker => { for (let i = 0; i < COLD; i++) t.push(hz, 0.95, true, a); return t }
const silence = (t: Tracker, n: number): Tracker => { for (let i = 0; i < n; i++) t.push(-1, 0, false, A); return t }
const tone = (t: Tracker, n: number, hz = 440): Tracker => { for (let i = 0; i < n; i++) t.push(hz, 0.95, true, A); return t }
/** 프레임마다 ±10 ¢ 흔들리는 소리 — ±40 ¢ 안이라 음이지만 첫 시작의 깨끗한 길(±5 ¢ 고른 소리)은 못 탄다 */
const wob = (t: Tracker, n: number, hz = 440): Tracker => { for (let i = 0; i < n; i++) t.push(hz * Math.pow(2, (i % 2 ? 10 : -10) / 1200), 0.95, true, A); return t }
const wobAt = (i: number, hz = 440) => hz * Math.pow(2, (i % 2 ? 10 : -10) / 1200)
/** 연주한 음(warmNoteFrames 이어진 음) 하나를 띄웠다가 놓은 트래커 — 연습하다 쉬는 중. 다음 음은 acquireFrames 로 뜬다 */
const warm = (): Tracker => silence(tone(createTracker(), PLAYED), REL + 1)
describe('tracker', () => {
  test('after playing, a new note acquires after six consistent frames (≈ 0.13 s), holds through short dropouts, releases after releaseFrames', () => {
    const t = warm()
    for (let i = 0; i < WARM - 1; i++) expect(t.push(440, 0.95, true, A).midi).toBe(-1) // 말소리 모음 하나(0.1 s 남짓)로는 안 띄운다
    expect(t.push(440, 0.95, true, A).midi).toBe(69)
    for (let i = 0; i < REL; i++) expect(t.push(-1, 0, false, A).midi).toBe(69) // 20 misses (≈ 430 ms) 동안 유지 — 활을 들었다 놓는 틈
    expect(t.push(-1, 0, false, A).midi).toBe(-1) // 21 → release
  })
  test('first start (just turned on): a wavering tone needs coldAcquireFrames (≈ 0.45 s) — one that lasts a syllable or two shows nothing', () => {
    const t = createTracker()
    for (let i = 0; i < COLD - 1; i++) expect(t.push(wobAt(i, 220), 0.95, true, A).midi, `frame ${i + 1}`).toBe(-1)
    expect(t.push(wobAt(COLD - 1, 220), 0.95, true, A).midi).toBe(57)
    const u = createTracker() // 2.9.9 의 여섯 프레임이면 떴을 길이(0.3 s)의 소리 — 끝나면 처음부터
    wob(u, COLD - 1, 220); silence(u, COLD_GAP + 1)
    for (let i = 0; i < WARM; i++) expect(u.push(wobAt(i, 220), 0.95, true, A).midi).toBe(-1)
  })
  test('first start: a clean, steady tone (a plucked or bowed open string) shows after the usual six frames; a wavering or less periodic one needs coldAcquireFrames', () => {
    const t = createTracker()
    for (let i = 0; i < WARM - 1; i++) expect(t.push(220, 0.95, true, A).midi, `frame ${i + 1}`).toBe(-1)
    expect(t.push(220, 0.95, true, A).midi).toBe(57)
    const cyc = (i: number, c: number) => 440 * Math.pow(2, [-c, 0, c][i % 3]! / 1200)
    const v = createTracker() // −8 · 0 · +8 ¢ 로 떠는 소리 — 고르지 않다
    for (let i = 0; i < COLD - 1; i++) expect(v.push(cyc(i, 8), 0.95, true, A).midi).toBe(-1)
    expect(v.push(cyc(COLD - 1, 8), 0.95, true, A).midi).toBe(69)
    const w = createTracker() // −4 · 0 · +4 ¢ 는 고른 소리(활 · 잔향이 만드는 정도), 신뢰도 0.91 이면 깨끗하다
    for (let i = 0; i < WARM - 1; i++) expect(w.push(cyc(i, 4), 0.91, true, A).midi).toBe(-1)
    expect(w.push(cyc(WARM - 1, 4), 0.91, true, A).midi).toBe(69)
    const u = createTracker() // 고르지만 신뢰도 0.89 — 말소리처럼 주기가 덜 깨끗한 소리는 0.45 s 를 기다린다
    for (let i = 0; i < COLD - 1; i++) expect(u.push(440, 0.89, true, A).midi).toBe(-1)
    expect(u.push(440, 0.89, true, A).midi).toBe(69)
  })
  test('first start, clean path: the same gap rule as while playing — one dropped frame is skipped, two start the six over', () => {
    const t = createTracker()
    tone(t, 4); silence(t, 1); expect(t.push(440, 0.95, true, A).midi).toBe(-1)
    expect(t.push(440, 0.95, true, A).midi).toBe(69)
    const u = createTracker()
    tone(u, 4); silence(u, 2); for (let i = 0; i < WARM - 1; i++) expect(u.push(440, 0.95, true, A).midi).toBe(-1)
    expect(u.push(440, 0.95, true, A).midi).toBe(69)
  })
  test('first start, clean path: the six clean frames decide alone — their median, not the earlier frames, is where it starts', () => {
    const t = createTracker() // 앞의 8 프레임은 +30 ¢ 에 신뢰도 0.85(덜 깨끗함) — 띄우는 근거도 시작 값도 아니다
    for (let i = 0; i < 8; i++) t.push(440 * Math.pow(2, 30 / 1200), 0.85, true, A)
    for (let i = 0; i < WARM - 1; i++) expect(t.push(440, 0.95, true, A).midi).toBe(-1)
    const o = t.push(440, 0.95, true, A)
    expect(o.midi).toBe(69); expect(Math.abs(o.a)).toBeLessThan(0.01)
  })
  test('while playing a note starts from the last three frames as in 2.9.9, not from the clean-path median', () => {
    const t = warm(), up = (c: number) => 440 * Math.pow(2, c / 1200) // 6 프레임에 0 → 7.5 ¢ 로 천천히(±5 ¢ 안)
    for (let i = 0; i < WARM - 1; i++) t.push(up(1.5 * i), 0.95, true, A)
    expect(t.push(up(1.5 * (WARM - 1)), 0.95, true, A).a).toBeCloseTo(6, 6)
  })
  test('a played note is counted from the frames that showed it — earlier frames of other sounds do not make it count sooner', () => {
    const lead = (t: Tracker) => { for (let i = 0; i < 12; i++) t.push(wobAt(i, 330), 0.7, true, A); return t } // 앞선 다른 소리(덜 깨끗함)
    const t = tone(lead(createTracker()), PLAYED - 1) // 6 프레임에 뜨고 1 s 에 한 프레임 모자람
    silence(t, REL + 1)
    for (let i = 0; i < COLD - 1; i++) expect(t.push(wobAt(i), 0.95, true, A).midi).toBe(-1)
    const u = tone(lead(createTracker()), PLAYED) // 1 s — 연주한 음
    silence(u, REL + 1)
    for (let i = 0; i < WARM - 1; i++) expect(u.push(wobAt(i), 0.95, true, A).midi).toBe(-1)
    expect(u.push(wobAt(WARM - 1), 0.95, true, A).midi).toBe(69)
  })
  test('first start: a dropout of up to coldAcquireGap frames is skipped, a longer one starts the count over', () => {
    const t = createTracker()
    wob(t, COLD - 1); silence(t, COLD_GAP)
    expect(t.push(wobAt(COLD - 1), 0.95, true, A).midi).toBe(69)
    const u = createTracker()
    wob(u, COLD - 1); silence(u, COLD_GAP + 1)
    for (let i = 0; i < COLD - 1; i++) expect(u.push(wobAt(i), 0.95, true, A).midi).toBe(-1)
    expect(u.push(wobAt(COLD - 1), 0.95, true, A).midi).toBe(69)
  })
  test('only a note held for warmNoteFrames (≈ 1 s) makes the next start quick — a shorter sound (a syllable, an "uh") leaves it a first start', () => {
    const t = tone(createTracker(), PLAYED - 1) // 떴지만 1 s 에 못 미친 소리
    expect(t.current().midi).toBe(69)
    silence(t, REL + 1)
    for (let i = 0; i < COLD - 1; i++) expect(t.push(wobAt(i, 392), 0.95, true, A).midi).toBe(-1)
    expect(t.push(wobAt(COLD - 1, 392), 0.95, true, A).midi).toBe(67)
    tone(t, PLAYED - COLD, 392); silence(t, REL + 1) // 같은 음을 1 s 까지 이어 그었다 — 이제 연주 중
    for (let i = 0; i < WARM - 1; i++) expect(t.push(wobAt(i), 0.95, true, A).midi).toBe(-1)
    expect(t.push(wobAt(WARM - 1), 0.95, true, A).midi).toBe(69)
  })
  test('after a played note the next start stays quick for coldAfterFrames (≈ 30 s) — short sounds shown in between (talk) do not extend it; then it is a first start again', () => {
    const t = warm()
    silence(t, QUIET - 60) // 연습하다 쉬는 중(30 s 안)
    tone(t, WARM, 330) // 짧은 소리(말소리 음절) — 평소대로 뜨지만 연주한 음은 아니다
    expect(t.current().midi).toBe(64)
    silence(t, REL + 1); silence(t, 40) // 마지막 연주한 음에서 30 s 가 지났다
    for (let i = 0; i < COLD - 1; i++) expect(t.push(wobAt(i), 0.95, true, A).midi).toBe(-1)
    expect(t.push(wobAt(COLD - 1), 0.95, true, A).midi).toBe(69)
    const u = warm()
    silence(u, QUIET - 100); tone(u, PLAYED, 392) // 30 s 안에 다시 켠 긴 음 — 6 프레임에 뜨고, 1 s 이어지면 시계가 처음부터
    silence(u, REL + 1); silence(u, QUIET - 100)
    for (let i = 0; i < WARM - 1; i++) expect(u.push(wobAt(i), 0.95, true, A).midi).toBe(-1)
    expect(u.push(wobAt(WARM - 1), 0.95, true, A).midi).toBe(69)
  })
  test('reset() starts over: the next start is cold', () => {
    const t = warm(); t.reset()
    for (let i = 0; i < WARM; i++) expect(t.push(wobAt(i), 0.95, true, A).midi).toBe(-1)
  })
  test('scattered pitches never acquire — a syllable, a bird, a click (two periodic frames) show nothing', () => {
    const t = warm()
    for (const hz of [440, 523, 392, 659, 440, 466]) expect(t.push(hz, 0.95, true, A).midi).toBe(-1) // 프레임마다 다른 음
    for (const hz of [440, 440]) expect(t.push(hz, 0.95, true, A).midi).toBe(-1) // 두 프레임만 같은 음
    expect(t.push(-1, 0, false, A).midi).toBe(-1)
    // 미끄러져 올라오는 피치(프레임당 30 ¢)는 멈출 때까지 안 띄운다 — 여섯 프레임이 모두 ±40 ¢ 안에 모여야 한다
    const t2 = warm(); const up = (c: number) => 440 * Math.pow(2, c / 1200)
    for (const c of [-150, -120, -90, -60, -30]) expect(t2.push(up(c), 0.95, true, A).midi).toBe(-1)
    for (let k = 1; k <= 4; k++) expect(t2.push(up(0), 0.95, true, A).midi, `0 ¢ frame ${k}: −60 or lower is still in the window`).toBe(-1)
    expect(t2.push(up(0), 0.95, true, A).midi).toBe(69) // 창 = −30 과 0 ¢ 다섯
  })
  test('a vowel-length steady tone (five frames ≈ 0.1 s) shows nothing; one dropped frame is skipped, two restart the count', () => {
    const t = warm()
    for (let i = 0; i < 5; i++) expect(t.push(220, 0.95, true, A).midi).toBe(-1)
    expect(t.push(-1, 0, false, A).midi).toBe(-1); expect(t.push(220, 0.95, true, A).midi).toBe(57) // 시끄러운 곳의 한 프레임 빠짐은 건너뛴다
    const u = warm()
    for (let i = 0; i < 5; i++) u.push(220, 0.95, true, A)
    u.push(-1, 0, false, A); u.push(-1, 0, false, A); expect(u.push(220, 0.95, true, A).midi).toBe(-1) // 두 프레임 끊기면 처음부터
  })
  test('vibrato ±25 ¢ from the very first frame still acquires on the sixth (first start: on the eighteenth)', () => {
    const t = warm(), vib = (k: number) => 440 * Math.pow(2, 25 * Math.sin(2 * Math.PI * 5.5 * k * 1024 / 48000) / 1200)
    for (let k = 0; k < 5; k++) expect(t.push(vib(k), 0.95, true, A).midi).toBe(-1)
    expect(t.push(vib(5), 0.95, true, A).midi).toBe(69)
    const c = createTracker()
    for (let k = 0; k < COLD - 1; k++) expect(c.push(vib(k), 0.95, true, A).midi).toBe(-1)
    expect(c.push(vib(COLD - 1), 0.95, true, A).midi).toBe(69)
  })
  test('a first start begins at the middle of the vibrato, not at the end of it the last frames happen to be on', () => {
    // 첫 시작이 끝나는 프레임에서 비브라토가 위쪽 끝(+25 ¢)에 오도록 위상을 맞춘다 — 마지막 세 프레임에서 시작하면 +24 ¢ 에서 시작한다
    const ph = Math.PI / 2 - 2 * Math.PI * 5.5 * (COLD - 1) * 1024 / 48000
    const vib = (k: number) => 440 * Math.pow(2, 25 * Math.sin(2 * Math.PI * 5.5 * k * 1024 / 48000 + ph) / 1200)
    const c = createTracker(); let o = c.push(vib(0), 0.95, true, A)
    for (let k = 1; k < COLD; k++) o = c.push(vib(k), 0.95, true, A)
    expect(o.midi).toBe(69); expect(Math.abs(o.a)).toBeLessThan(8)
  })
  test('a much weaker rival while the shown note still sounds needs rivalFrames; a strong one changes in two frames', () => {
    const seen: number[][] = []
    const weak = acquire(createTracker()), strong = acquire(createTracker())
    const names = (t: Tracker, rival: boolean): number[] => Array.from({ length: 10 }, () => t.push(220, 0.95, true, A, false, (c, s) => { seen.push([c, s]); return rival }).midi)
    expect(names(strong, false)).toEqual([69, 69, 57, 57, 57, 57, 57, 57, 57, 57]) // 중앙값이 넘어간 프레임 + 확인 한 프레임
    expect(names(weak, true)).toEqual([69, 69, 69, 69, 69, 69, 69, 69, 57, 57]) // 여덟 프레임 이어진 뒤에야 — 그보다 오래 붙들지는 않는다
    expect(seen.every(([c, s]) => Math.abs(c! + 1200) < 1 && Math.abs(s!) < 1)).toBe(true) // 후보(라3)와 화면의 음(라4)을 절대 cents 로 넘긴다
  })
  test('a change is confirmed by a frame that reads the new note: readings that keep moving need rivalFrames', () => {
    const t = acquire(createTracker()), out: number[] = []
    for (const hz of [330, 262, 208, 165, 131, 104, 82.5, 65.4, 52, 41.2]) out.push(t.push(hz, 0.95, true, A).midi) // 프레임마다 다른 음 — 이번 프레임이 중앙값과 같은 음인 적이 없다
    expect(out.slice(0, 8)).toEqual([69, 69, 69, 69, 69, 69, 69, 69])
    expect(out[8]).not.toBe(69) // 여덟 프레임 뒤에는 놓는다
    const u = acquire(createTracker()); u.push(330, 0.95, true, A); u.push(330, 0.95, true, A)
    expect(u.push(330, 0.95, true, A).midi).toBe(64) // 같은 음이 이어지면 평소대로
  })
  test('hysteresis: a momentary ±60¢ jump keeps the note name (the smoothed value is still within half a semitone)', () => {
    const t = acquire(createTracker())
    const up60 = 440 * Math.pow(2, 60 / 1200)
    // 3프레임까지는 평활 때문에 표시값이 +40 ¢ 을 넘지 않는다 → 라벨 유지
    for (let i = 0; i < 3; i++) expect(t.push(up60, 0.95, true, A).midi).toBe(69)
  })
  test('hysteresis: a sustained +60¢ eventually switches to the neighbor (it really is closer)', () => {
    const t = acquire(createTracker())
    const up60 = 440 * Math.pow(2, 60 / 1200)
    let last = 69
    for (let i = 0; i < 12; i++) last = t.push(up60, 0.95, true, A).midi
    expect(last).toBe(70) // 라♯4 −40 ¢ 으로 보이는 게 맞다. '라4 +60 ¢' 는 가장 가까운 음이 아니다
  })
  test('real change switches within 3 frames', () => {
    const t = acquire(createTracker())
    expect(t.push(494, 0.7, true, A).midi).toBe(69) // 중앙값(3)이 아직 이전 음
    expect(t.push(494, 0.7, true, A).midi).toBe(69) // 1st outside frame
    expect(t.push(494, 0.7, true, A).midi).toBe(71) // 2nd → switch to B4 (총 3프레임 ≈ 70 ms)
  })
  test('outlier frame is rejected by weighted median', () => {
    const t = acquire(createTracker())
    const r = t.push(880, 0.6, true, A) // 한 프레임 옥타브 튐
    expect(r.midi).toBe(69); expect(Math.abs(1200 * Math.log2(r.hz / 440))).toBeLessThan(5)
  })
  test('adaptive smoothing: large step converges within a few frames', () => {
    const t = acquire(createTracker())
    let r = t.push(440, 0.95, true, A)
    for (let i = 0; i < 4; i++) r = t.push(466.16, 0.95, true, A) // +100¢ (A♯4)
    expect(r.midi).toBe(70); expect(Math.abs(1200 * Math.log2(r.hz / 466.16))).toBeLessThan(15)
  })

  test('display consistency: cents (= dispA − label center) always within ±50 ¢', () => {
    // 재현: 한 방향으로 4프레임 이상 움직이면 적응 부스트가 dispA 를 새 음까지 끌어다 놓는데,
    // 라벨은 switchFrames 만큼 기다린다 → 그 사이 화면에 두 음의 간격(100~190 ¢)이 찍혔다.
    const t = createTracker()
    const a = 1200 * Math.log2(440 / 440) // A4 = 0 ¢
    for (let i = 0; i < 20; i++) t.push(440, 0.95, true, 0.12)   // A4 지속
    let worst = 0
    // 레가토로 B4(+200 ¢)까지 한 방향 이동 — 부스트가 걸리는 조건
    for (let i = 1; i <= 12; i++) {
      const cents = a + Math.min(200, i * 25)
      const o = t.push(440 * Math.pow(2, cents / 1200), 0.95, true, 0.12)
      if (o.midi >= 0) worst = Math.max(worst, Math.abs(o.a - (o.midi - 69) * 100))
    }
    expect(worst).toBeLessThanOrEqual(50)
  })

  test('a far candidate never drags the needle — the display is either the old value or the confirmed new one, never in between', () => {
    // 2.4.6 까지: 옥타브 아래 후보(−1200 ¢)가 들어오면 전환을 기다리는 동안 dispA 가 그쪽으로 미끄러져 시3·도♯3 같은 낸 적 없는 중간 음이 찍혔다
    const t = acquire(createTracker(), 196, 0.2)
    const a0 = t.push(196, 0.95, true, 0.2).a
    const near = (x: number, y: number) => Math.abs(x - y) < 1
    // 한 프레임 튐: 중앙값이 삼킨다 — 바늘 그대로
    let o = t.push(98, 0.95, true, 0.2); expect(o.midi).toBe(55); expect(near(o.a, a0)).toBe(true)
    o = t.push(196, 0.95, true, 0.2); expect(o.midi).toBe(55); expect(near(o.a, a0)).toBe(true)
    // 이어지는 후보: 어느 프레임에서도 표시값은 옛 값(0 ¢ 근처) 아니면 새 값(−1200 ¢ 근처) — 그 사이 값은 없다
    const seen: number[] = []
    for (let i = 0; i < 6; i++) { o = t.push(98, 0.95, true, 0.2); seen.push(o.midi); expect(near(o.a, a0) || near(o.a, a0 - 1200), `frame ${i}: a=${o.a.toFixed(1)}`).toBe(true) }
    expect(seen[0]).toBe(55); expect(seen[5]).toBe(43); expect(new Set(seen).size).toBe(2) // 솔3 → 솔2 로 한 번만 바뀐다
  })
  test('a slide keeps being followed past the switch band (the needle is already near the median)', () => {
    const t = acquire(createTracker(), 440, 0.2)
    let prev = -Infinity, back = 0, last = 0
    for (let i = 1; i <= 16; i++) { const o = t.push(440 * Math.pow(2, i * 20 / 1200), 0.95, true, 0.2); if (o.a < prev - 1e-9) back++; prev = o.a; last = o.a } // 20 ¢ 씩 320 ¢ 까지 (라→시 를 지나 도♯ 까지)
    expect(back).toBe(0); expect(last).toBeGreaterThan(250) // 뒤로 간 적 없고, 끝에서 목표(320 ¢) 가까이
  })

  test('after a note change the needle reads the new note at once — no smoothing carried over from the old note', () => {
    // 반음 슬러(미4 +14 → 파4 −11): 평활을 이어 가면 새 음이 −40 ¢ 대에서 0.3 s 에 걸쳐 −11 로 미끄러져 보인다(숫자·초록도 같이)
    const t = createTracker(), hz = (c: number) => 440 * Math.pow(2, c / 1200)
    for (let i = 0; i < COLD + 4; i++) t.push(hz(-486), 0.95, true, 0.2)
    const outs = [-461, -436, -411, -411, -411, -411, -411, -411].map(c => t.push(hz(c), 0.95, true, 0.2)) // 창이 두 음에 걸친 두 프레임, 그다음 파4 −11
    const k = outs.findIndex(o => o.midi === 65)
    expect(k).toBeGreaterThanOrEqual(0); expect(outs[k]!.settling).toBe(true)
    for (const o of outs.slice(k + 3)) expect(Math.abs(o.a - -411)).toBeLessThan(0.5)
  })
  test('a label change at half a semitone starts from the median, not from ∓50 ¢', () => {
    const t = acquire(createTracker(), 440, 0.2), hz = (c: number) => 440 * Math.pow(2, c / 1200)
    let first = null as null | ReturnType<typeof t.push>
    for (let i = 0; i < 16 && !first; i++) { const o = t.push(hz(60), 0.95, true, 0.2); if (o.midi === 70) first = o }
    expect(first).not.toBeNull(); expect(Math.abs(first!.a - 60)).toBeLessThan(0.5) // 라♯4 −40 ¢ 에서 시작 (평활값이면 −49 ¢)
  })

  test('inside metronome click windows a different note needs three frames, outside two', () => {
    const settle = () => acquire(createTracker())
    const a = settle(); expect(a.push(659, .95, true, A, true).midi).toBe(69); expect(a.push(659, .95, true, A, true).midi).toBe(69)
    expect(a.push(440, .95, true, A, true).midi).toBe(69) // 클릭이 섞인 두 프레임의 가짜 음은 화면에 안 나온다
    // 중앙값(3)이 새 음으로 넘어간 뒤부터 센다: 평소엔 셋째 프레임, 클릭 구간에선 넷째 프레임에 바뀐다
    const b = settle(); for (let i = 0; i < 3; i++) expect(b.push(659, .95, true, A, true).midi).toBe(69); expect(b.push(659, .95, true, A, true).midi).toBe(76)
    const c = settle(); c.push(659, .95, true, A); c.push(659, .95, true, A); expect(c.push(659, .95, true, A).midi).toBe(76)
  })

  test('held count: +1 per missing frame, 0 on a fresh measurement (so the trace leaves no horizontal line)', () => {
    const t = createTracker()
    for (let i = 0; i < COLD + 1; i++) expect(t.push(440, 0.95, true, A).held).toBe(0)
    expect(t.push(-1, 0, false, A).held).toBe(1)
    expect(t.push(-1, 0, false, A).held).toBe(2)
    expect(t.push(440, 0.95, true, A).held).toBe(0) // 다시 잡히면 0
  })
})

describe('tracker: the line is held through a blip and goes in one step to where the pitch settles', () => {
  const hz = (c: number) => 440 * Math.pow(2, c / 1200)
  /** 라4 를 자리 잡을 만큼 켠 트래커(반응 보통 .20) */
  const steady = (p = DEFAULT_TRACKER): Tracker => { const t = createTracker(p); for (let i = 0; i < COLD + 12; i++) t.push(440, 0.95, true, 0.2); return t }
  const feed = (t: Tracker, cents: number[]) => cents.map(c => t.push(hz(c), 0.95, true, 0.2).a)
  /** 지켜보지 않는 트래커 — 한 음 안에서는 2.9.11 의 평활 그대로다 */
  const NO_HOLD = { ...DEFAULT_TRACKER, holdCents: Infinity }

  test('a bow change — three frames 30 to 40 ¢ flat, then back — leaves the line where it was; without the hold it sags 13 ¢ and takes 0.3 s to return', () => {
    const blip = [0, 0, -30, -39, -32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    for (const a of feed(steady(), blip)) expect(Math.abs(a)).toBeLessThan(0.5)
    const old = feed(steady(NO_HOLD), blip)
    expect(Math.min(...old)).toBeLessThan(-12); expect(old[old.length - 4]!).toBeLessThan(-1) // 0.25 s 뒤에도 아직 돌아오는 중
  })
  test('a longer blip of five scattered frames is still not followed: the frames never agree with each other', () => {
    for (const a of feed(steady(), [0, -12, -30, -34, -18, -8, 0, 0, 0, 0, 0, 0])) expect(Math.abs(a)).toBeLessThan(0.5)
  })
  test('a pitch that moves and stays (a peg nudged 25 ¢) is followed in one step when four frames agree — nothing in between is shown', () => {
    const out = feed(steady(), [0, 25, 25, 25, 25, 25, 25, 25, 25])
    for (const a of out.slice(0, 4)) expect(Math.abs(a)).toBeLessThan(0.5)        // 지켜보는 동안 선은 그 자리
    for (const a of out.slice(4)) expect(Math.abs(a - 25)).toBeLessThan(0.5)      // 네 프레임이 모이면 그 자리로
    const old = feed(steady(NO_HOLD), [0, 25, 25, 25, 25, 25, 25, 25, 25])
    expect(old.slice(1, 7).some(a => a > 5 && a < 20)).toBe(true); expect(Math.abs(old[8]! - 25)).toBeGreaterThan(2) // 지켜보지 않으면 사이값을 지나 0.17 s 뒤에도 덜 왔다
  })
  test('a slow peg turn (0.4 ¢ a frame ≈ 19 ¢/s) is followed exactly as without the hold', () => {
    const ramp = Array.from({ length: 80 }, (_, i) => -30 + 0.4 * i)
    const t0 = createTracker(), t1 = createTracker(NO_HOLD)
    for (let i = 0; i < COLD + 12; i++) { t0.push(hz(-30), 0.95, true, 0.2); t1.push(hz(-30), 0.95, true, 0.2) }
    expect(feed(t0, ramp)).toEqual(feed(t1, ramp))
  })
  test('vibrato ±15 ¢ at 5.5 Hz on a note that was steady: after its first cycle the line swings as without the hold', () => {
    const vib = Array.from({ length: 60 }, (_, i) => 15 * Math.sin(2 * Math.PI * 5.5 * i * 1024 / 48000))
    const a = feed(steady(), vib), b = feed(steady(NO_HOLD), vib)
    for (let i = 30; i < 60; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(0.5)
    expect(Math.max(...a.slice(30)) - Math.min(...a.slice(30))).toBeGreaterThan(6)
  })
  test('a new note that starts 25 ¢ flat for four scattered frames reads the settled pitch as soon as it settles — it does not creep there', () => {
    const t = steady()
    const outs = [175, 170, 178, 172, 200, 200, 200, 200, 200, 200].map(c => t.push(hz(c), 0.95, true, 0.2)) // 시4: 첫머리 네 프레임이 22~30 ¢ 낮고 흩어져 있다
    const k = outs.findIndex(o => o.midi === 71)
    expect(k).toBeGreaterThanOrEqual(0); expect(k).toBeLessThanOrEqual(3) // 흩어진 프레임 둘이 6 ¢ 안에 모이는 넷째 프레임(170 · 178 은 8 ¢ 떨어져 있다)
    for (const o of outs.slice(6)) { expect(o.midi).toBe(71); expect(Math.abs(o.a - 200)).toBeLessThan(0.5) } // 자리 잡은 값이 둘 들어오면 거기
  })
  test('a new note that trembles from its first frame (±15 ¢ at 5.5 Hz) is drawn exactly as without the hold: until its frames gather there is nothing to hold it to, and the line stays smoothed', () => {
    const note = Array.from({ length: 40 }, (_, i) => 200 + 15 * Math.sin(2 * Math.PI * 5.5 * i * 1024 / 48000)) // 시4 로 넘어가자마자 떤다
    const a = feed(steady(), note), b = feed(steady(NO_HOLD), note)
    for (let i = 0; i < 40; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(0.5)
    // 평활 없이 그 음의 최근 값을 그대로 그리면(모일 때까지) 떨림이 두 배로 그려진다 — 평활한 선은 ±15 ¢ 의 절반도 안 흔들린다
    expect(Math.max(...a.slice(8)) - Math.min(...a.slice(8))).toBeLessThan(15)
  })
  test('with the spread rule off, frames that neither return nor agree are adopted after holdMaxFrames — the line does not stay behind', () => {
    const t = steady({ ...DEFAULT_TRACKER, holdSpread: 0 })
    const out = feed(t, Array.from({ length: DEFAULT_TRACKER.holdMaxFrames + 1 }, (_, i) => (i % 2 ? 40 : 20)))
    for (const a of out.slice(0, DEFAULT_TRACKER.holdMaxFrames - 1)) expect(Math.abs(a)).toBeLessThan(0.5)
    expect(out[DEFAULT_TRACKER.holdMaxFrames - 1]!).toBeGreaterThan(19)
  })
  test('a changed reference pitch moves the watched frames with everything else', () => {
    const t = steady()
    feed(t, [20, 20])            // 두 프레임 지켜보는 중
    t.rebase(-20)                // 기준음을 올려 같은 소리가 0 ¢ 가 됐다 → 지켜보던 값도, 있던 자리(−20)도 같이 옮겨진다
    const out = feed(t, [0, 0, 0, 0])
    expect(Math.abs(out[1]! - 0)).toBeLessThan(0.5) // 옮겨진 값 넷이 모여 그 자리로
  })
})

describe('tracker: a new note name appears when two frames agree on it', () => {
  const hz = (c: number) => 440 * Math.pow(2, c / 1200)
  const steady = (p = DEFAULT_TRACKER): Tracker => { const t = createTracker(p); for (let i = 0; i < COLD + 12; i++) t.push(440, 0.95, true, 0.2); return t }
  const names = (t: Tracker, cents: number[]) => cents.map(c => t.push(hz(c), 0.95, true, 0.2).midi)

  test('a slide from la to si (30 ¢ a frame) does not flash the la sharp it passes through; si appears on the second frame that stays', () => {
    const slide = [30, 60, 90, 120, 150, 180, 200, 201, 200, 200]
    const out = names(steady(), slide)
    expect(new Set(out)).toEqual(new Set([69, 71]))
    expect(out.indexOf(71)).toBe(7)
    // 두 프레임이 모이기를 보지 않으면(2.9.11) 지나가는 라# 이 뜬다
    expect(names(steady({ ...DEFAULT_TRACKER, holdCents: Infinity }), slide)).toContain(70)
  })
  test('a clean change is as quick as before', () => {
    const clean = [0, 0, 203, 200, 200, 200]
    const out = names(steady(), clean)
    expect(out.indexOf(71)).toBe(4) // 중앙값 창(3)이 새 음으로 넘어가고 두 프레임
    expect(out).toEqual(names(steady({ ...DEFAULT_TRACKER, holdCents: Infinity }), clean))
  })
  test('a pitch that never settles (a slide that goes on) is not held on the old name: the name follows once rivalFrames frames have left the note', () => {
    const slide = Array.from({ length: 14 }, (_, i) => 70 + 30 * i)
    const k = names(steady(), slide).findIndex(m => m !== 69), was = names(steady({ ...DEFAULT_TRACKER, holdCents: Infinity }), slide).findIndex(m => m !== 69)
    expect(k - was).toBe(DEFAULT_TRACKER.rivalFrames - DEFAULT_TRACKER.switchFrames)
  })
  test('the two frames may sit either side of a dropout, and they still have to agree', () => {
    const t = steady(); names(t, [200, 203]); t.push(-1, 0, false, 0.2)
    expect(names(t, [201])).toEqual([71])
    const u = steady(); names(u, [200, 230]); u.push(-1, 0, false, 0.2)
    expect(names(u, [201, 200])).toEqual([69, 71])
  })
})
