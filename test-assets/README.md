# test-assets

| Path | Contents | Made by |
|---|---|---|
| `signals/` | Synthetic string and noise WAVs with answer JSON (gitignored, regenerated deterministically) | `npm run gen:signals` |
| `bench/latest.md` | Latest tuner benchmark (the app's analyzer, `v2`). Rewritten on every run but identical unless a result changed — timing goes to the console — so `git diff` shows exactly what a change did | `npm run bench` |
| `trace/` | `scale-80bpm*.json`: analyzer frames for the two trace e2e scenarios (in tune, out of tune) | `scripts/sim-scale.mjs --json` |
| `screens/baseline/` | Visual regression baselines (committed) | `npm run shots:baseline` |
| `screens/current/` | Latest run with `*.diff.png` (gitignored) | `npm run shots` |

To add a real recording to the benchmark, put a WAV in `signals/` with a `.json` of the same name (see the generator for the segment format).
The screenshot script takes the Chromium path from `CHROMIUM_PATH` (Playwright's default otherwise).
