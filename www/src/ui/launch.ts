/**
 * 첫 화면을 앱이 다 그려진 뒤 걷는다 — 아이폰 홈 화면 웹앱은 스플래시와 똑같이 그려 둔 index.html #launch(다른 곳에서는 이미 지워져 없다),
 * 안드로이드 앱은 시스템 시작 화면과 그 밑에서 앱을 덮고 있는 바탕색 덮개(#launch.cover)
 */
import { hideNativeSplash } from '../platform/index.ts'
const LAUNCH_FADE_MS = 250
/** 글꼴을 이만큼까지만 기다린다(글자가 바뀌는 게 보이지 않게, 그래도 늦지 않게) */
const LAUNCH_FONT_WAIT_MS = 500
/** 안드로이드 시스템 시작 화면이 흐려지는 시간 — capacitor.config 의 launchFadeOutDuration 과 같아야 한다(splash.test.mjs) */
export const NATIVE_SPLASH_FADE_MS = 150
/** 걷으라는 말이 전해진 뒤 시스템이 흐리기를 시작하기까지의 여유 — 앱 창이 한 번 그려지고 시작 화면이 앱으로 넘어온 뒤에 시작한다 */
const NATIVE_SPLASH_SETTLE_MS = 100

export function hideLaunch(): void {
  const el = document.getElementById('launch')
  const fade = (): void => { if (el) { el.classList.add('out'); setTimeout(() => el.remove(), LAUNCH_FADE_MS + 50) } }
  const go = (): void => { requestAnimationFrame(() => requestAnimationFrame(() => {
    // 안드로이드 앱: 로고가 바탕색 위에서 먼저 사라지고, 그 뒤에 덮개를 걷어 앱이 나타난다 — 같이 걷으면 로고가 튜너 한가운데에 겹쳐 비친다
    if (el?.classList.contains('cover')) void hideNativeSplash().then(() => setTimeout(fade, NATIVE_SPLASH_FADE_MS + NATIVE_SPLASH_SETTLE_MS))
    else { void hideNativeSplash(); fade() }
  })) }
  Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, LAUNCH_FONT_WAIT_MS))]).then(go, go)
}
