/**
 * 큰 화면 맞춤 — 폰과 같은 한 화면을 그대로 키운다. 순수.
 * 창(dp)이 폰보다 넓고 높으면, 배치가 놓이는 폭을 줄여(= 브라우저가 그만큼 전체를 확대) 폰에서와 같은 비율로 보이게 한다.
 * 넓기만 하고 낮은 창(폴드 펼침 · 가로)은 높이가 허락하는 만큼만 키우고, 남는 폭은 본문 칸이 넓어져 쓴다(style.css --col).
 */
/** 키운 뒤에도 남겨야 하는 배치 폭 · 높이 — 이보다 좁거나 낮아지게 키우지 않는다(튜너 + 펼친 메트로놈이 한 화면에 드는 크기) */
export const FIT_MIN_W = 480, FIT_MIN_H = 780
/** 가장 크게 키우는 배율 — 13인치 태블릿 세로에서 폰의 약 두 배 */
export const FIT_MAX = 2

/** 가로로 넓은 창(폭 760 이상 · 높이 640 이상 · 폭이 높이의 1.2 배 이상)은 튜너 | 메트로놈 두 칸 — 이때 남겨야 하는 배치 폭 · 높이.
 *  높이 640 은 옆 칸의 메트로놈(다이얼 · 버튼 · 박자 · 분할)이 잘리지 않고 드는 높이 — 그보다 낮은 가로 창은 한 칸 그대로다 */
export const PANE_MIN_W = 760, PANE_ASPECT = 1.2, PANE_FIT_W = 1000, PANE_FIT_H = 640
export const isPaneWindow = (w: number, h: number): boolean => w >= PANE_MIN_W && h >= PANE_FIT_H && w / h >= PANE_ASPECT
/** 같은 조건의 미디어 쿼리 — 배치 크기 기준. 두 칸 창은 키운 뒤에도 폭 760 · 높이 640 이상이고 비율은 그대로라 창 크기로 잰 것과 같은 답이 나온다(높이는 반올림 몫으로 1 px 여유) */
export const PANE_QUERY = `(min-width:${PANE_MIN_W}px) and (min-height:${PANE_FIT_H - 1}px) and (min-aspect-ratio:6/5)`

/** 창 W × H(dp)에 쓸 확대 배율. 폰(폭 480 이하)과 낮은 창은 1 */
export function fitScale(w: number, h: number): number {
  if (!(w > 0) || !(h > 0)) return 1
  if (isPaneWindow(w, h)) return Math.max(1, Math.min(FIT_MAX, w / PANE_FIT_W, h / PANE_FIT_H))
  return Math.max(1, Math.min(FIT_MAX, w / FIT_MIN_W, h / FIT_MIN_H))
}
/** 배치가 놓일 폭(dp). 배율이 1 이면 창 폭 그대로 */
export function fitWidth(w: number, h: number): number { return Math.round(w / fitScale(w, h)) }
