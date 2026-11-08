/** 녹음 이름을 다른 녹음과 겹치지 않게 — 겹치면 ' (2)' · ' (3)' … 을 붙이고, 붙여도 max 자 안에 든다 */
export function uniqueName(name: string, taken: ReadonlySet<string>, max: number): string {
  let out = name
  for (let n = 2; taken.has(out); n++) { const suf = ` (${n})`; out = name.slice(0, max - suf.length) + suf }
  return out
}
