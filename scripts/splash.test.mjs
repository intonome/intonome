// 아이폰 스플래시: index.html 의 태그가 목록과 같고, 그림이 태그의 화면 크기 × 배율과 정확히 같고, 모서리가 앱 바탕색인가
// 안드로이드 시작 화면 그림: 밀도별 크기가 맞고, 시스템이 남기는 원 안에 다 들어가는가
import { describe, test, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { PNG } from 'pngjs'
import { SPLASH_DEVICES, SPLASH_THEMES, ANDROID_SPLASH, androidSplashBg, ANDROID_SPLASH_SCALE, androidSplashFile, splashFile, splashTags, launchBlock } from './gen-splash.mjs'
import { SPLASH_LOGO_DENSITIES } from './cap-manifest.mjs'
import { NATIVE_SPLASH_FADE_MS } from '../www/src/ui/launch.ts'

const html = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8')
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))

describe('iPhone home-screen splash images', () => {
  test('index.html links every size, dark only (the app starts dark whatever the phone is set to)', () => {
    const tags = splashTags()
    for (const t of tags) expect(html, t).toContain(t)
    expect(html.match(/rel="apple-touch-startup-image"/g)?.length).toBe(SPLASH_DEVICES.length)
    expect(html).not.toContain('-light.png'); expect(html).not.toContain('prefers-color-scheme')
  })
  test('index.html carries the splash-to-app block made from the current icon and wordmark', () => {
    expect(html).toContain(launchBlock())
    expect(html.indexOf('<!-- launch:start')).toBeLessThan(html.indexOf('<div id="app"'))
  })
  test.each(SPLASH_DEVICES.flatMap(([w, h, d, name]) => Object.keys(SPLASH_THEMES).map(th => [`${name} ${th}`, w, h, d, th])))('%s', (_, w, h, d, th) => {
    const f = new URL('../www/public/' + splashFile(w, h, d, th), import.meta.url)
    expect(existsSync(f)).toBe(true)
    const p = PNG.sync.read(readFileSync(f))
    expect([p.width, p.height]).toEqual([w * d, h * d])
    const bg = hex(SPLASH_THEMES[th].bg)
    for (const [x, y] of [[0, 0], [p.width - 1, p.height - 1]]) { const i = (y * p.width + x) * 4; expect([p.data[i], p.data[i + 1], p.data[i + 2]]).toEqual(bg) }
    const c = ((Math.round(p.height * 0.47) - 60 * d) * p.width + Math.round(p.width / 2)) * 4 // 아이콘 쪽: 바탕색이 아니다
    expect([p.data[c], p.data[c + 1], p.data[c + 2]]).not.toEqual(bg)
  })
})

describe('Android launch screen logo (the rings of the icon and the wordmark in one image)', () => {
  const L = ANDROID_SPLASH
  test('one image per density the Android build copies', () => expect(Object.keys(ANDROID_SPLASH_SCALE)).toEqual(SPLASH_LOGO_DENSITIES))
  test.each(Object.entries(ANDROID_SPLASH_SCALE))('%s: full canvas, transparent outside, everything inside the safe zone every icon shape keeps', (density, scale) => {
    const p = PNG.sync.read(readFileSync(new URL('../' + androidSplashFile(density), import.meta.url)))
    expect([p.width, p.height]).toEqual([L.canvas * scale, L.canvas * scale])
    const c = (p.width - 1) / 2, alpha = (x, y) => p.data[(y * p.width + x) * 4 + 3]
    let far = 0, top = p.height, bottom = 0; const rows = []
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (alpha(x, y) > 8) { far = Math.max(far, Math.hypot(x - c, y - c)); top = Math.min(top, y); bottom = Math.max(bottom, y); rows[y] = true }
    expect(L.safe).toBe(L.view * 66 / 72); expect(L.canvas).toBe(L.view * 1.5) // 적응형 아이콘의 안전 영역 · 판은 보이는 창의 1.5 배
    expect(far / scale).toBeLessThanOrEqual(L.safe / 2)
    expect(Math.abs(top / scale - ((L.canvas - L.safe) / 2 + L.inset))).toBeLessThan(2.5) // 고리 위 끝 = 원의 위 끝에서 inset
    let left = p.width, right = 0; for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (alpha(x, y) > 8) { left = Math.min(left, x); right = Math.max(right, x) }
    expect(Math.abs((left + right) / 2 - c) / scale).toBeLessThan(1) // 좌우 가운데
    let empty = 0, run = 0, ring = 0; for (let y = top; y <= bottom; y++) { run = rows[y] ? 0 : run + 1; empty = Math.max(empty, run); if (!empty) ring++ }
    expect(Math.abs(empty / scale - L.gap)).toBeLessThan(2.5) // 고리와 글자 사이 빈 줄 = 정한 틈
    expect(Math.abs(ring / scale - L.ring)).toBeLessThan(2.5) // 고리 지름
    expect(alpha(0, 0)).toBe(0); expect(alpha(Math.round(c), Math.round(((L.canvas - L.safe) / 2 + L.inset + L.ring / 2) * scale))).toBe(255) // 고리 한가운데의 초록 불
  })
  test('the wait in the app is the fade time set for the system launch screen, which stays until the app says so', () => {
    const cfg = JSON.parse(readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'))
    expect(cfg.plugins.SplashScreen.launchFadeOutDuration).toBe(NATIVE_SPLASH_FADE_MS)
    expect(cfg.plugins.SplashScreen.launchAutoHide).toBe(false)
  })
  test('the cover in index.html has the color of the system launch screen', () => {
    expect(androidSplashBg()).toMatch(/^#[0-9a-f]{6}$/)
    expect(/#launch\.cover\{[^}]*\}/.exec(html)[0]).toContain(`background:${androidSplashBg()}`)
    expect(html).toContain('#launch.cover>*{display:none}')
  })
})
