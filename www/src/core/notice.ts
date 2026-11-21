/**
 * 사용자에게 알릴 한 줄(토스트)의 통로. audio·persist·platform 은 화면을 모르므로 여기에 말하고, 조립 지점(main)이 화면으로 잇는다.
 * 듣는 쪽이 아직 없으면 버린다(시작 전에는 띄울 화면이 없다). 순수
 */
type Listener = (msg: string, ms?: number) => void
let listener: Listener | null = null

export function onNotice(fn: Listener): void { listener = fn }
/** 무언가 해야 하는 안내(저장이 안 돼 녹음이 사라질 수 있다 등)의 시간 — 읽고 행동할 틈. 나머지는 글 길이로 정한다 */
export const NOTICE_IMPORTANT_MS = 8000
/** @param ms 보이는 시간 — 생략하면 글 길이로(ui/toast) */
export function notice(msg: string, ms?: number): void { listener?.(msg, ms) }
/** 듣는 쪽이 있는가 — '한 번만 알린다' 를 실제로 보여 준 뒤에만 기록하려는 곳(wake lock 안내)이 쓴다 */
export const noticeListening = (): boolean => listener !== null
