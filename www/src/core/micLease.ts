/**
 * 마이크를 잠시 놓는 규칙(화면 숨김·편집기). 순수 — 무엇을 할지만 정하고, 실행은 조립 지점(main)이 한다.
 */
export interface MicNow { micOpen: boolean; opening: boolean; recording: boolean }
/** close = 열린 마이크를 닫는다 · cancel = 여는 중인 열기를 무효로(뒤에서 열린 채 남지 않게) · keep = 그대로(녹음 중이면 놓지 않는다) */
export type Release = 'close' | 'cancel' | 'keep'
export function release(m: MicNow): Release {
  if (m.micOpen && !m.recording) return 'close'
  if (m.opening) return 'cancel'
  return 'keep'
}

export interface HideNow extends MicNow { native: boolean; metroPlaying: boolean }
export interface HidePlan {
  /** Android 앱은 백그라운드 마이크를 무음으로 만든다 — 무음 파일이 되기 전에 녹음을 끝내 저장한다(저장 결과는 녹음 쪽이 알린다) */
  stopRec: boolean
  stopMetro: boolean
  release: Release
}
/** 화면이 숨겨질 때. 드론·A 듣기는 늘 멈춘다(호출부). 소리를 멈췄다고 따로 알리지 않는다 — 숨긴 것은 사용자이고, 돌아오면 ▶ 가 보인다 */
export function onHide(h: HideNow): HidePlan {
  const stopRec = h.native && h.recording
  return { stopRec, stopMetro: h.metroPlaying, release: release({ ...h, recording: h.recording && !stopRec }) }
}
