/** 설정 영속화 (localStorage). 스키마 v3 만 읽는다 — 다른 형식은 기본값(2.4.x 이전 값은 지금의 웹 주소·앱 ID 에 있을 수 없다) */
import { settingsStore, RMS_LEVELS, SMOOTH_LEVELS, CFG, type Settings, type SubDiv, type TimeSig } from '../state/index.ts'
import { t, isLang } from '../core/i18n/index.ts'
import { notice } from '../core/notice.ts'

export const SETTINGS_KEY = 'intonome_settings_v1'

type StoredV3 = { v: 3 } & Settings

/** 저장된 값이 지금 단계 표에 있으면 그 값 */
const step = (v: unknown, table: ReadonlyArray<number>): number | null => typeof v === 'number' && table.some(x => Math.abs(x - v) < 1e-9) ? v : null
function isTimeSig(v: unknown): v is TimeSig { return v === 1 || v === 2 || v === 3 || v === 4 || v === 6 } // 1 = 정박 모드 — 빠지면 새로고침에 풀린다
function isSubDiv(v: unknown): v is SubDiv { return v === 1 || v === 2 || v === 3 || v === 4 || v === 'd' }
const clampBpm = (v: number) => Math.max(CFG.metro.bpmMin, Math.min(CFG.metro.bpmMax, Math.round(v))) // 음수 BPM 은 스케줄러 무한루프

/** 저장된 값 → Settings 부분 객체. 알 수 없는/깨진 값은 무시(기본값 유지). */
export function parseStored(raw: string | null): Partial<Settings> {
  if (!raw) return {}
  let d: unknown
  try { d = JSON.parse(raw) } catch { return {} }
  if (!d || typeof d !== 'object' || (d as StoredV3).v !== 3) return {}
  const out: Partial<Settings> = {}
  // 값 범위도 검증한다 — 손상된 저장값(refHz 1000 등)이 분석기 전체를 틀리게 하지 않게
  const num = (v: unknown, lo: number, hi: number): number | null => typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null
  const tol = (v: unknown): number | null => (typeof v === 'number' && [5, 10, 15].includes(v)) ? v : null
  const s = d as Partial<StoredV3>
  { const v = tol(s.tolCents); if (v !== null) out.tolCents = v }
  { const v = step(s.rmsMin, RMS_LEVELS); if (v !== null) out.rmsMin = v }
  { const v = step(s.smoothing, SMOOTH_LEVELS); if (v !== null) out.smoothing = v }
  if (typeof s.bpm === 'number' && isFinite(s.bpm)) out.bpm = clampBpm(s.bpm)
  if (isTimeSig(s.timeSig)) out.timeSig = s.timeSig
  if (isSubDiv(s.subDiv)) out.subDiv = s.subDiv
  { const v = num(s.refHz, CFG.ref.min, CFG.ref.max); if (v !== null) out.refHz = Math.round(v) }
  { const v = num(s.metroVol, 0, 1); if (v !== null) out.metroVol = v }
  if (s.noteNames === 'ko' || s.noteNames === 'en') out.noteNames = s.noteNames
  if (typeof s.autoDelete === 'boolean') out.autoDelete = s.autoDelete
  if (s.theme === 'dark' || s.theme === 'light') out.theme = s.theme
  if (isLang(s.lang)) out.lang = s.lang
  if (s.aOctave === 2 || s.aOctave === 3 || s.aOctave === 4) out.aOctave = s.aOctave
  if (typeof s.haptics === 'boolean') out.haptics = s.haptics
  if (out.timeSig === 6) out.subDiv = 1 // 6/8 은 세분 없음 — 따로 저장된 값이 시퀀서·스윕을 어긋나게 한다
  return out
}

/** 첫 실행(저장 없음)의 언어: 폰의 첫 번째 언어가 한국어·일본어·중국어·스페인어면 그 언어, 아니면 영어. 중국어는 번체 표시(Hant)나 대만·홍콩·마카오면 번체, 그 밖(본토·싱가포르·말레이시아)은 간체. index.html 의 첫 그리기 스크립트와 같은 규칙 */
export function firstRunLang(langs: readonly string[] | undefined, lang: string | undefined): Settings['lang'] {
  const l = langs?.[0] ?? lang ?? ''
  return /^ko(-|$)/i.test(l) ? 'ko' : /^ja(-|$)/i.test(l) ? 'ja' : /^es(-|$)/i.test(l) ? 'es' : /^zh(-|$)/i.test(l) ? (/hant|-(tw|hk|mo)(-|$)/i.test(l) ? 'zh-Hant' : 'zh-Hans') : 'en'
}

export function loadSettings(): void {
  let raw: string | null = null
  try { raw = localStorage.getItem(SETTINGS_KEY) } catch { /* 사파리 프라이빗 등 */ }
  // 저장이 없으면(첫 실행) 언어만 폰을 따르고 나머지는 기본값(다크 · state/index.ts). 영어는 음이름이 늘 C D E, 한국어는 도레미가 기본. 한 번이라도 저장됐으면 그 값
  // lang 이 없는 저장값(언어 설정이 생기기 전 버전의 설치, 또는 깨진 저장값)도 폰 언어로 — 비워 두면 스토어 기본 'en' 이 되어 한국어 사용자가 업데이트 뒤 영어 화면을 봤다
  const parsed = raw === null ? {} : parseStored(raw)
  settingsStore.set({ lang: firstRunLang(navigator.languages, navigator.language), ...parsed })
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let warned = false
function writeNow(): void {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  const d: StoredV3 = { v: 3, ...settingsStore.get() }
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(d)) } catch { if (!warned) { warned = true; notice(t('set.saveFailed')) } }
}
export function startSettingsAutosave(): void {
  settingsStore.subscribe(() => { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(writeNow, 300) }) // BPM 드래그 중 연속 쓰기 방지
  // 앱이 300 ms 안에 닫히면(안드로이드 뒤로가기 등) 마지막 변경이 유실되므로 숨김/종료 시 즉시 기록
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) writeNow() })
  window.addEventListener('pagehide', () => { if (saveTimer) writeNow() })
}
