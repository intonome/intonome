import { describe, test, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setAllowBackup, isWebBuildHtml, setSplashTheme, setSplashLogo, copySplashLogo, SPLASH_LOGO_DENSITIES, setOptionalFeature, setWideViewport, WIDE_VIEWPORT_CALL } from './cap-manifest.mjs'

// Capacitor 8 템플릿이 실제로 내보내는 형태
const TEMPLATE = `<application android:allowBackup="true" android:icon="@mipmap/ic_launcher" android:label="@string/app_name">`

describe('setAllowBackup', () => {
  test('true → false', () => expect(setAllowBackup(TEMPLATE)).toContain('android:allowBackup="false"'))
  test('idempotent — stays as is when already false', () => {
    const once = setAllowBackup(TEMPLATE)
    expect(setAllowBackup(once)).toBe(once)
  })
  test('adds the attribute when missing', () => {
    const out = setAllowBackup('<application android:label="x">')
    expect(out).toBe('<application android:allowBackup="false" android:label="x">')
  })
  test('no true is left', () => expect(setAllowBackup(TEMPLATE)).not.toContain('allowBackup="true"'))
})

// Capacitor 8 템플릿의 MainActivity.java 그대로
const ACTIVITY = `package com.intonome.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {}
`
describe('setWideViewport', () => {
  test('the template activity gets an onCreate that turns the setting on after the bridge exists', () => {
    const out = setWideViewport(ACTIVITY)
    expect(out).toContain(WIDE_VIEWPORT_CALL)
    expect(out.indexOf('super.onCreate(savedInstanceState);')).toBeLessThan(out.indexOf(WIDE_VIEWPORT_CALL))
    expect(out.startsWith('package com.intonome.app;')).toBe(true)
    expect((out.match(/\{/g) ?? []).length).toBe((out.match(/\}/g) ?? []).length)
  })
  test('idempotent', () => { const once = setWideViewport(ACTIVITY); expect(setWideViewport(once)).toBe(once) })
  test('a body on its own lines is still the empty template', () => expect(setWideViewport(ACTIVITY.replace('{}', '{\n}'))).toContain(WIDE_VIEWPORT_CALL))
  test('an activity someone edited is left alone', () => expect(setWideViewport(ACTIVITY.replace('{}', '{ int x; }'))).toBe(null))
})

describe('isWebBuildHtml', () => {
  test('detects a Pages build (any repo name)', () => { expect(isWebBuildHtml('<script src="/intonome/assets/a.js">')).toBe(true); expect(isWebBuildHtml('<link href="/anything/assets/a.css">')).toBe(true) })
  test('app builds pass', () => expect(isWebBuildHtml('<script src="/assets/a.js">')).toBe(false))
})

// Capacitor 8 템플릿의 styles.xml 그대로
const STYLES = `<?xml version="1.0" encoding="utf-8"?>
<resources>

    <!-- Base application theme. -->
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <!-- Customize your theme here. -->
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
    </style>


    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
    </style>
</resources>`

describe('setSplashTheme — the launch screen is the app background, not a white flash', () => {
  const out = setSplashTheme(STYLES, '#181b21')
  const block = (xml, name) => xml.match(new RegExp(`<style name="${name}"[^>]*>[\\s\\S]*?</style>`))[0]
  test('the launch screen gets the background color', () => expect(block(out, 'AppTheme\\.NoActionBarLaunch')).toContain('<item name="windowSplashScreenBackground">#181b21</item>'))
  test('the icon is always shown (Android 13+), whatever the home screen app asks', () => expect(block(out, 'AppTheme\\.NoActionBarLaunch')).toContain('<item name="android:windowSplashScreenBehavior">icon_preferred</item>'))
  test('the app window under it gets the same color', () => expect(block(out, 'AppTheme\\.NoActionBar')).toContain('<item name="android:windowBackground">#181b21</item>'))
  test('NoActionBar and NoActionBarLaunch are told apart', () => {
    expect(block(out, 'AppTheme\\.NoActionBar')).not.toContain('windowSplashScreenBackground')
    expect(block(out, 'AppTheme\\.NoActionBarLaunch')).not.toContain('android:windowBackground')
  })
  test('the rest is untouched', () => expect(out.replace(/\n {8}<item name="(windowSplashScreenBackground|android:windowBackground|android:windowSplashScreenBehavior)">(#181b21|icon_preferred)<\/item>/g, '')).toBe(STYLES))
  test('idempotent', () => expect(setSplashTheme(out, '#181b21')).toBe(out))
  test('a changed color replaces the old one', () => {
    const again = setSplashTheme(out, '#000000')
    expect(again).toContain('<item name="windowSplashScreenBackground">#000000</item>'); expect(again).not.toContain('#181b21')
  })
})

describe('setSplashTheme with a launch screen color of its own', () => {
  const out = setSplashTheme(STYLES, '#181b21', '#0b0c0f')
  test('the launch screen gets its color, the app window keeps the app color', () => {
    expect(out).toContain('<item name="windowSplashScreenBackground">#0b0c0f</item>')
    expect(out).toContain('<item name="android:windowBackground">#181b21</item>')
  })
  test('idempotent, and replaces a color set before', () => {
    expect(setSplashTheme(out, '#181b21', '#0b0c0f')).toBe(out)
    expect(setSplashTheme(setSplashTheme(STYLES, '#181b21'), '#181b21', '#0b0c0f')).toBe(out)
  })
})

describe('setSplashLogo / copySplashLogo — the launch screen shows the rings with the wordmark', () => {
  const out = setSplashLogo(setSplashTheme(STYLES, '#181b21'))
  test('the launch theme points at the logo drawable; the app theme does not', () => {
    expect(out.match(/<style name="AppTheme\.NoActionBarLaunch"[^>]*>[\s\S]*?<\/style>/)[0]).toContain('<item name="windowSplashScreenAnimatedIcon">@drawable/splash_logo</item>')
    expect(out.match(/windowSplashScreenAnimatedIcon/g).length).toBe(1)
  })
  test('idempotent, in either order with the color', () => {
    expect(setSplashLogo(out)).toBe(out); expect(setSplashTheme(out, '#181b21')).toBe(out)
  })
  test('copies one image per density into drawable-<density>/splash_logo.png', () => {
    const dir = mkdtempSync(join(tmpdir(), 'splash-')), src = join(dir, 'src'), res = join(dir, 'res'); mkdirSync(src); mkdirSync(res)
    try {
      for (const d of SPLASH_LOGO_DENSITIES) writeFileSync(join(src, `splash_logo-${d}.png`), d)
      expect(copySplashLogo(res, src)).toBe(true)
      for (const d of SPLASH_LOGO_DENSITIES) expect(readFileSync(join(res, `drawable-${d}`, 'splash_logo.png'), 'utf8')).toBe(d)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
  test('copies nothing when an image is missing, so the theme never points at a drawable that is not there', () => {
    const dir = mkdtempSync(join(tmpdir(), 'splash-')), src = join(dir, 'src'), res = join(dir, 'res'); mkdirSync(src); mkdirSync(res)
    try {
      for (const d of SPLASH_LOGO_DENSITIES.slice(1)) writeFileSync(join(src, `splash_logo-${d}.png`), d)
      expect(copySplashLogo(res, src)).toBe(false)
      for (const d of SPLASH_LOGO_DENSITIES) expect(existsSync(join(res, `drawable-${d}`))).toBe(false)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('setOptionalFeature — hardware the app can do without does not keep it off a device', () => {
  const XML = '<manifest>\n    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n</manifest>'
  const out = setOptionalFeature(XML, 'android.hardware.screen.portrait')
  test('declared as not required', () => expect(out).toContain('<uses-feature android:name="android.hardware.screen.portrait" android:required="false" />'))
  test('the rest is untouched', () => expect(out.replace('    <uses-feature android:name="android.hardware.screen.portrait" android:required="false" />\n', '')).toBe(XML))
  test('idempotent', () => expect(setOptionalFeature(out, 'android.hardware.screen.portrait')).toBe(out))
  test('a second feature is added next to the first', () => {
    const both = setOptionalFeature(out, 'android.hardware.microphone')
    expect(both).toContain('"android.hardware.microphone" android:required="false"'); expect(both).toContain('"android.hardware.screen.portrait" android:required="false"')
  })
})
