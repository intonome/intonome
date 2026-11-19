/**
 * 세이코식 박 표시의 수학. 화면은 ui/metro.ts 가 그린다.
 * 막대는 한 박에 한쪽 끝에서 반대쪽 끝까지 직선으로 가고(박마다 방향 반전), 박은 끝에서, 분할은 사이에서 울린다.
 */
import type { Pattern } from './sequencer.ts'
import { totalTicks, tickKind } from './sequencer.ts'

type P = Pick<Pattern, 'bpm' | 'timeSig' | 'subDiv'>

/** 큰 박의 개수. 6/8 은 8분음표 6개지만 큰 박은 둘(점4분음표 × 2) */
export const beatCount = (p: Pick<Pattern, 'timeSig'>): number => p.timeSig === 6 ? 2 : p.timeSig

/** 한 박(막대가 한쪽 끝에서 반대 끝까지 가는 시간) — 초. bpm 은 늘 박 단위(6/8 은 ♩.) */
export const beatDurS = (p: P): number => 60 / p.bpm

/** 큰 박 하나 안의 틱 수 */
export const ticksPerBeat = (p: Pick<Pattern, 'timeSig' | 'subDiv'>): number => totalTicks(p) / beatCount(p)


/** 이 틱이 큰 박의 시작인가 — 막대가 끝에 닿는 순간 */
export const isBeatStart = (p: Pick<Pattern, 'timeSig' | 'subDiv'>, tick: number): boolean => tick % ticksPerBeat(p) === 0


/** 막대의 가로 위치 (0 = 왼쪽 끝, 1 = 오른쪽 끝). phase = 박 이후 지난 비율, dir +1 왼→오. phase ≥ 1 이면 끝에 머문다 */
export function sweepX(phase: number, dir: 1 | -1): number {
  const t = Math.min(1, Math.max(0, phase))
  return dir === 1 ? t : 1 - t
}

/** LED 줄(N개)에서 위치 x(0~1)에 해당하는 인덱스 — 양 끝이 정확히 0 과 N−1 */
export const ledIndex = (x: number, n: number): number => Math.round(Math.min(1, Math.max(0, x)) * (n - 1))

/** 이 틱이 LED 줄에서 어느 칸을 때리나: 박 시작이면 방향에 따라 끝 칸, 분할이면 사이 칸 */
export function hitIndex(p: Pick<Pattern, 'timeSig' | 'subDiv'>, tick: number, dir: 1 | -1, n: number): number {
  const per = ticksPerBeat(p), k = tick % per
  const x = k === 0 ? 0 : (p.subDiv === 'd' && p.timeSig !== 6 ? 0.75 : k / per)
  return ledIndex(dir === 1 ? x : 1 - x, n)
}

/** 점·카드 번쩍임이 쓰는 박 종류. 소리(tickKind)와 같되, 박자표 없음은 마디가 없어 매 박이 기준점이라 첫 박처럼 보인다(소리는 그대로 '박') */
export function lightKind(p: Pick<Pattern, 'timeSig' | 'subDiv'>, tick: number): 'accent' | 'beat' | 'sub' {
  const k = tickKind(p, tick)
  return p.timeSig === 1 && k === 'beat' ? 'accent' : k
}

/** 카드 번쩍임 길이(초): 접힘(면 + 테) .22 s · 펼침·전용(테만) .42 s. 다음 번쩍임까지의 60 % 를 넘지 않는다 — 빠른 박에서 늘 켜져 있지 않게 */
export const FLASH_FACE_S = 0.22, FLASH_RING_S = 0.42
export function flashDurS(p: P, base: number): number {
  const every = beatDurS(p) * (p.timeSig === 1 ? 1 : beatCount(p))
  return Math.min(base, every * 0.6)
}
