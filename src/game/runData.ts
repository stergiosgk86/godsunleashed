export const RUN_DURATION = 20 * 60 * 1000  // 20 minutes in ms

// Mutable shared object — written by MainScene each frame, polled by HUD via rAF.
// Intentionally not in Zustand to avoid per-frame React re-renders.
export const runData = {
  elapsed: 0,
}
