// gradle 이 쓸 JDK 찾기. gradlew 는 JAVA_HOME 이나 PATH 의 java 만 본다 — Android Studio 만 깔린 PC 는 둘 다 없어 터미널 빌드가 멈춘다
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

/** Android Studio 에 딸린 JDK(jbr)가 있을 만한 자리 */
export function studioJdkHomes(env = process.env, platform = process.platform) {
  if (platform === 'win32') return [env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Programs', 'Android Studio', 'jbr'), 'C:\\Program Files\\Android\\Android Studio\\jbr'].filter(Boolean)
  if (platform === 'darwin') return ['/Applications/Android Studio.app/Contents/jbr/Contents/Home']
  return ['/opt/android-studio/jbr']
}

/**
 * gradle 에 넘길 JAVA_HOME. 이미 찾을 수 있으면(JAVA_HOME 이 맞거나 PATH 에 java) null — 건드리지 않는다.
 * 못 찾으면 Android Studio 의 JDK, 그것도 없으면 undefined
 */
export function javaHomeForGradle(env = process.env, platform = process.platform, exists = existsSync, onPath = () => !spawnSync(platform === 'win32' ? 'java.exe' : 'java', ['-version'], { stdio: 'ignore' }).error) {
  const exe = platform === 'win32' ? 'java.exe' : 'java'
  if (env.JAVA_HOME && exists(join(env.JAVA_HOME, 'bin', exe))) return null
  if (!env.JAVA_HOME && onPath()) return null // JAVA_HOME 이 틀린 값이면 gradlew 는 PATH 를 보지 않고 멈춘다 — 그때는 아래에서 바꿔 준다
  return studioJdkHomes(env, platform).find(h => exists(join(h, 'bin', exe)))
}
