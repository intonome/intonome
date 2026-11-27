#!/usr/bin/env node
// 아이폰 홈 화면 웹앱의 스플래시 (apple-touch-startup-image). 아이폰은 화면 크기와 배율이 딱 맞는 PNG 가 있을 때만 띄운다(없으면 흰 화면).
// 앱 바탕색 위에 둥근 아이콘 + 한 줄 워드마크. 앱 기본이 다크라 다크 한 벌(기기가 라이트 모드여도 다크). 아이콘은 resources/icon.svg, 워드마크는 resources/wordmark.svg 에서
// index.html 의 링크 태그는 이 목록과 같아야 한다(scripts/splash.test.mjs). 목록을 바꾸면 `node scripts/gen-splash.mjs --tags` 로 태그를 다시 뽑는다
// 안드로이드 앱 시작 화면의 가운데 그림(아이콘의 고리 + 워드마크 한 장, resources/android/splash_logo-*.png)도 여기서 만든다
// 사용: node scripts/gen-splash.mjs [--tags]   (npm run icons 가 아이콘 다음에 부른다). index.html 의 스플래시 → 앱 이음새 블록(launchBlock)도 함께 다시 쓴다
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** 세로 화면 [CSS 폭, CSS 높이, 배율, 기종]. 같은 크기는 한 장으로 */
export const SPLASH_DEVICES = [
  [440, 956, 3, 'iPhone 16 Pro Max · 17 Pro Max · 18 Pro Max'],
  [420, 912, 3, 'iPhone Air'],
  [402, 874, 3, 'iPhone 16 Pro · 17 · 17 Pro · 18 Pro'],
  [430, 932, 3, 'iPhone 14 Pro Max · 15 Plus · 15 Pro Max · 16 Plus'],
  [393, 852, 3, 'iPhone 14 Pro · 15 · 15 Pro · 16'],
  [428, 926, 3, 'iPhone 12 Pro Max · 13 Pro Max · 14 Plus'],
  [390, 844, 3, 'iPhone 12 · 12 Pro · 13 · 13 Pro · 14 · 16e'],
  [375, 812, 3, 'iPhone X · XS · 11 Pro · 12 mini · 13 mini'],
  [414, 896, 3, 'iPhone XS Max · 11 Pro Max'],
  [414, 896, 2, 'iPhone XR · 11'],
  [414, 736, 3, 'iPhone 8 Plus'],
  [375, 667, 2, 'iPhone 8 · SE (2nd, 3rd)'],
]
/** 앱 바탕색과 같다(스타일 --bg). 다크는 기기가 다크 모드일 때 */
export const SPLASH_THEMES = { dark: { bg: '#181B21', ink: '#FFFFFF' } } // 앱 기본 테마(다크)의 바탕색과 같다
/** 크기(pt): 아이콘 지름, 워드마크 폭, 둘 사이. 묶음의 가운데를 화면 높이의 47 % 에(홈 막대 쪽이 무거워 보이지 않게 조금 위로) */
export const SPLASH_LAYOUT = { icon: 120, word: 150, gap: 26, center: 0.47 }

/**
 * 안드로이드 앱 시작 화면의 가운데 그림(dp). 시스템(12+)은 그림을 정사각 판(canvas)으로 받아 가운데 view(192dp)만 보이게 놓고, 그 위를 기기의 아이콘 모양
 * (config_icon_mask — 원 · 둥근 사각 등 제조사마다 다르다)으로 자른다. 어떤 모양이든 남기는 곳은 적응형 아이콘의 안전 영역 = 지름 safe(view × 66/72) 원뿐이라
 * 잉크는 전부 그 안에 둔다(삼성 기본 홈의 모양은 view 의 약 92 % 라 192dp 원에 맞추면 위 끝이 잘린다). 전체 화면 그림은 못 쓴다.
 * 아이콘의 고리(타일 없이) 아래에 워드마크(폭은 고리 지름의 약 1.41 배). 묶음을 안전 원의 위쪽 끝에서 inset 만큼 들여 붙인다 — 원은 가운데가 가장 넓어서
 * 넓은 워드마크가 가운데 쪽에 와야 크게 들어가고, 묶음은 화면 가운데보다 조금 위에 놓인다
 */
export const ANDROID_SPLASH = { canvas: 288, view: 192, safe: 176, ring: 95, gap: 28, word: 134, inset: 1 }
/** 안드로이드 시작 화면 바탕(거의 검정 — 고리의 색이 가장 또렷하다). capacitor.config 의 plugins.SplashScreen.backgroundColor 하나에서 */
export const androidSplashBg = () => JSON.parse(readFileSync(join(ROOT, 'capacitor.config.json'), 'utf8')).plugins.SplashScreen.backgroundColor
/** 화면 밀도별 배율 — 판 한 변은 canvas × 배율 px */
export const ANDROID_SPLASH_SCALE = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
export const androidSplashFile = density => `resources/android/splash_logo-${density}.png`

export const splashFile = (w, h, d, theme) => `splash/iphone-${w * d}x${h * d}-${theme}.png`
export const splashMedia = (w, h, d, theme) =>
  `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)`
export const splashTags = () => Object.keys(SPLASH_THEMES).flatMap(th => SPLASH_DEVICES.map(([w, h, d]) =>
  `<link rel="apple-touch-startup-image" media="${splashMedia(w, h, d, th)}" href="${splashFile(w, h, d, th)}">`))

/** 워드마크 윤곽: viewBox 와 경로 */
function wordmark() {
  const wm = readFileSync(join(ROOT, 'resources/wordmark.svg'), 'utf8')
  const vb = /viewBox="([^"]+)"/.exec(wm)[1], [, , vw, vh] = vb.split(' ').map(Number)
  return { vb, vw, vh, d: /<path d="([^"]+)"/.exec(wm)[1] }
}

/**
 * 아이폰 홈 화면 웹앱이 스플래시에서 앱으로 넘어갈 때의 이음새. 아이폰은 페이지가 처음 그려지는 순간 스플래시를 치우는데,
 * 그 순간 페이지가 스플래시와 똑같은 그림(같은 아이콘 · 워드마크 · 자리 · 색)을 먼저 그리면 눈에는 바뀌는 게 없다. 앱이 다 그려지면 ui/launch.ts 가 흐리게 걷는다.
 * 아이폰 홈 화면 웹앱(navigator.standalone)에서만 보이고, 다른 곳에서는 첫 그리기 전에 지운다. 무슨 일이 있어도 2.5 초 뒤엔 지운다.
 * 영어가 기본이라 첫 그리기엔 body 가 i18n-pending 으로 가려져 있다 → 이 블록만 visibility:visible 로 보인다
 * 자리: 스플래시는 화면(screen) 기준 47 %. 페이지가 상태바 아래에서 시작하면(위쪽 safe-area 0) 그만큼(screen.height − innerHeight) 올린다
 * 안드로이드 앱(window.Capacitor)에서는 그림 없이 시스템 시작 화면의 바탕색만 덮는다(.cover): 시스템 시작 화면이 걷히는 동안 로고가 앱 화면과 겹쳐 비치지 않고,
 * 로고가 다 사라진 뒤 ui/launch.ts 가 이 덮개를 걷어 앱이 나타난다
 * index.html 의 <!-- launch:start --> … <!-- launch:end --> 사이에 이 글을 넣는다(손으로 고치지 않는다, splash.test.mjs 가 맞춰 본다)
 */
export function launchBlock() {
  const L = SPLASH_LAYOUT, { vb, vw, vh, d } = wordmark(), wh = L.word * vh / vw, block = L.icon + L.gap + wh
  const icon = readFileSync(join(ROOT, 'resources/icon.svg'), 'utf8').trim()
    .replace(/id="i/g, 'id="lc-i').replace(/url\(#i/g, 'url(#lc-i') // 페이지의 다른 id 와 겹치지 않게
  const { dark } = SPLASH_THEMES, n = v => +v.toFixed(2)
  return [
    '<!-- launch:start (scripts/gen-splash.mjs 가 만든다. 스플래시 → 앱 이음새) -->',
    `<style>#launch{display:none}#launch.show{display:block;position:fixed;left:0;top:0;width:100%;height:100lvh;z-index:10000;background:${dark.bg};visibility:visible;transition:opacity .25s ease}#launch.out{opacity:0;pointer-events:none}#launch.cover{bottom:0;height:auto;background:${androidSplashBg()};transition-duration:.2s}#launch.cover>*{display:none}` +
    `#launch .lc-i{position:absolute;left:50%;width:${L.icon}px;height:${L.icon}px;margin-left:${-L.icon / 2}px;border-radius:50%;overflow:hidden}#launch .lc-i svg{display:block;width:100%;height:100%}` +
    `#launch .lc-w{position:absolute;left:50%;width:${L.word}px;height:${n(wh)}px;margin-left:${-L.word / 2}px;fill:${dark.ink}}</style>`,
    `<div id="launch" aria-hidden="true"><div class="lc-i">${icon}</div><svg class="lc-w" viewBox="${vb}"><path d="${d}"/></svg></div>`,
    `<script>(function(){var e=document.getElementById('launch');try{if(window.Capacitor){e.className='show cover';setTimeout(function(){if(e.parentNode)e.remove()},2500);return}if(navigator.standalone===true){var H=screen.height,p=document.createElement('div');p.style.cssText='position:fixed;top:0;width:1px;visibility:hidden;height:env(safe-area-inset-top,0px)';document.body.appendChild(p);var t=p.offsetHeight>0?0:Math.max(0,H-innerHeight);p.remove();var y=H*${L.center}-t-${n(block / 2)};e.children[0].style.top=y+'px';e.children[1].style.top=(y+${L.icon + L.gap})+'px';e.className='show';setTimeout(function(){if(e.parentNode)e.remove()},2500);return}}catch(x){}e.remove()})()</script>`,
    '<!-- launch:end -->',
  ].join('\n')
}

function page(w, h, theme) {
  const { bg, ink } = SPLASH_THEMES[theme], L = SPLASH_LAYOUT
  const icon = 'data:image/svg+xml;base64,' + readFileSync(join(ROOT, 'resources/icon.svg')).toString('base64')
  const { vb, vw, vh, d } = wordmark()
  const wh = L.word * vh / vw, block = L.icon + L.gap + wh, top = h * L.center - block / 2
  return `<!doctype html><html><head><style>html,body{margin:0;width:${w}px;height:${h}px;background:${bg};overflow:hidden}</style></head><body>
<img src="${icon}" style="position:absolute;left:${(w - L.icon) / 2}px;top:${top}px;width:${L.icon}px;height:${L.icon}px;border-radius:50%">
<svg viewBox="${vb}" style="position:absolute;left:${(w - L.word) / 2}px;top:${top + L.icon + L.gap}px;width:${L.word}px;height:${wh}px"><path fill="${ink}" d="${d}"/></svg>
</body></html>`
}

/** 적응형 아이콘 앞 레이어 그림(resources/icon-foreground.png, 타일 없이 고리만)에서 고리 지름 / 그림 한 변 — gen-icons.mjs 의 ADAPTIVE_FIT 와 같은 값(splash.test 가 그려진 고리 크기를 잰다) */
const RING_IN_LAYER = 52 / 108
/** 안드로이드 시작 화면 그림: 투명한 판 가운데에 아이콘의 고리 + 워드마크 */
function androidPage() {
  const L = ANDROID_SPLASH, { ink } = SPLASH_THEMES.dark
  const fg = 'data:image/png;base64,' + readFileSync(join(ROOT, 'resources/icon-foreground.png')).toString('base64'), layer = L.ring / RING_IN_LAYER
  const { vb, vw, vh, d } = wordmark()
  const wh = L.word * vh / vw, top = (L.canvas - L.safe) / 2 + L.inset
  return `<!doctype html><html><head><style>html,body{margin:0;width:${L.canvas}px;height:${L.canvas}px;background:transparent;overflow:hidden}</style></head><body>
<img src="${fg}" style="position:absolute;left:${(L.canvas - layer) / 2}px;top:${top + (L.ring - layer) / 2}px;width:${layer}px;height:${layer}px">
<svg viewBox="${vb}" style="position:absolute;left:${(L.canvas - L.word) / 2}px;top:${top + L.ring + L.gap}px;width:${L.word}px;height:${wh}px"><path fill="${ink}" d="${d}"/></svg>
</body></html>`
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--tags')) { console.log(splashTags().join('\n')); process.exit(0) }
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  mkdirSync(join(ROOT, 'www/public/splash'), { recursive: true })
  for (const theme of Object.keys(SPLASH_THEMES)) for (const [w, h, d] of SPLASH_DEVICES) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: d })
    await p.setContent(page(w, h, theme)); await p.evaluate(() => Promise.all([...document.images].map(i => i.decode())))
    writeFileSync(join(ROOT, 'www/public', splashFile(w, h, d, theme)), await p.screenshot({ type: 'png' })); await p.close()
  }
  for (const [density, scale] of Object.entries(ANDROID_SPLASH_SCALE)) {
    const p = await browser.newPage({ viewport: { width: ANDROID_SPLASH.canvas, height: ANDROID_SPLASH.canvas }, deviceScaleFactor: scale })
    await p.setContent(androidPage()); await p.evaluate(() => Promise.all([...document.images].map(i => i.decode())))
    writeFileSync(join(ROOT, androidSplashFile(density)), await p.screenshot({ type: 'png', omitBackground: true })); await p.close()
  }
  await browser.close()
  // index.html 의 이음새 블록을 지금 아이콘 · 워드마크로 다시 쓴다
  const hp = join(ROOT, 'www/index.html'), html = readFileSync(hp, 'utf8')
  const next = html.replace(/<!-- launch:start[\s\S]*?<!-- launch:end -->/, launchBlock())
  if (next === html && !html.includes(launchBlock())) throw new Error('index.html 에 launch 표식이 없다')
  writeFileSync(hp, next)
  console.log(`splash written: ${SPLASH_DEVICES.length} sizes (dark), Android launch logo × ${Object.keys(ANDROID_SPLASH_SCALE).length}, launch block in index.html`)
}
