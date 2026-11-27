/** 플랫폼 분기 (웹 / iOS 웹 / Capacitor Android). 나머지 코드는 이 모듈의 함수만 호출한다 */
import { fitScale, fitWidth, PANE_QUERY } from '../core/fit.ts'
import { t } from '../core/i18n/index.ts'
import { notice, noticeListening } from '../core/notice.ts'
declare global { interface Window { Capacitor?: unknown } }

export const isNative = (): boolean => typeof window !== 'undefined' && !!window.Capacitor

/** Safari(iOS 포함). 크로미움계는 UA 에 Chrome/CriOS 가 있다 */
export const isSafari = (): boolean => typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|Chromium|Edg|FxiOS/.test(navigator.userAgent)
/** iOS / iPadOS. UA 를 보는 유일한 곳 — iPadOS 13+ 는 'MacIntel' 로 위장하므로 터치 포인트로 가른다 */
export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const p = navigator.platform || ''
  return /iPad|iPhone|iPod/.test(p) || (p === 'MacIntel' && navigator.maxTouchPoints > 1) || /iPad|iPhone|iPod/.test(navigator.userAgent)
}

/** 앱(Capacitor)이면 body 에 표식. 상태바 색은 setStatusBarTheme */
/** 홈 화면 앱이 상태바 밑까지 그려지는지(위쪽 safe-area > 0) 재서 html.sb-under 로 알린다 — style.css 가 그때만 높이를 lvh 로 */
export function fitStandaloneHeight(): void {
  const measure = (): void => {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;visibility:hidden;height:env(safe-area-inset-top,0px)'
    document.body.appendChild(probe)
    const under = probe.offsetHeight > 0 && matchMedia('(display-mode: standalone)').matches
    probe.remove()
    document.documentElement.classList.toggle('sb-under', under)
  }
  measure(); window.addEventListener('resize', measure)
}
export function initStatusBar(): void {
  if (!isNative()) return
  document.body.classList.add('capacitor')
}
/**
 * 앱(안드로이드): 시스템 시작 화면(어두운 바탕 + 아이콘 · 워드마크)을 걷는다. 걷으라는 말이 전해지면 끝나는 약속을 준다(흐려지는 건 그 뒤). capacitor.config 의 launchAutoHide:false 로
 * 첫 화면이 다 그려질 때까지 붙잡아 둔다 — 저절로 걷히면 웹 화면이 그려지기 전의 빈 화면이 잠깐 보였다. 여러 번 불러도 된다
 */
export function hideNativeSplash(): Promise<void> {
  if (!isNative()) return Promise.resolve()
  return import('@capacitor/splash-screen').then(({ SplashScreen }) => SplashScreen.hide()).catch(() => {})
}

/** 상태바 글자색·배경을 테마에 맞춘다. 웹은 meta theme-color, 앱은 Capacitor StatusBar */
export function setStatusBarTheme(theme: 'dark' | 'light', bg: string): void {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  if (!isNative()) return
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark }).catch(() => {})
    StatusBar.setBackgroundColor({ color: bg }).catch(() => {}) // Android 15 엣지투엣지에서는 무시됨 (투명 상태바)
  }).catch(() => {})
  // 아래 내비게이션 바(제스처 막대·세 버튼)의 아이콘 색도 앱 테마로 — Capacitor 8 SystemBars 는 기본으로 폰 테마를 따라서, 폰 라이트 + 앱 다크면 어두운 아이콘이 어두운 바탕에 묻혔다
  import('@capacitor/core').then(({ SystemBars, SystemBarsStyle }) => { SystemBars.setStyle({ style: theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => {}) }).catch(() => {})
}

/** 앱에서 뒤로가기: handler 가 true 를 돌려주면 소비, 아니면 앱을 백그라운드로 (종료 대신) */
export function onBackButton(handler: () => boolean): void {
  if (!isNative()) return
  import('@capacitor/app').then(({ App }) => { void App.addListener('backButton', () => { if (!handler()) void App.minimizeApp() }) }).catch(() => {})
}

// 화면 켜짐 유지
let wakeLock: WakeLockSentinel | null = null, wakeGen = 0
const WAKE_WARNED_KEY = 'intonome_wake_warned_v1'
let wakeWarned = false
/** iOS 웹은 첫 요청에 DOM 탭(transient activation)이 필요 — 탭 핸들러에서 await 전에 부른다. 실패는 삼킨다(다음 syncWake 에서 재시도) */
export async function acquireWakeLock(): Promise<void> {
  if (wakeLock && !wakeLock.released) return // 이미 쥐고 있으면 다시 요청하지 않는다 — 앞의 센티널이 샌다
  if (!('wakeLock' in navigator)) { // 설치당 한 번만 — 매 실행 같은 토스트가 떴다
    if (!wakeWarned && noticeListening()) { wakeWarned = true; let shown = false; try { shown = localStorage.getItem(WAKE_WARNED_KEY) === '1' } catch { /* 저장 불가면 세션당 한 번 */ } if (!shown) { notice(t('set.wakeUnsupported')); try { localStorage.setItem(WAKE_WARNED_KEY, '1') } catch { /* 위와 같음 */ } } } // 실제로 보여 준 뒤에만 기록
    return
  }
  const gen = ++wakeGen
  try {
    const s = await navigator.wakeLock.request('screen')
    if (gen !== wakeGen) { s.release().catch(() => {}); return } // 기다리는 사이 release 가 왔다 — 고아 센티널을 쥐지 않는다
    wakeLock = s
  } catch { /* 저전력 모드·백그라운드·활성화 없음 */ }
}
export function releaseWakeLock(): void { wakeGen++; wakeLock?.release().catch(() => {}); wakeLock = null } // 이미 풀린 센티널은 reject 할 수 있다

// 끌어서 값을 바꿀 때의 눈금 진동. 앱: Capacitor Haptics 의 짧은 진동(VIBRATE 권한은 플러그인이 붙인다). 웹: navigator.vibrate.
// 아이폰 웹: 사파리에 진동 기능이 없다. 대신 켜기/끄기 스위치(<input type=checkbox switch>, 사파리 17.4+)가 바뀔 때 iOS 가 내는 햅틱을 쓴다 — 숨긴 스위치를 코드로 누른다. 안 되는 기기면 조용히 아무 일도 없다
const TICK_MS = 8, TICK_STRONG_MS = 16
/** 약한 틱 사이 최소 간격. 빨리 돌려도 초당 25 번까지라 '웅' 이 아니라 '드르륵'. 센 틱(10 단위)은 빠뜨리지 않는다 */
const TICK_GAP_MS = 40
let lastTick = -Infinity
const iosSwitchHaptics = (): boolean => !isNative() && isIOS() && typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype
/** 이 기기에서 진동을 낼 수 있는가 (앱은 항상, 웹은 navigator.vibrate 가 있거나 아이폰 스위치 햅틱이 될 때) */
export const canVibrate = (): boolean => isNative() || (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') || iosSwitchHaptics()
let haptics: Promise<typeof import('@capacitor/haptics')> | null = null
let iosSwitch: HTMLLabelElement | null = null
/** 숨긴 스위치를 한 번 뒤집는다(iOS 햅틱 한 번). 화면에 그려지지 않는 <head> 안에 두어 레이아웃 · 탭과 무관하다 */
function iosTick(): void {
  if (!iosSwitch) {
    const label = document.createElement('label'), input = document.createElement('input')
    input.type = 'checkbox'; input.setAttribute('switch', ''); input.tabIndex = -1
    label.setAttribute('aria-hidden', 'true'); label.style.display = 'none'; label.appendChild(input)
    document.head.appendChild(label); iosSwitch = label
  }
  iosSwitch.click()
}
export function vibrateTick(strong: boolean): void {
  const now = performance.now()
  if (!strong && now - lastTick < TICK_GAP_MS) return
  lastTick = now
  const ms = strong ? TICK_STRONG_MS : TICK_MS
  if (isNative()) { (haptics ??= import('@capacitor/haptics')).then(({ Haptics }) => Haptics.vibrate({ duration: ms })).catch(() => {}); return }
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(ms)
    else if (iosSwitchHaptics()) iosTick() // 세기 구분은 없다
  } catch { /* 막힌 환경 */ }
}

// 전체화면 (웹 전용)
type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void }
export const isFullscreen = (): boolean => !!(document.fullscreenElement || (document as FsDoc).webkitFullscreenElement)
/** 켜기(true) · 끄기(false). 이미 그 상태면 그대로. 켤 수 없는 기기면 onUnsupported */
export function setFullscreen(want: boolean, onUnsupported: () => void): void {
  if (isNative() || want === isFullscreen()) return
  const doc = document as FsDoc
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  if (want) {
    if (el.requestFullscreen) el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
    else onUnsupported()
  } else {
    if (document.exitFullscreen) document.exitFullscreen()
    else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen()
  }
}
/** 전체화면이 켜지고 꺼질 때. 뒤로 가기나 Esc 로 나올 때도 온다 */
export function onFullscreenChange(cb: () => void): void {
  document.addEventListener('fullscreenchange', cb); document.addEventListener('webkitfullscreenchange', cb)
}

// 파일 저장
/** 사용자 이름에서 경로 문자·제어 문자를 제거 */
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\.{2,}/g, '.').trim().replace(/^\.+/, '')
  return (cleaned || 'recording').slice(0, 120)
}
let sharing = false
/** 안드로이드 앱에서 큰 파일을 공유 시트에 넘기기 전 "준비 중" 안내 */
const shareProgress = (): void => notice(t('rec.preparingShare'), 6000)
const toBase64 = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(r.error); r.readAsDataURL(b) })
/** 파일을 사용자에게 건넨다. 웹: 다운로드, iOS: 공유 시트, Android 앱: 캐시에 쓰고 공유 시트(WebView 의 <a download> 는 동작하지 않는다) */
export async function saveFile(blob: Blob, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isNative()) {
      const safe = sanitizeFileName(name)
      // iOS: <a download> 는 홈 화면 PWA 에서 조용히 실패한다 → 공유 시트. 클릭 핸들러에서 await 없이 바로 호출돼야 한다(제스처 만료)
      if (isIOS()) {
        const file = new File([blob], safe, { type: blob.type || 'application/octet-stream' })
        const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean }
        if (typeof navigator.share === 'function' && nav.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: safe }); return { ok: true } }
          catch (e) {
            if (e instanceof Error && e.name === 'AbortError') return { ok: true } /* 취소는 오류가 아니다 */
            // 홈 화면 앱에서는 <a download> 폴백이 조용히 아무것도 안 한다 — 사파리 탭에서만 폴백
            if ((navigator as Navigator & { standalone?: boolean }).standalone) return { ok: false, error: t('app.shareFailed') }
          }
        }
      }
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = safe
      document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 3000)
      return { ok: true }
    }
    // 한 번에 하나만 — 긴 파일(60 분 ≈ 115 MB)은 쓰는 데 10 s 넘게 걸리는데, 그 사이 다시 누르면 앞 파일을 지우며 썼다
    if (sharing) { shareProgress(); return { ok: true } } // 토스트가 사라진 뒤 다시 누르면 '준비 중' 을 다시 보여 준다
    sharing = true
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
      const safe = sanitizeFileName(name)
      const CHUNK = 1024 * 1024; const path = 'intonome/' + safe
      if (blob.size > 4 * CHUNK) shareProgress() // 몇 초 걸리면 "준비 중" 안내
      // 이전 공유 파일 정리 — 캐시에 쌓이지 않게
      await Filesystem.rmdir({ path: 'intonome', directory: Directory.Cache, recursive: true }).catch(() => {})
      await Filesystem.mkdir({ path: 'intonome', directory: Directory.Cache, recursive: true }).catch(() => {})
      // 큰 파일은 1 MB 씩 나눠 쓴다 — base64 문자열 한 덩어리로 브리지를 건너면 ANR/OOM
      for (let off = 0; off < blob.size; off += CHUNK) {
        const b64 = await toBase64(blob.slice(off, off + CHUNK))
        if (off === 0) await Filesystem.writeFile({ path, data: b64, directory: Directory.Cache })
        else await Filesystem.appendFile({ path, data: b64, directory: Directory.Cache })
      }
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache })
      await Share.share({ title: safe, url: uri, dialogTitle: t('app.shareTitle') })
      return { ok: true }
    } finally { sharing = false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/cancel/i.test(msg)) return { ok: true } // 공유 시트 취소는 오류가 아님
    return { ok: false, error: msg }
  }
}

/** 지금 창이 튜너 | 메트로놈 두 칸인가(가로로 넓은 창). 그 밖에는 어느 화면이든 폰과 같은 한 칸이고, 큰 화면은 fitViewport 가 전체를 키운다 */
export const isTwoPane = (): boolean => matchMedia(PANE_QUERY).matches

const FIT_SLACK = 3 // dp — 이보다 적게 달라진 창은 같은 창으로 본다
const VIEWPORT_PHONE = 'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover' // index.html 과 같은 값
/** 브라우저가 화면을 키운 배율(배치 폭을 창보다 좁게 선언하면 그만큼 확대한다). 손가락 확대는 막혀 있어 이 값이 곧 화면 맞춤 배율 */
export const pageScale = (): number => (typeof visualViewport !== 'undefined' && visualViewport && visualViewport.scale > 0 ? visualViewport.scale : 1)
/** 캔버스 비트맵에 쓸 화소 배율 — 키운 화면에서는 기기 배율 × 확대 배율이어야 선이 흐려지지 않는다 */
export const pixelRatio = (): number => (devicePixelRatio || 1) * pageScale()
/**
 * 큰 화면 맞춤: 창 크기(dp)를 재서 배치 폭을 선언한다 — 폭을 창보다 좁게 선언하면 브라우저가 화면 전체(팝업 · 토스트 · 좌표 포함)를 그 비율로 키운다.
 * 창이 바뀔 때마다(회전 · 접고 펴기 · 화면 분할) 다시 잰다. 선언을 무시하는 환경에서는 아무 일도 없다(한 칸이 가운데에 그대로)
 */
export function fitViewport(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]'); if (!meta) return
  let declared = 0, lastW = 0, lastH = 0 // 지금 선언한 배치 폭(0 = 기기 폭 그대로) · 그때 잰 창 크기
  const apply = (): void => {
    // 확대를 푼 창 크기. 보이는 영역(visualViewport)의 크기 × 배율로 잰다 — 둘은 늘 함께 바뀌어 선언을 바꾼 직후에도 곱이 창 크기다(배치 폭 innerWidth 는 한 박자 늦을 수 있다)
    const vv = typeof visualViewport !== 'undefined' ? visualViewport : null
    const w = vv ? vv.width * vv.scale : window.innerWidth, h = vv ? vv.height * vv.scale : window.innerHeight
    // 글자를 치는 동안 키보드가 창을 낮춘 것은 창이 바뀐 게 아니다 — 그때 배율을 다시 잡으면 치던 화면이 통째로 줄어든다
    const el = document.activeElement, typing = el instanceof HTMLInputElement && el.type === 'text'
    if (typing && Math.abs(w - lastW) < FIT_SLACK && h < lastH) return
    // 같은 창을 다시 잰 값은 반올림만큼(1 dp 안팎) 다르다 — 그 차이로 선언을 바꾸면 바꾼 선언이 다시 재는 값을 바꿔 끝없이 오간다
    if (Math.abs(w - lastW) < FIT_SLACK && Math.abs(h - lastH) < FIT_SLACK) return
    lastW = w; lastH = h
    const want = fitScale(w, h) > 1.001 ? fitWidth(w, h) : 0
    if (want === declared) return
    declared = want
    // 폭과 배율을 함께 적는다 — 폭만 적으면 안드로이드 WebView 는 배율을 1 로 되돌린다(배율을 적지 않은 페이지에만 있는 호환 규칙). 배율은 내림: 올리면 보이는 폭이 배치 폭보다 좁아져 옆으로 밀린다.
    // 손가락 확대는 최소 = 최대 배율로 막는다(폰 화면의 user-scalable=no 와 같은 일)
    const s = Math.floor(w / want * 1e4) / 1e4
    meta.setAttribute('content', want ? `width=${want}, initial-scale=${s}, minimum-scale=${s}, maximum-scale=${s}, viewport-fit=cover` : VIEWPORT_PHONE)
  }
  apply()
  let t: ReturnType<typeof setTimeout> | null = null
  const later = (): void => { if (t) clearTimeout(t); t = setTimeout(apply, 60) }
  window.addEventListener('resize', later); window.addEventListener('orientationchange', later)
  if (typeof visualViewport !== 'undefined' && visualViewport) visualViewport.addEventListener('resize', later) // 키보드가 내려갈 때 · 배율이 자리 잡을 때
}

/** 시스템 글꼴 크기(안드로이드 앱). WebView 는 기본으로 시스템 배율만큼 '글자만' 키운다(상자는 그대로) — 100~200 % 가 그대로 들어오면
 *  한 화면짜리 이 앱은 버튼 글자가 넘치고 아래 조작이 화면 밖으로 밀린다. 그래서 WebView 배율은 100 % 로 두고, 시스템 배율을 읽어
 *  앱의 글자 단계(--fs-*)에만 최대 1.3 배까지 반영한다 — 큰 글꼴을 쓰는 사람의 글자는 커지고, 배치는 깨지지 않는다. 앱으로 돌아올 때 다시 읽는다 */
export const FONT_SCALE_MAX = 1.3
export const FONT_SCALE_MIN = 1 // 줄이지는 않는다 — 한 화면 앱이라 줄여도 더 담기는 게 없고, 가장 작은 글자(11 px)가 이미 보면대 거리에서 읽히는 최소다. 2.10.6 까지는 0.85 까지 줄여 폰 글자를 한 단계 작게 쓰면 웹앱보다 작았다
export function fontScaleFor(system: number): number { return Number.isFinite(system) && system > 0 ? Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(system * 100) / 100)) : 1 }
export function applyFontScale(): void {
  if (!isNative()) return // 웹앱은 브라우저가 다룬다
  const apply = (): void => {
    import('@capacitor/text-zoom').then(async ({ TextZoom }) => {
      const { value } = await TextZoom.getPreferred()
      await TextZoom.set({ value: 1 })
      document.documentElement.style.setProperty('--fs-scale', String(fontScaleFor(value)))
    }).catch(() => {})
  }
  apply()
  import('@capacitor/app').then(({ App }) => { void App.addListener('resume', apply) }).catch(() => {})
}
