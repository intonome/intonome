/**
 * 음 추적기 — 프레임별 (hz, conf) 를 받아 표시할 음/센트를 결정한다.
 * 신뢰도 가중 중앙값 → 음이름 히스테리시스(±switchCents, switchFrames 연속이면 전환) → 표시용 지수 평활.
 * 모든 계산은 A4=440 기준 절대 cents (a = 1200·log2(hz/440)). 기준음(refHz) 보정은 호출부에서.
 */
export interface TrackerParams {
  /** 후보로 인정할 최소 신뢰도 */
  confMin: number
  /** 무음에서 음을 새로 띄우는 데 필요한 연속 유효 프레임 수(첫 시작에는 깨끗하고 고른 음만 — 아니면 coldAcquireFrames) — 말소리 모음·새소리·딸깍은 그보다 짧거나 그동안 음높이가 미끄러진다.
   * 6 프레임 = 첫 음이 소리 시작 뒤 약 0.17 s 에 뜬다(48 kHz 기준 창 85 ms + 5 × 21 ms). 이어 켜는 동안의 음 바뀜과는 무관.
   * 7 은 쉬었다가 스피카토로 시작하는 음계(음마다 유효 4~5 프레임, 음이 바뀌면 처음부터)를 끝까지 못 띄웠다 — 6 은 둘째 음에서 띄운다 */
  acquireFrames: number
  /** 그 프레임들의 원시 추정이 중앙값에서 이만큼(cents) 안에 모여야 새로 띄운다 — 미끄러지는 피치·튀는 값은 음이 아니다. 처음부터 넓게(±30 ¢) 떠는 비브라토도 들어온다 */
  acquireCents: number
  /** 새로 띄우는 동안 이만큼 이어진 무효 프레임은 처음부터 다시 세지 않고 건너뛴다 — 시끄러운 곳(잡음이 연주만큼 큰 곳)에서 한 프레임씩 빠지는 탓에 첫 음이 0.7 s 까지 늦었다 */
  acquireGap: number
  /** 가중 중앙값 창 길이 (프레임) */
  medianLen: number
  /** 현재 음에서 이만큼(cents) 벗어나면 "다른 음 후보" */
  switchCents: number
  /** 다른 음 후보가 이 프레임 수만큼 연속되면 전환 */
  switchFrames: number
  /** 메트로놈 클릭과 겹친 프레임이면 전환에 이만큼 필요 — 클릭과 연주 음이 섞여 생긴 가상 기본음(예: C#6 + 클릭 → F#5)이 두 프레임 이어진다(실측) */
  clickSwitchFrames: number
  /** 유효 프레임이 끊긴 뒤 표시를 유지하는 프레임 수 — 활을 들었다 놓는 틈(≈ 0.3 s)에 음이름이 사라졌다 나오지 않게 */
  releaseFrames: number
  /** 다른 음으로 바꾸는데 (가) 이번 프레임이 그 음을 가리키지 않거나(읽는 값이 여러 음 사이를 오간다) (나) 화면의 음이 그대로 울리는 중이고 새 음이 그보다 훨씬 약하면,
   * 후보가 이 프레임 수만큼 이어져야 바꾼다 — 사람 많은 곳에서 남의 소리가 섞인 프레임이 내 음을 옥타브·5도 아래나 남의 음으로 잠깐씩 바꿔 놓는다(틀린 구간의 절반이 0.1 s 이하).
   * 진짜로 바꿔 켠 음은 이전 음이 멎거나 그만큼 세서 switchFrames 로 바뀐다. 늦추는 것은 유효 프레임으로 이 값까지라 화면이 옛 음에 붙들리지 않는다.
   * 바늘에서 switchCents 안의 후보(슬라이드)는 이 규칙과 무관하게 바늘이 따라간다 */
  rivalFrames: number
  /** 첫 시작(켠 뒤 · 연주한 음 없이 coldAfterFrames 가 지난 뒤)에 깨끗하고 고른 음이 아니면(아래 coldSteady…) 새로 띄우는 데 필요한 유효 프레임 수.
   * 18 프레임 = 소리 시작 뒤 약 0.45 s(48 kHz 기준 창 85 ms + 17 × 21 ms, 기기 화면에서는 0.55~0.6 s — T1 과 비슷하다). 실제 대화 녹음(2 분)을 켜 두기만 한 튜너에 들려주면
   * 뜨는 횟수가 6 프레임(2.9.9) 14.5 번/분 → 14 프레임 6.1 → 16 프레임 4.2 → 18 프레임 2.3 → 22 프레임 1.9. 18 이 꺾이는 곳이다 */
  coldAcquireFrames: number
  /** 첫 시작에서 그 프레임들 가운데 이만큼은 acquireCents 밖이어도 된다 — 사람 많은 곳에서는 남의 소리가 섞인 프레임이 열에 하나쯤 튄다. 다 모여야 하면 첫 음이 2.5 s 까지 늦었다 */
  coldAcquireOutliers: number
  /** 첫 시작에서 건너뛰는 무효 프레임 수(acquireGap 대신) — 같은 이유 */
  coldAcquireGap: number
  /** 첫 시작이라도 깨끗하고 고른 음은 연주 중과 똑같이 acquireFrames 로 띄운다(끊김도 acquireGap 까지만) — 그 프레임들이 모두 가중 중앙값에서 이만큼(cents) 안이고 신뢰도가 coldSteadyConf 이상.
   * 뜯은 현 · 활로 그은 개방현 · 하모닉스는 이렇게 고르고 깨끗하다. 여리고 짧게 뜯은 미 현(감쇠 τ 0.1 s)은 유효 프레임이 7 개뿐이라 18 프레임을 기다리면 안 떴다.
   * ±5 ¢ 는 그 피치카토가 2.9.9 와 똑같이 뜨는 가장 좁은 값(±4 는 둘이 빠졌다) — 비브라토 · 말하는 억양은 넘는다 */
  coldSteadyCents: number
  /** 그 '깨끗함' — YIN 신뢰도(1 − CMND). 0.9 는 YIN 의 기본 문턱(CMND 0.1)에 해당하는 값. 실제 대화 · 낭독(62명, 16 분)은 고르기만 하면(신뢰도 무관) 뜬 횟수가 2.5 → 7.8 번/분,
   * 0.9 를 더하면 2.9 번/분(2.9.9 는 14.8) — 말소리는 고른 순간에도 주기가 덜 깨끗하다 */
  coldSteadyConf: number
  /** 한 음이름으로 이만큼(유효 프레임) 이어진 음이 뜨면 '연주한 음' 이다 — 그 뒤 coldAfterFrames 동안은 acquireFrames 로 띄운다. 47 ≈ 1 s(48 kHz) — 망설임 소리('어~', 0.3~0.6 s)는 못 미치고
   * 조율하며 긋는 음은 넘는다. 실제 대화 녹음(2 분 반)은 6 프레임으로 띄워도 한 번도 넘지 않았다. 0.36 s(14 프레임)로 하면 말소리 조각이 넘어 켜 두기만 한 곳에서 금방 '연주 중' 이 됐다 */
  warmNoteFrames: number
  /** 연주한 음이 마지막으로 보인 뒤 이만큼(프레임) 지나면 다음 음을 첫 시작으로 본다. 1406 ≈ 30 s(48 kHz) — 연습 중 쉼 · 악보 보기는 덮고,
   * 조율하고 내려놓은 뒤 이어지는 말소리는 30 s 뒤부터 막는다. 화면에 무엇이 뜨든(말소리 포함) 이 시계는 연주한 음만 되돌린다 */
  coldAfterFrames: number
  /** 선(표시 cents)이 받아들인 최근 값에서 이만큼(cents) 넘게 떨어진 프레임은 바로 따라가지 않고 지켜본다 — 활을 바꾸는 순간·음의 첫머리에는 측정값이 몇 프레임 튀었다 돌아온다.
   * 실제 연습 녹음(바이올린 9 분)에서 음높이가 가만한 동안의 프레임은 96 % 가 6 ¢ 안이고(90 % 는 2.6 ¢ 안), 넘는 것은 20~40 ¢ 까지 가는 튐이었다. 평활이 그 튐을 0.2~0.4 s 짜리 골로 늘여 그렸다 */
  holdCents: number
  /** 그 거리는 그 음의 최근 흔들림에 맞춘다: 최근 프레임들의 흔들림(중앙값에서의 절대 편차의 중앙값 × 1.4826)의 이 배수와 holdCents 중 큰 쪽.
   * 비브라토 · 줄감개처럼 이어지는 움직임은 흔들림이 커져 지켜보지 않고 그대로 따라간다 */
  holdSpread: number
  /** 지켜보는 프레임이 이만큼 이어지고 서로 holdCents 안에 모여 있으면 음높이가 옮겨 간 것 — 그 자리(중앙값)로 한 번에 간다. 돌아오면 튄 것이라 선은 움직이지 않는다.
   * 같은 녹음에서 튀었다 돌아온 356 번 중 99 % 가 5 프레임 안에 돌아왔고, 그 4~5 프레임짜리는 값이 흩어져 있어 모인 것으로 보이지 않았다 */
  holdFrames: number
  /** 이만큼 지켜보도록 돌아오지도 모이지도 않으면 최근 holdFrames 의 자리로 간다 — 선이 옛 자리에 붙들리지 않게. 새 음의 첫머리도 같다(90 % 가 7 프레임 안에 모였다) */
  holdMaxFrames: number
}
/** cents 는 가장 가까운 음에서의 편차이므로 정의상 이 값을 넘을 수 없다 */
const HALF_SEMITONE = 50
/** 선이 '있던 자리' = 받아들인 최근 이만큼의 중앙값(0.1 s) */
const HOLD_BASE = 5
/** 흔들림을 재는 길이 — 비브라토 한 주기(5.5 Hz 에서 8.5 프레임)가 들어간다 */
const HOLD_RECENT = 9
export const DEFAULT_TRACKER: TrackerParams = { confMin: 0.5, acquireFrames: 6, acquireCents: 40, acquireGap: 1, medianLen: 3, switchCents: 65, switchFrames: 2, clickSwitchFrames: 3, releaseFrames: 20, rivalFrames: 8, coldAcquireFrames: 18, coldAcquireOutliers: 2, coldAcquireGap: 2, coldSteadyCents: 5, coldSteadyConf: 0.9, warmNoteFrames: 47, coldAfterFrames: 1406, holdCents: 6, holdSpread: 3, holdFrames: 4, holdMaxFrames: 10 }

/** @property held 유효 프레임이 끊겨 직전 값을 그대로 다시 내보낸 횟수 (0 = 방금 측정한 값). 트레이스가 유지 프레임을 구분하는 데 쓴다
 * @property settling 음이름이 바뀐 프레임과 그 뒤 medianLen 프레임 — 창과 중앙값에 이전 음이 섞여 있다. 읽는 값(숫자)의 평균에 넣지 않는다 */
export interface TrackOut { hz: number; midi: number; a: number; held: number; settling: boolean }
const NONE: TrackOut = { hz: -1, midi: -1, a: NaN, held: 0, settling: false }

export interface Tracker {
  /** @param hz 원시 추정 (-1 없음) @param conf 0..1 @param valid RMS 게이트 등 외부 조건 @param alpha 평활 계수 @param click 메트로놈 클릭과 겹친 프레임
   * @param weakRival 후보 음(candA)이 화면의 음(shownA)보다 훨씬 약한가 — 둘 다 A4=440 기준 절대 cents. 이 프레임의 스펙트럼으로 호출부가 답한다 */
  push(hz: number, conf: number, valid: boolean, alpha: number, click?: boolean, weakRival?: (candA: number, shownA: number) => boolean): TrackOut
  reset(): void
  /** 기준음(A=)이 바뀌었다: 정규화 공간의 모든 값을 deltaCents 만큼 옮기고 음이름을 바로 다시 붙인다 — 평활로 0.3~0.9 s 에 걸쳐 따라가지 않게 */
  rebase(deltaCents: number): void
  /** 지금 표시 중인 값(마지막 출력). 음이 없으면 hz −1. 상태를 바꾸지 않는다 */
  current(): TrackOut
  /** 지금이 첫 시작인가 — 켠 뒤, 또는 연주한 음(warmNoteFrames) 없이 coldAfterFrames 가 지났다. 다음에 새로 띄우는 음은 첫 시작 조건이다 */
  firstStart(): boolean
}

export function createTracker(p: TrackerParams = DEFAULT_TRACKER): Tracker {
  const candA: number[] = [], candW: number[] = []
  /** 무음에서 새로 띄우기 전, 지금 이어지는 유효 프레임들의 원시 추정(최근 need 개) — 중앙값 창보다 길게 볼 수 있다 */
  const acqA: number[] = [], acqW: number[] = []
  /** acqRun: 끊김 없이(acquireGap 까지는 이어진 것으로) 이어진 유효 프레임 수 — 첫 시작의 깨끗한 길이 연주 중의 6 프레임과 같은 조건이게 */
  let acqRun = 0, acqMiss = 0, midi = -1, dispA = NaN, outside = 0, miss = 0, errSign = 0, sameSignRun = 0, settle = 0
  /** cold: 지금 이어지는 띄우기가 첫 시작 조건인가(그 구간이 시작될 때 정한다). heldRun: 보이는 음이름이 이어진 유효 프레임 수(띄울 때는 띄운 근거의 프레임 수 — 6 또는 coldAcquireFrames).
   * sincePlayed: 연주한 음(warmNoteFrames)이 마지막으로 보인 뒤 지난 프레임 수 — 처음엔 무한(켠 뒤 첫 시작) */
  let cold = true, heldRun = 0, sincePlayed = Infinity
  /** accA·accW: 선이 받아들인 최근 값과 신뢰도(null = 새 음이 아직 자리 잡는 중). pendA·pendW: 지켜보는 값. recent: 이 음에서 최근 받은 값 전부(흔들림 크기) */
  let accA: number[] | null = null, accW: number[] = [], pendA: number[] = [], pendW: number[] = [], recent: number[] = []
  let last: TrackOut = NONE
  /** 바로 앞 유효 프레임의 값 — 새 음이름을 띄울 때 이번 프레임과 모였는지 본다 */
  let prevA = NaN

  function weightedMedian(A: number[] = candA, Wt: number[] = candW): number {
    const idx = A.map((_, i) => i).sort((i, j) => A[i]! - A[j]!)
    const total = Wt.reduce((s, w) => s + w, 0); let acc = 0
    for (const i of idx) { acc += Wt[i]!; if (acc >= total / 2) return A[i]! }
    return A[idx[idx.length - 1]!]!
  }
  const median = (v: number[]): number => { const q = [...v].sort((x, y) => x - y), h = q.length >> 1; return q.length % 2 ? q[h]! : (q[h - 1]! + q[h]!) / 2 }
  /** 이 음의 최근 흔들림으로 본 '동떨어진' 거리 */
  function farCents(): number {
    if (recent.length < HOLD_BASE) return p.holdCents
    const m = median(recent)
    return Math.max(p.holdCents, p.holdSpread * 1.4826 * median(recent.map(x => Math.abs(x - m))))
  }
  /** 지켜보던 값이 한 자리에 모였거나 holdMaxFrames 가 찼으면 그 값들을 선이 받아들인 값으로 삼는다 */
  function gathered(): boolean {
    if (pendA.length < p.holdFrames) return false
    const last = pendA.slice(-p.holdFrames)
    if (Math.max(...last) - Math.min(...last) > p.holdCents && pendA.length < p.holdMaxFrames) return false
    accA = last; accW = pendW.slice(-p.holdFrames); pendA = []; pendW = []; errSign = 0; sameSignRun = 0
    return true
  }
  /** 선을 값 쪽으로 평활해 옮긴다. 적응 평활: 오차가 크고 한 방향으로 4프레임 이상 계속될 때만 빠르게 따라붙는다 — 비브라토는 부호가 3–4프레임마다 바뀐다 */
  function ease(to: number, alpha: number): void {
    const diff = to - dispA, err = Math.abs(diff), sign = diff > 0 ? 1 : diff < 0 ? -1 : 0
    sameSignRun = sign !== 0 && sign === errSign ? sameSignRun + 1 : 1; errSign = sign
    dispA += diff * (alpha + (1 - alpha) * (sameSignRun >= 4 ? Math.min(1, Math.max(0, (err - 30) / 60)) : 0))
  }
  /** 선이 이 프레임을 받는다. 받아들인 값에서 동떨어졌으면 지켜보고(선은 그 자리), 아니면 받아들인 값들의 가중 중앙값을 평활로 따라간다 */
  function follow(a: number, conf: number, alpha: number, settling: boolean): void {
    const far = farCents()
    recent.push(a); if (recent.length > HOLD_RECENT) recent.shift()
    if (accA === null) {
      // 새 음이 자리 잡는 중: 아직 받아들인 값이 없어 지켜볼 기준도 없다 — 그 음의 최근 값(가중 중앙값)을 그대로 따라간다.
      // 중앙값 창이 새 음으로 차는 동안(settling)은 평활 없이, 그 뒤로는 평활해서. 값이 한 자리에 모이면 그때부터 그 자리가 기준이다.
      // 첫머리부터 떠는 음(비브라토)은 모이지 않는다 — 평활 없이 따라가면 선이 떨림을 그대로 그려 숫자·초록이 두 배로 바빴다
      pendA.push(a); pendW.push(conf)
      const to = weightedMedian(pendA.slice(-p.medianLen), pendW.slice(-p.medianLen))
      if (settling) dispA = to
      else ease(to, alpha)
      if (settle === 0) gathered()
      return
    }
    if (Math.abs(a - median(accA.slice(-HOLD_BASE))) > far) { pendA.push(a); pendW.push(conf); if (gathered()) dispA = median(accA); return }
    pendA = []; pendW = []
    accA.push(a); accW.push(conf); if (accA.length > HOLD_RECENT) { accA.shift(); accW.shift() }
    ease(weightedMedian(accA.slice(-p.medianLen), accW.slice(-p.medianLen)), alpha)
  }
  /** 음이 끝나 표시를 놓는다 — 연주한 음의 시계는 그대로 */
  function release(): void { prevA = NaN; accA = null; accW = []; pendA = []; pendW = []; recent = []; candA.length = 0; candW.length = 0; acqA.length = 0; acqW.length = 0; acqRun = 0; acqMiss = 0; midi = -1; dispA = NaN; outside = 0; miss = 0; errSign = 0; sameSignRun = 0; settle = 0; heldRun = 0; last = NONE }
  /** 처음부터 — 다음 음은 첫 시작이다 */
  function reset(): void { release(); sincePlayed = Infinity }
  /** 연주한 음의 시계: 한 음이름이 warmNoteFrames 이어진 음이 보이는 동안 0, 아니면 한 프레임씩 — 말소리가 떠도 되돌리지 않는다 */
  function done(o: TrackOut): TrackOut {
    sincePlayed = o.hz > 0 && heldRun >= p.warmNoteFrames ? 0 : sincePlayed + 1
    return o
  }
  const out = (settling = false): TrackOut => { last = { hz: 440 * Math.pow(2, dispA / 1200), midi, a: dispA, held: 0, settling }; return last }

  return {
    reset,
    firstStart: () => sincePlayed >= p.coldAfterFrames,
    current: () => (midi === -1 ? NONE : last),
    rebase(delta) {
      if (!delta) return
      for (let i = 0; i < candA.length; i++) candA[i] = candA[i]! + delta
      for (let i = 0; i < acqA.length; i++) acqA[i] = acqA[i]! + delta
      if (accA) accA = accA.map(v => v + delta)
      pendA = pendA.map(v => v + delta); recent = recent.map(v => v + delta); prevA += delta
      if (midi === -1 || Number.isNaN(dispA)) return
      dispA += delta
      const was = midi; midi = Math.round(dispA / 100) + 69; outside = 0 // 라벨은 옮긴 값에서 바로 — 평활 창을 기다리지 않는다
      if (last.hz > 0) last = { ...last, hz: 440 * Math.pow(2, dispA / 1200), midi, a: dispA }
      if (midi !== was) settle = 0 // 음이름이 바뀌어도 창의 값은 전부 새 기준으로 옮겨져 있어 '섞인' 프레임이 없다
    },
    push(hz, conf, valid, alpha, click = false, weakRival) {
      const ok = valid && hz > 0 && conf >= p.confMin
      if (!ok) {
        if (++acqMiss > p.acquireGap) acqRun = 0
        if (acqMiss > (cold ? p.coldAcquireGap : p.acquireGap)) { acqA.length = 0; acqW.length = 0 }
        if (midi === -1) return done(NONE)
        if (++miss > p.releaseFrames) { release(); return done(NONE) }
        return done({ ...last, held: miss }) // 짧은 끊김은 마지막 표시 유지 (몇 번째 유지인지 알려준다)
      }
      miss = 0; acqMiss = 0
      const a = 1200 * Math.log2(hz / 440)
      candA.push(a); candW.push(conf); if (candA.length > p.medianLen) { candA.shift(); candW.shift() }
      const med = weightedMedian()
      if (midi === -1) {
        // 새로 띄우기: 같은 음으로 need 프레임 연속 — 한 프레임의 높은 신뢰도만으로 띄우면 주변 말소리·새소리가 틱틱 뜬다.
        // 연주한 음 없이 coldAfterFrames 가 지났으면(첫 시작) coldAcquireFrames — 켜 두기만 한 곳의 말소리가 뜨지 않게
        if (!acqA.length) cold = sincePlayed >= p.coldAfterFrames
        acqRun++
        const need = cold ? p.coldAcquireFrames : p.acquireFrames
        acqA.push(a); acqW.push(conf); if (acqA.length > need) { acqA.shift(); acqW.shift() }
        const acqMed = weightedMedian(acqA, acqW)
        // 첫 시작이라도 마지막 acquireFrames 가 깨끗하고 고르면(뜯은 현 · 그은 개방현) 연주 중처럼 바로 — 그 프레임들의 가중 중앙값에서 시작한다
        let steady = NaN
        const n = p.acquireFrames
        if (cold && acqRun >= n && acqA.length >= n) {
          const tA = acqA.slice(-n), tW = acqW.slice(-n), m = weightedMedian(tA, tW)
          if (tA.every(x => Math.abs(x - m) <= p.coldSteadyCents) && tW.every(c => c >= p.coldSteadyConf)) steady = m
        }
        if (Number.isNaN(steady) && (acqA.length < need || acqA.filter(x => Math.abs(x - acqMed) > p.acquireCents).length > (cold ? p.coldAcquireOutliers : 0))) return done(NONE)
        acqA.length = 0; acqW.length = 0; acqRun = 0
        // 첫 시작은 모은 값(가중 중앙값)에서 시작한다 — 0.45 s 면 비브라토가 한창이라 마지막 세 프레임이면 한쪽 끝(±12 ¢)에서 시작해 숫자가 0.3 s 동안 흘렀다
        const start = !Number.isNaN(steady) ? steady : cold ? acqMed : med
        midi = Math.round(start / 100) + 69; dispA = start; outside = 0; heldRun = Number.isNaN(steady) ? need : n
        accA = candA.slice(); accW = candW.slice(); pendA = []; pendW = []; recent = candA.slice()
        return done(out())
      }
      // 표시값은 받아들인 값의 중앙값을 따라가고(평활), 음이름 라벨만 히스테리시스로 바뀐다.
      const dev = med - (midi - 69) * 100
      // 선은 이 프레임의 값이 지금 음의 띠 안에 있거나(보통) 선 가까이 있을 때(라벨이 아직 안 바뀐 슬라이드) 받는다. 둘 다 아니면 — 멀리 떨어진 다른 음 후보 —
      // 확인(switchFrames)되기 전엔 끌려가지 않는다: 한 옥타브 떨어진 후보로 미끄러지는 동안 낸 적 없는 중간 음이 화면에 뜨기 때문
      const settling = settle > 0
      if (settling && Math.abs(dev) <= p.switchCents) settle--
      if (Math.abs(a - (midi - 69) * 100) <= p.switchCents || Math.abs(a - dispA) <= p.switchCents) follow(a, conf, alpha, settling)
      const was = midi
      if (Math.abs(dev) <= p.switchCents) outside = 0
      else {
        let need = click ? p.clickSwitchFrames : p.switchFrames
        if (Math.abs(a - med) > HALF_SEMITONE || weakRival?.(med, dispA)) need = Math.max(need, p.rivalFrames)
        // 새 음이름은 마지막 두 프레임이 서로 holdCents 안에 모였을 때 띄운다 — 음이 바뀌는 순간(창이 두 음에 걸친다)과 미끄러지는 중의 프레임은 값이 프레임마다 달라서,
        // 낸 적 없는 사이 음이름이 0.1 s 스쳤다(실제 연습 녹음 9 분에서 0.13 s 못 되는 음이름 124 번 가운데 76 번이 이것이었다). 기다리는 것은 rivalFrames 까지 — 화면이 옛 음에 붙들리지 않는다
        if (++outside >= need && (!(Math.abs(a - prevA) > p.holdCents) || outside >= Math.max(need, p.rivalFrames))) {
          midi = Math.round(med / 100) + 69; outside = 0
          // 새 음은 자리 잡을 때까지 그 음의 최근 값에서 — 이전 음의 평활을 이어 가면 이전 음 쪽 값이 새 음의 선·숫자를 0.2~0.4 s 끌어당긴다(반음 슬러·포지션 이동)
          const note = (midi - 69) * 100, keep = candA.map((v, i) => i).filter(i => Math.abs(candA[i]! - note) <= p.switchCents)
          accA = null; accW = []; pendA = keep.map(i => candA[i]!); pendW = keep.map(i => candW[i]!); recent = pendA.slice()
          dispA = pendA.length ? weightedMedian(pendA.slice(-p.medianLen), pendW.slice(-p.medianLen)) : med
        }
      }
      // 표시 일관성: 부스트가 dispA 를 한 프레임에 새 음까지 옮겨도 라벨은 switchFrames 를 기다리므로, ±50 ¢ 를 넘으면 라벨을 즉시 맞춘다.
      // 이때 중앙값은 대개 이미 새 음 쪽에 있다 — 그 값에서 시작한다(평활값이면 새 음이 ∓49 ¢ 로 시작한다)
      if (Math.abs(dispA - (midi - 69) * 100) > HALF_SEMITONE) {
        midi = Math.round(dispA / 100) + 69; outside = 0
        if (Math.abs(med - (midi - 69) * 100) <= HALF_SEMITONE) dispA = med
      }
      if (midi !== was) settle = p.medianLen
      heldRun = midi !== was ? 1 : heldRun + 1
      prevA = a
      return done(out(settling || midi !== was))
    },
  }
}
