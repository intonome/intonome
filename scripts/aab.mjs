#!/usr/bin/env node
// 스토어용 Android App Bundle — 웹 빌드 → cap sync(매니페스트·버전·서명 보정) → gradle bundleRelease. 결과: android/app/build/outputs/bundle/release/app-release.aab
// 사용: npm run aab   (먼저 npm run keygen 으로 키가 있어야 한다)
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { checkKeystoreProps } from './cap-signing.mjs'
import { javaHomeForGradle } from './lib/jdk.mjs'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const win = process.platform === 'win32'
// Windows 는 npm · gradlew 가 .cmd/.bat 이라 셸로 — 인자를 따로 넘기면 Node 가 경고(DEP0190)를 내므로 한 줄로 만든다(인자는 모두 고정된 낱말)
const run = (cmd, args, cwd = ROOT, env = process.env) => { const r = win ? spawnSync([cmd, ...args].join(' '), { cwd, env, stdio: 'inherit', shell: true }) : spawnSync(cmd, args, { cwd, env, stdio: 'inherit' }); if (r.status !== 0) process.exit(r.status ?? 1) }

if (!existsSync(join(ROOT, 'android'))) { console.error('android/ 없음 — 먼저 `npx cap add android`'); process.exit(1) }
const props = join(ROOT, 'keystore.properties')
if (!existsSync(props)) { console.error('keystore.properties 없음 — 먼저 `npm run keygen`'); process.exit(1) }
const k = checkKeystoreProps(readFileSync(props, 'utf8'), f => existsSync(isAbsolute(f) ? f : join(ROOT, f)))
if (!k.ok) { console.error(k.why); process.exit(1) }

run('npm', ['run', 'cap:sync']) // build:cap → cap sync → cap-manifest(권한·세로·버전) → cap-signing
// gradlew 는 JAVA_HOME 이나 PATH 의 java 만 찾는다. 둘 다 없으면 Android Studio 에 딸린 JDK 를 넘긴다(debug APK 를 만들 때 Android Studio 가 쓰는 것과 같다)
const jdk = javaHomeForGradle()
if (jdk === undefined) { console.error('JDK 를 찾지 못했습니다. Android Studio 가 깔려 있으면 JAVA_HOME 을 그 jbr 폴더로 두고 다시 실행하세요 (예: C:\\Program Files\\Android\\Android Studio\\jbr).'); process.exit(1) }
if (jdk) console.log(`JDK: ${jdk}`)
run(win ? 'gradlew.bat' : './gradlew', ['bundleRelease'], join(ROOT, 'android'), jdk ? { ...process.env, JAVA_HOME: jdk } : process.env)

const out = join(ROOT, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
if (!existsSync(out)) { console.error('AAB 가 만들어지지 않았습니다: ' + out); process.exit(1) }
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const [a, b, c] = version.split('.').map(Number)
console.log(`\nAAB: ${out}\n${(statSync(out).size / 1024 / 1024).toFixed(1)} MB · versionName ${version} · versionCode ${a * 10000 + b * 100 + c}\n이 파일을 Play Console 에 올립니다 (업로드 키로 서명됨 — Play 앱 서명이 배포 키로 다시 서명한다).`)
