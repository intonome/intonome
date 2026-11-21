import { describe, test, expect } from 'vitest'
import { setAllowBackup, isWebBuildHtml, setSplashTheme } from './cap-manifest.mjs'

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
