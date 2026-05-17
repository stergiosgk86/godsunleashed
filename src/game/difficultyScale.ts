import { RUN_DURATION } from './runData'

// Mutable singleton written by EnemySpawner, read by enemy constructors and update() calls.
export const difficultyScale = { speed: 0.6, hp: 1.0 }

// 60% speed at t=0, 115% at t=RUN_DURATION (20 min), linear ramp.
export function computeSpeedScale(elapsedMs: number): number {
  return 0.6 + 0.55 * Math.min(elapsedMs / RUN_DURATION, 1)
}

// 1× HP at t=0, 3× HP at t=RUN_DURATION (20 min), linear ramp.
export function computeHpScale(elapsedMs: number): number {
  return 1 + 2 * Math.min(elapsedMs / RUN_DURATION, 1)
}
