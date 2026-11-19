import { SETTINGS_KEY } from './settings.ts'

/** 처음 안내를 봤는가. 'new' = 아직(하다 말고 껐으면 다음에 처음부터), 'done' = 봤거나 그만뒀다 */
export const TOUR_KEY = 'intonome_tour_v1'

/** 이번 실행에 안내를 띄울까. 키가 없으면 정한다: 저장된 설정이 없던 첫 실행이면 'new', 이미 쓰던 기기(업데이트로 받은 사람)는 'done'.
 * 저장이 안 되는 곳(프라이빗 모드 등)에서는 띄우지 않는다 — 매번 처음부터 뜨게 된다 */
export function tourPending(firstRun: boolean): boolean {
  try {
    const v = localStorage.getItem(TOUR_KEY)
    if (v === 'done') return false
    if (v === null) { localStorage.setItem(TOUR_KEY, firstRun ? 'new' : 'done'); return firstRun }
    return true
  } catch { return false }
}
/** 새로 설치한 기기인가: 저장된 설정이 없다. 설정을 한 번도 바꾸지 않은 기존 사용자는 안내 키(TOUR_KEY)가 이미 있어 tourPending 이 가른다 */
export function isNewInstall(): boolean {
  try { return localStorage.getItem(SETTINGS_KEY) === null } catch { return false }
}
export function markTourDone(): void { try { localStorage.setItem(TOUR_KEY, 'done') } catch { /* 다음 실행에 다시 뜰 뿐 */ } }
