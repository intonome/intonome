import { describe, test, expect } from 'vitest'
import { join } from 'node:path'
import { javaHomeForGradle, studioJdkHomes } from './lib/jdk.mjs'

describe('javaHomeForGradle — the JDK the store build hands to gradle', () => {
  const studio = 'C:\\Program Files\\Android\\Android Studio\\jbr'
  const has = (...homes) => f => homes.some(h => f === join(h, 'bin', 'java.exe'))
  test('a working JAVA_HOME is left alone', () => expect(javaHomeForGradle({ JAVA_HOME: 'D:\\jdk' }, 'win32', has('D:\\jdk', studio), () => false)).toBe(null))
  test('java on PATH is left alone', () => expect(javaHomeForGradle({}, 'win32', has(studio), () => true)).toBe(null))
  test('neither: the JDK that comes with Android Studio', () => expect(javaHomeForGradle({}, 'win32', has(studio), () => false)).toBe(studio))
  test('a per-user Android Studio install is found first', () => {
    const local = join('C:\\Users\\a\\AppData\\Local', 'Programs', 'Android Studio', 'jbr')
    expect(javaHomeForGradle({ LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }, 'win32', has(local, studio), () => false)).toBe(local)
  })
  test('a JAVA_HOME that points nowhere is replaced even with java on PATH (gradlew would stop on it)', () => expect(javaHomeForGradle({ JAVA_HOME: 'D:\\gone' }, 'win32', has(studio), () => true)).toBe(studio))
  test('nothing found', () => expect(javaHomeForGradle({}, 'win32', () => false, () => false)).toBe(undefined))
  test('macOS and Linux look in their own places', () => {
    expect(studioJdkHomes({}, 'darwin')).toEqual(['/Applications/Android Studio.app/Contents/jbr/Contents/Home'])
    expect(javaHomeForGradle({}, 'linux', f => f === join('/opt/android-studio/jbr', 'bin', 'java'), () => false)).toBe('/opt/android-studio/jbr')
  })
})
