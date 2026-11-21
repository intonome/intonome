#!/usr/bin/env node
// Android 매니페스트 보정 — 마이크 권한·세로 고정·버전·백업 설정. cap:sync 가 매번 실행한다
// RECORD_AUDIO 가 없으면 WebView getUserMedia 가 NotAllowedError 로 실패하고, 앱 설정에 마이크 권한 항목도 보이지 않는다
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 안드로이드 자동 백업을 끈다 — 기본값 true 면 녹음(IndexedDB)이 구글 드라이브로 올라간다. 멱등. 순수 */
export function setAllowBackup(xml) {
  if (/android:allowBackup="false"/.test(xml)) return xml
  if (/android:allowBackup="true"/.test(xml)) return xml.replace(/android:allowBackup="true"/, 'android:allowBackup="false"')
  return xml.replace(/<application(\s)/, '<application android:allowBackup="false"$1')
}

/** styles.xml 의 한 스타일 안 항목을 값으로(없으면 넣는다). 이름이 정확히 같은 스타일만 — NoActionBar 가 NoActionBarLaunch 를 건드리지 않게. 멱등. 순수 */
export function setStyleItem(xml, style, name, value) {
  const re = new RegExp(`(<style name="${style.replace(/\./g, '\\.')}"[^>]*>)([\\s\\S]*?)(\\n?[ \\t]*</style>)`)
  return xml.replace(re, (m, open, body, close) => {
    const item = new RegExp(`<item name="${name}">[^<]*</item>`)
    if (item.test(body)) return open + body.replace(item, `<item name="${name}">${value}</item>`) + close
    return open + body + `\n        <item name="${name}">${value}</item>` + close
  })
}

/**
 * 앱 시작 화면 색. 안드로이드 12+ 시작 화면(그 아래는 호환 라이브러리)은 이 값이 없으면 폰 테마를 따라 라이트에선 하얗게 번쩍였다.
 * 시작 화면 뒤 앱 창 바탕도 같은 색 — 웹 화면이 그려지기 전 틈에 다른 색이 비치지 않게. 멱등. 순수
 */
export function setSplashTheme(xml, color) {
  let out = setStyleItem(xml, 'AppTheme.NoActionBarLaunch', 'windowSplashScreenBackground', color)
  // 안드로이드 13+: 아이콘을 늘 보인다. 기본값은 여는 쪽(홈 화면 앱)에 맡겨서, 아이콘 없이 여는 홈 화면 앱에선 빈 바탕만 보였다. 12 이하는 이 항목을 무시한다
  out = setStyleItem(out, 'AppTheme.NoActionBarLaunch', 'android:windowSplashScreenBehavior', 'icon_preferred')
  return setStyleItem(out, 'AppTheme.NoActionBar', 'android:windowBackground', color)
}

/** dist 가 GitHub Pages 용 빌드(base=/<레포명>/)인지 — 그대로 APK 에 넣으면 자산 경로가 어긋나 흰 화면이 된다. 레포명을 박지 않는다 */
export function isWebBuildHtml(html) { return /(?:src|href)="\/[^"/]+\/assets\//.test(html) }

export function main(log = console.log) {
  // 잘못된 dist 가 동기화된 채로 APK 를 만들지 않게 먼저 막는다
  const distHtml = join(ROOT, 'dist', 'index.html')
  if (existsSync(distHtml) && isWebBuildHtml(readFileSync(distHtml, 'utf8'))) {
    console.error('\x1b[31mdist/ 가 웹(GitHub Pages)용 빌드입니다 — 이대로 APK 를 만들면 흰 화면이 됩니다.\x1b[0m')
    console.error('`npm run build` 결과입니다. 앱은 `npm run cap:sync` 를 쓰세요 (BASE=/ 로 다시 빌드합니다).')
    process.exit(1)
  }

  const path = join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
  if (!existsSync(path)) { log('android/ 없음 — `npx cap add android` 후 다시 실행'); return }
  let xml = readFileSync(path, 'utf8'), changed = false
  const NEEDED = ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.INTERNET', 'android.permission.VIBRATE']
  for (const perm of NEEDED) {
    if (!xml.includes(`"${perm}"`)) { xml = xml.replace('</manifest>', `    <uses-permission android:name="${perm}" />\n</manifest>`); changed = true; log('추가: ' + perm) }
  }
  // 마이크는 있어도 되고 없어도 되는 기기 허용
  if (!xml.includes('android.hardware.microphone')) { xml = xml.replace('</manifest>', '    <uses-feature android:name="android.hardware.microphone" android:required="false" />\n</manifest>'); changed = true }
  // 녹음이 클라우드로 새어 나가지 않게 자동 백업을 끈다
  const xb = setAllowBackup(xml)
  if (xb !== xml) { xml = xb; changed = true; log('allowBackup=false (자동 백업 끔)') }
  if (changed) { writeFileSync(path, xml); log('AndroidManifest.xml 갱신') } else log('AndroidManifest.xml 권한 OK')

  // 세로 고정 — CSS 오버레이에 더해 회전 자체를 막는다
  if (!xml.includes('android:screenOrientation')) {
    const x2 = xml.replace(/<activity(\s[^>]*?)android:name="\.MainActivity"/, (m, pre) => `<activity${pre}android:screenOrientation="portrait" android:name=".MainActivity"`)
    if (x2 !== xml) { xml = x2; writeFileSync(path, xml); log('AndroidManifest.xml: screenOrientation=portrait') }
  }

  // 시작 화면 색 — 바탕색은 capacitor.config 의 backgroundColor 하나에서
  const styles = join(ROOT, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml')
  if (existsSync(styles)) {
    const { backgroundColor } = JSON.parse(readFileSync(join(ROOT, 'capacitor.config.json'), 'utf8'))
    const st = readFileSync(styles, 'utf8'), st2 = setSplashTheme(st, backgroundColor)
    if (st2 !== st) { writeFileSync(styles, st2); log(`styles.xml: 시작 화면 바탕 ${backgroundColor}`) } else log('styles.xml 시작 화면 OK')
  }

  // 버전 동기화 — android/ 는 생성물이라 build.gradle 의 versionName/versionCode 가 매번 1.0/1 로 돌아온다
  const gradle = join(ROOT, 'android', 'app', 'build.gradle')
  if (existsSync(gradle)) {
    const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const [a, b, c] = version.split('.').map(Number)
    const code = a * 10000 + b * 100 + c // 2.0.0 → 20000. 업데이트 설치가 되려면 항상 커져야 한다
    const g = readFileSync(gradle, 'utf8')
    const g2 = g.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${version}"`)
    if (g2 !== g) { writeFileSync(gradle, g2); log(`build.gradle: versionName ${version}, versionCode ${code}`) } else log(`build.gradle 버전 OK (${version})`)
  }
}

// 직접 실행일 때만. pathToFileURL: Windows 는 argv[1] 이 `C:\...` 라 `file://` 접두만으로는 같지 않다
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
