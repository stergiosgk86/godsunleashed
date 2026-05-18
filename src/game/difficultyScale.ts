import { RUN_DURATION } from './runData'

// Mutable singleton written by EnemySpawner, read by enemy constructors and update() calls.
export const difficultyScale = { speed: 0.6, hp: 1.0, damage: 1.0, xp: 1.0 }

// 60% speed at t=0, 115% at t=RUN_DURATION (30 min), linear ramp.
export function computeSpeedScale(elapsedMs: number): number {
  return 0.6 + 0.55 * Math.min(elapsedMs / RUN_DURATION, 1)
}

// 1× HP at t=0, 6× HP at t=RUN_DURATION (30 min), quadratic curve (slow start, steep end).
export function computeHpScale(elapsedMs: number): number {
  const t = Math.min(elapsedMs / RUN_DURATION, 1)
  return 1 + 5 * t * t
}

// 1× damage at t=0, 2.5× damage at t=RUN_DURATION (30 min), linear ramp.
export function computeDamageScale(elapsedMs: number): number {
  return 1 + 1.5 * Math.min(elapsedMs / RUN_DURATION, 1)
}

// 1× XP at t=0, 2× XP at t=RUN_DURATION (30 min), linear ramp.
export function computeXpScale(elapsedMs: number): number {
  return 1 + Math.min(elapsedMs / RUN_DURATION, 1)
}
