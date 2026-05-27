export const RUN_DURATION = 30 * 60 * 1000  // 30 minutes in ms

// Mutable shared object — written by MainScene each frame, polled by HUD via rAF.
// Intentionally not in Zustand to avoid per-frame React re-renders.
export const runData = {
  elapsed: 0,
  waveLabel: '',
  enemyCount: 0,
}
