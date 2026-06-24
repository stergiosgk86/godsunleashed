import { ServerEnemy } from './ServerEnemy.js'
import type { EnemyKind } from './protocol.js'

const RUN_DURATION     = 30 * 60 * 1000
const LANE_MARGIN      = 20    // px beyond screen edge for regular lane spawns (matches frontend)
const SPAWN_MARGIN     = 250   // px beyond screen edge for boss/surge spawns (matches frontend)
const RECYCLE_EXTRA    = 300   // additional px past spawn edge before enemy is recycled (matches frontend)
const DEFAULT_VIEW_W   = 1280  // fallback if client didn't report viewport
const DEFAULT_VIEW_H   = 720
const MAX_ENEMIES      = 250
const SPAWN_SCALE_DURATION = 10 * 60_000  // spawn rate peaks at 10 min, stays maxed after
const FILL_INTERVAL_MS = 300              // ms per fill-spawn when alive < wave minimum
const BOSS_FIRST_SPAWN = 300_000
const BOSS_REPEAT      = 240_000
const BOSS_WARNING     = 5_000
const FINAL_BOSS_LOCK  = RUN_DURATION - 30_000
const SURGE_SPEED_MULT = 2.5
const PRESSURE_ROTATION_MS = 12_000  // rotate dominant spawn direction every 12 s

// ── Difficulty curves (mirrors src/game/difficultyScale.ts) ──────────────────
function computeSpeedScale(_elapsed: number): number {
  return 1.0
}

function computeHpScale(elapsed: number, maxLevel: number): number {
  const t = Math.min(elapsed / RUN_DURATION, 1)
  const timeFloor  = 1 + t * 1.0                    // 1× at start → 2× at 30 min (safety floor)
  const levelScale = 1 + (maxLevel - 1) * 0.15       // 1× at level 1 → ~5× at level 27
  return Math.max(timeFloor, levelScale)
}

// ── Player info passed to the spawner each tick ───────────────────────────────
type SpawnerPlayer = { x: number; y: number; viewW: number; viewH: number; aura: number; auraRange: number; level: number }

// ── Stage 2 HP scaling ────────────────────────────────────────────────────────
function computeStage2HpScale(elapsed: number): number {
  const t = Math.min(elapsed / RUN_DURATION, 1)  // 0→1 over 30 min
  return 1 + t * 5                                // 1× at start, 6× at 30 min
}

// ── VS-style wave minimums — alive enemy floor per elapsed minute ─────────────
// Fill-timer spawns extras whenever alive count drops below the current entry.
const WAVE_MINIMUMS: readonly { minute: number; minimum: number }[] = [
  { minute:  0, minimum:   8 },
  { minute:  1, minimum:  35 },
  { minute:  2, minimum:  50 },
  { minute:  3, minimum:  65 },
  { minute:  4, minimum:  80 },
  { minute:  5, minimum: 100 },
  { minute:  6, minimum: 120 },
  { minute:  7, minimum: 140 },
  { minute:  8, minimum: 158 },
  { minute:  9, minimum: 175 },
  { minute: 10, minimum: 190 },
  { minute: 12, minimum: 210 },
  { minute: 15, minimum: 230 },
  { minute: 18, minimum: 250 },
  { minute: 20, minimum: 265 },
  { minute: 25, minimum: 280 },
]

// ── Lane definitions (mirrors EnemySpawner.ts LANE_DEFS) ─────────────────────
type SpawnKind = 'basic' | 'speeder' | 'tank' | 'exploder' | 'ghost' | 'ranged' | 'charger' | 'necromancer' | 'veteran' | 'brute' | 'revenant' | 'warlord' | 'titan'
type Stage2Kind = 'drifter' | 'scurrier' | 'lurker' | 'mummy' | 'jackal' | 'cultist' | 'golem' | 'knight' | 'archfiend'

interface LaneDef {
  type: SpawnKind
  startTime: number
  intervalStart: number
  intervalEnd: number
  burstStart: number
  burstEnd: number
}

interface Stage2LaneDef {
  type: Stage2Kind
  startTime: number
  intervalStart: number
  intervalEnd: number
  burstStart: number
  burstEnd: number
}

// VS Inlaid Library–inspired: left/right only, 9 progressive enemy types
// Intervals ramp from slow → fast over 30 min. Burst size grows to match VS density escalation.
const STAGE2_LANE_DEFS: Stage2LaneDef[] = [
  { type: 'drifter',   startTime: 0,         intervalStart: 1600, intervalEnd: 350,  burstStart: 1, burstEnd: 7  },
  { type: 'scurrier',  startTime: 0,         intervalStart: 1400, intervalEnd: 280,  burstStart: 1, burstEnd: 9  },
  { type: 'lurker',    startTime: 30_000,    intervalStart: 2200, intervalEnd: 500,  burstStart: 1, burstEnd: 4  },
  { type: 'mummy',     startTime: 60_000,    intervalStart: 4500, intervalEnd: 1500, burstStart: 1, burstEnd: 2  },
  { type: 'jackal',    startTime: 90_000,    intervalStart: 1500, intervalEnd: 320,  burstStart: 2, burstEnd: 8  },
  { type: 'cultist',   startTime: 150_000,   intervalStart: 3200, intervalEnd: 800,  burstStart: 1, burstEnd: 3  },
  { type: 'golem',     startTime: 240_000,   intervalStart: 7000, intervalEnd: 3000, burstStart: 1, burstEnd: 1  },
  { type: 'knight',    startTime: 360_000,   intervalStart: 5500, intervalEnd: 2200, burstStart: 1, burstEnd: 2  },
  { type: 'archfiend', startTime: 480_000,   intervalStart: 9000, intervalEnd: 3500, burstStart: 1, burstEnd: 2  },
]

// Scripted mass-rush events — all from one side, faster than normal (SURGE_SPEED_MULT)
const STAGE2_SURGE_EVENTS: SurgeDef[] = [
  { triggerTime:  2 * 60_000, type: 'drifter'  as unknown as SpawnKind, count: 50,  spawnInterval: 28  },
  { triggerTime:  5 * 60_000, type: 'scurrier' as unknown as SpawnKind, count: 60,  spawnInterval: 22  },
  { triggerTime:  8 * 60_000, type: 'drifter'  as unknown as SpawnKind, count: 80,  spawnInterval: 18  },
  { triggerTime: 11 * 60_000, type: 'jackal'   as unknown as SpawnKind, count: 70,  spawnInterval: 25  },
  { triggerTime: 15 * 60_000, type: 'lurker'   as unknown as SpawnKind, count: 60,  spawnInterval: 30  },
  { triggerTime: 18 * 60_000, type: 'scurrier' as unknown as SpawnKind, count: 120, spawnInterval: 15  },
  { triggerTime: 20 * 60_000, type: 'golem'    as unknown as SpawnKind, count: 20,  spawnInterval: 200 },
  { triggerTime: 23 * 60_000, type: 'jackal'   as unknown as SpawnKind, count: 100, spawnInterval: 18  },
  { triggerTime: 25 * 60_000, type: 'cultist'  as unknown as SpawnKind, count: 50,  spawnInterval: 35  },
  { triggerTime: 27 * 60_000, type: 'drifter'  as unknown as SpawnKind, count: 160, spawnInterval: 12  },
]

const LANE_DEFS: LaneDef[] = [
  { type: 'basic',       startTime: 0,          intervalStart: 1000,  intervalEnd: 250,  burstStart: 1, burstEnd: 8 },
  { type: 'speeder',     startTime: 50_000,     intervalStart: 1800,  intervalEnd: 350,  burstStart: 2, burstEnd: 4 },
  { type: 'tank',        startTime: 90_000,     intervalStart: 3000,  intervalEnd: 800,  burstStart: 1, burstEnd: 2 },
  { type: 'exploder',    startTime: 120_000,    intervalStart: 3500,  intervalEnd: 900,  burstStart: 1, burstEnd: 2 },
  { type: 'ghost',       startTime: 150_000,    intervalStart: 3000,  intervalEnd: 800,  burstStart: 1, burstEnd: 2 },
  { type: 'ranged',      startTime: 210_000,    intervalStart: 2500,  intervalEnd: 600,  burstStart: 1, burstEnd: 2 },
  { type: 'veteran',     startTime: 300_000,    intervalStart: 2500,  intervalEnd: 500,  burstStart: 1, burstEnd: 4 },
  { type: 'charger',     startTime: 480_000,    intervalStart: 4000,  intervalEnd: 1200, burstStart: 1, burstEnd: 2 },
  { type: 'brute',       startTime: 600_000,    intervalStart: 4500,  intervalEnd: 1500, burstStart: 1, burstEnd: 2 },
  { type: 'necromancer', startTime: 780_000,    intervalStart: 6000,  intervalEnd: 2000, burstStart: 1, burstEnd: 1 },
  { type: 'revenant',    startTime: 900_000,    intervalStart: 3000,  intervalEnd: 750,  burstStart: 1, burstEnd: 3 },
  { type: 'warlord',     startTime: 1_200_000,  intervalStart: 7000,  intervalEnd: 2500, burstStart: 1, burstEnd: 2 },
  { type: 'titan',       startTime: 1_500_000,  intervalStart: 14000, intervalEnd: 6000, burstStart: 1, burstEnd: 1 },
]

// ── Surge events (mirrors EnemySpawner.ts SURGE_EVENTS) ──────────────────────
interface SurgeDef {
  triggerTime: number
  type: SpawnKind
  count: number
  spawnInterval: number
}

const SURGE_EVENTS: SurgeDef[] = [
  { triggerTime:  2 * 60_000, type: 'basic',   count: 60,  spawnInterval: 25  },
  { triggerTime:  5 * 60_000, type: 'speeder', count: 40,  spawnInterval: 30  },
  { triggerTime:  7 * 60_000, type: 'basic',   count: 80,  spawnInterval: 20  },
  { triggerTime: 11 * 60_000, type: 'basic',   count: 150, spawnInterval: 15  },
  { triggerTime: 13 * 60_000, type: 'ghost',   count: 35,  spawnInterval: 40  },
  { triggerTime: 15 * 60_000, type: 'speeder', count: 70,  spawnInterval: 25  },
  { triggerTime: 18 * 60_000, type: 'basic',   count: 100, spawnInterval: 15  },
  { triggerTime: 20 * 60_000, type: 'tank',    count: 20,  spawnInterval: 150 },
  { triggerTime: 23 * 60_000, type: 'basic',   count: 160, spawnInterval: 12  },
  { triggerTime: 25 * 60_000, type: 'speeder', count: 90,  spawnInterval: 20  },
  { triggerTime: 27 * 60_000, type: 'ghost',   count: 60,  spawnInterval: 35  },
]

interface ActiveSurge {
  type: SpawnKind
  remaining: number
  timer: number
  spawnInterval: number
  nextEdge: number  // cycles 0→1→2→3→0 so the surge arrives from all sides
}

// Stage 5: The Labyrinth — 25×25 grid maze (must match MainScene constants)
const S5_CELL     = 200
const S5_ROWS     = 25
const S5_COLS     = 25
const S5_MAP_HALF = (S5_COLS * S5_CELL) / 2  // 2500
const S5_WORLD_LEFT = -S5_MAP_HALF
const S5_WORLD_TOP  = -S5_MAP_HALF
const S5_MAZE_GRID: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1], // row 0  — N entry col 12
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 1  — wide top hall
  [1,0,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1], // row 2  — chokes: 1,4,11,20,23
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1], // row 3  — three chambers
  [1,1,1,1,1,0,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,0,1], // row 4  — chokes: 5,7,10,16,22,23
  [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0,1], // row 5  — corridors
  [1,0,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1], // row 6  — chokes: 1,5,11,17,23
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1], // row 7  — mid corridors
  [1,1,1,0,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,0,1], // row 8  — chokes: 3,7,13,19,23
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1], // row 9  — approach corridors
  [1,0,1,1,1,0,1,1,1,0,0,0,0,0,0,0,1,1,1,0,1,1,1,0,1], // row 10 — arena top + outer spurs
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 11 — wide ring around arena
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // row 12 — W/E entries; fully open
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 13 — wide ring around arena
  [1,0,1,1,1,0,1,1,1,0,0,0,0,0,0,0,1,1,1,0,1,1,1,0,1], // row 14 — arena bottom + outer spurs
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1], // row 15 — approach corridors
  [1,1,1,0,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,0,1], // row 16 — chokes: 3,7,13,19,23
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1], // row 17 — mid corridors
  [1,0,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1], // row 18 — chokes: 1,5,11,17,23
  [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0,1], // row 19 — corridors
  [1,1,1,1,1,0,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,0,1], // row 20 — chokes: 5,7,10,16,22,23
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1], // row 21 — three chambers
  [1,0,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1], // row 22 — chokes: 1,4,11,20,23
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // row 23 — wide bottom hall
  [1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1], // row 24 — S exit col 12
]
function s5IsWall(wx: number, wy: number): boolean {
  const col = Math.floor((wx - S5_WORLD_LEFT) / S5_CELL)
  const row = Math.floor((wy - S5_WORLD_TOP)  / S5_CELL)
  if (row < 0 || row >= S5_ROWS || col < 0 || col >= S5_COLS) return true
  return S5_MAZE_GRID[row][col] === 1
}

export class ServerSpawner {
  disabled = false  // set true for stages that manage their own enemies
  stage2Mode = false  // VS Inlaid Library style — left/right only, 9 unique enemy types
  stage4Mode = false  // Tartarus — same as Stage 1 but 1.5× harder HP scaling
  stage5Mode = false  // The Labyrinth — cross-corridor, 4-directional Stage-2 enemy set
  corridorHalfY: number | null = null  // non-null in stage 2: clamps enemy Y to ±this value
  private enemies: ServerEnemy[] = []
  private elapsed   = 0
  private laneTimers: number[] = LANE_DEFS.map(l => l.intervalStart)
  private laneEdgeCtr: number[] = LANE_DEFS.map((_, i) => i % 4)  // staggered so lanes hit different edges
  private fillEdgeCtr = 0
  private nextBossAt        = BOSS_FIRST_SPAWN
  private bossAlive         = false
  private firstBossSpawned  = false
  private warningFired      = false
  private finalBossAlive    = false
  private finalWarningFired = false
  private surgesFired       = new Set<number>()
  private surgeQueue: ActiveSurge[] = []
  private fillTimer         = 0
  private freezeTimer       = 0
  // Directional pressure: dominant spawn edge rotates every 12 s (VS-style waves)
  private pressureEdge = 0
  private pressureTimer = 0
  // Stage 2 state
  private stage2LaneTimers: number[] = STAGE2_LANE_DEFS.map(l => l.intervalStart)
  private stage2SurgesFired = new Set<number>()
  private stage2SurgeQueue: ActiveSurge[] = []
  private stage2InitialFillDone = false
  // Stage 5 state (reuses Stage 2 enemy types, 4-directional)
  private stage5LaneTimers: number[] = STAGE2_LANE_DEFS.map(l => l.intervalStart)
  private stage5SurgesFired = new Set<number>()
  private stage5SurgeQueue: ActiveSurge[] = []
  private stage5InitialFillDone = false
  private minotaur: ServerEnemy | null = null
  private minotaurDefeated = false
  private exitReached = false

  onBossWarning?:       (final: boolean) => void
  onBossSpawn?:         (e: ServerEnemy) => void
  onFinalBossDefeated?: () => void
  onMinotaurDefeated?:  () => void
  onSurge?:             (type: string) => void
  onBossInvuln?:        (bossId: number, invulnerable: boolean) => void
  onExploderExplode?:   (x: number, y: number) => void

  get all(): ServerEnemy[]  { return this.enemies }
  get runElapsed(): number   { return this.elapsed }
  get isFinished(): boolean  {
    if (this.stage5Mode) return this.exitReached
    if (this.stage2Mode) return this.elapsed >= RUN_DURATION
    return this.elapsed >= RUN_DURATION && !this.finalBossAlive
  }

  // Fast-forward to a mid-run point without firing any surge/boss events.
  // Called when a solo player reconnects after a page refresh.
  resumeFrom(ms: number) {
    this.elapsed = ms
    this.stage2InitialFillDone = true
    this.stage5InitialFillDone = true
    for (const surge of SURGE_EVENTS) {
      if (surge.triggerTime <= ms) this.surgesFired.add(surge.triggerTime)
    }
    for (const surge of STAGE2_SURGE_EVENTS) {
      if (surge.triggerTime <= ms) this.stage2SurgesFired.add(surge.triggerTime)
      if (surge.triggerTime <= ms) this.stage5SurgesFired.add(surge.triggerTime)
    }
    // Advance nextBossAt past all boss cycles that would have completed
    while (this.nextBossAt <= ms) {
      this.nextBossAt += BOSS_REPEAT
      this.firstBossSpawned = true
    }
    // Mark warnings as already fired so they don't re-trigger on the first tick
    if (ms >= this.nextBossAt - BOSS_REPEAT - BOSS_WARNING) this.warningFired = true
    if (ms >= RUN_DURATION - BOSS_WARNING) this.finalWarningFired = true
  }

  update(players: SpawnerPlayer[], delta: number) {
    if (this.disabled) { this.elapsed += delta; return }
    this.elapsed += delta
    if (this.stage2Mode) { this.updateStage2(players, delta); return }
    if (this.stage5Mode) { this.updateStage5(players, delta); return }

    const speedMult   = computeSpeedScale(this.elapsed)
    const maxLevel    = players.length > 0 ? Math.max(...players.map(p => p.level)) : 1
    const hpMult      = computeHpScale(this.elapsed, maxLevel) * (this.stage4Mode ? 1.5 : 1)
    const inFinal     = this.finalBossAlive || this.elapsed >= FINAL_BOSS_LOCK
    const playerScale = Math.sqrt(Math.max(1, players.length))
    const enemyCap    = Math.round(MAX_ENEMIES * playerScale)

    // Rotate dominant spawn direction clockwise — creates VS-style directional waves
    this.pressureTimer += delta
    if (this.pressureTimer >= PRESSURE_ROTATION_MS) {
      this.pressureTimer = 0
      this.pressureEdge  = (this.pressureEdge + 1) % 4
    }

    // ── VS-style minimum count fill ───────────────────────────────────────────
    // If alive enemies drop below the current wave minimum, fill rapidly (80 ms/enemy).
    // This guarantees the screen is never sparse regardless of how fast the player kills.
    if (!inFinal && players.length > 0) {
      const elapsedMin = Math.floor(this.elapsed / 60_000)
      let waveMin = 0
      for (const w of WAVE_MINIMUMS) {
        if (w.minute <= elapsedMin) waveMin = w.minimum
      }
      const scaledMin = Math.round(waveMin * playerScale)
      if (this.enemies.length < scaledMin && this.enemies.length < enemyCap) {
        this.fillTimer -= delta
        if (this.fillTimer <= 0) {
          this.fillTimer += FILL_INTERVAL_MS
          // 55% from dominant edge, 25% from opposite (pincer), 20% random flank
          const fr   = Math.random()
          const edge = fr < 0.55 ? this.pressureEdge
                     : fr < 0.80 ? (this.pressureEdge + 2) % 4
                     : Math.floor(Math.random() * 4)
          const pos  = this.laneEdgePoint(players, edge)
          this.spawnEnemy('basic', pos.x, pos.y, hpMult, players)
        }
      }
    }

    // ── Independent per-lane spawning ─────────────────────────────────────────
    for (let i = 0; i < LANE_DEFS.length; i++) {
      const lane = LANE_DEFS[i]
      if (this.elapsed < lane.startTime) continue
      this.laneTimers[i] -= delta
      if (this.laneTimers[i] <= 0 && this.enemies.length < enemyCap) {
        this.laneTimers[i] = this.laneInterval(lane)
        const count = Math.min(this.laneBurst(lane), enemyCap - this.enemies.length)
        // 65% bursts from dominant pressure edge, 35% from cycle — avoids pure blob
        const cycleEdge   = this.laneEdgeCtr[i]++ % 4
        const burstEdge   = Math.random() < 0.65 ? this.pressureEdge : cycleEdge
        const burstCenter = (Math.random() * 2 - 1) * 0.6
        for (let j = 0; j < count; j++) {
          const pos = this.laneEdgePoint(players, burstEdge, burstCenter)
          this.spawnEnemy(lane.type, pos.x, pos.y, hpMult, players)
        }
      }
    }

    // ── Scripted surge events ─────────────────────────────────────────────────
    for (const surge of SURGE_EVENTS) {
      if (!this.surgesFired.has(surge.triggerTime) && this.elapsed >= surge.triggerTime) {
        this.surgesFired.add(surge.triggerTime)
        this.onSurge?.(surge.type)
        this.surgeQueue.push({
          type: surge.type, remaining: surge.count, timer: 0,
          spawnInterval: surge.spawnInterval,
          nextEdge: Math.floor(Math.random() * 4),  // random start, cycles through all 4
        })
      }
    }
    for (const surge of this.surgeQueue) {
      surge.timer -= delta
      if (surge.timer <= 0 && surge.remaining > 0 && this.enemies.length < enemyCap + 200) {
        surge.timer += surge.spawnInterval
        const pos = this.surgeEdgePoint(players, surge.nextEdge)
        surge.nextEdge = (surge.nextEdge + 1) % 4
        const e   = this.spawnEnemy(surge.type, pos.x, pos.y, hpMult, players)
        e.speedMult = SURGE_SPEED_MULT
        surge.remaining--
      }
    }
    this.surgeQueue = this.surgeQueue.filter(s => s.remaining > 0)

    // ── Regular boss cycle ────────────────────────────────────────────────────
    if (!inFinal) {
      if (!this.bossAlive && !this.warningFired && this.elapsed >= this.nextBossAt - BOSS_WARNING) {
        this.warningFired = true
        this.onBossWarning?.(false)
      }
      if (!this.bossAlive && this.elapsed >= this.nextBossAt) {
        this.spawnBoss(players, hpMult)
      }
    }

    // ── Final boss ────────────────────────────────────────────────────────────
    if (!this.finalWarningFired && this.elapsed >= RUN_DURATION - BOSS_WARNING) {
      this.finalWarningFired = true
      this.onBossWarning?.(true)
    }
    if (!this.finalBossAlive && this.finalWarningFired && this.elapsed >= RUN_DURATION) {
      this.finalBossAlive = true
      const pos = this.edgePoint(players)
      const e   = new ServerEnemy('finalBoss', pos.x, pos.y, hpMult)
      this.enemies.push(e)
      this.onBossSpawn?.(e)
    }

    // ── Move all enemies ──────────────────────────────────────────────────────
    this.freezeTimer = Math.max(0, this.freezeTimer - delta)
    const effectiveSpeed = this.freezeTimer > 0 ? 0 : speedMult
    for (const e of this.enemies) {
      if (!e.active) continue
      const nearest = this.nearestPlayerTo(e.x, e.y, players)
      e.update(nearest.x, nearest.y, delta, effectiveSpeed)
      if (this.corridorHalfY !== null) {
        if (e.y < -this.corridorHalfY) e.y = -this.corridorHalfY
        else if (e.y > this.corridorHalfY) e.y = this.corridorHalfY
      }
    }

    // ── Boss death detection ──────────────────────────────────────────────────
    if (this.bossAlive && !this.enemies.some(e => (e.kind === 'boss' || e.kind === 'summoner') && e.active)) {
      this.bossAlive    = false
      this.warningFired = false
      this.nextBossAt   = this.elapsed + BOSS_REPEAT
    }
    if (this.finalBossAlive && !this.enemies.some(e => e.kind === 'finalBoss' && e.active)) {
      this.finalBossAlive = false
      this.onFinalBossDefeated?.()
    }

    // ── Recycle enemies that have wandered far from every player ──────────────
    // Ghosts self-despawn; bosses stay put.
    if (players.length > 0) {
      for (const e of this.enemies) {
        if (!e.active || e.isBoss || e.kind === 'ghost') continue
        let minDist2 = Infinity
        for (const p of players) {
          const zoom = p.viewW <= 768 ? 0.7 : 1.2
          const rHalfW = (p.viewW / 2) / zoom + SPAWN_MARGIN + RECYCLE_EXTRA
          const rHalfH = (p.viewH / 2) / zoom + SPAWN_MARGIN + RECYCLE_EXTRA
          const dx = Math.abs(e.x - p.x), dy = Math.abs(e.y - p.y)
          const d2 = Math.max(dx / rHalfW, dy / rHalfH)  // 1.0 = exactly at recycle boundary
          if (d2 < minDist2) minDist2 = d2
        }
        if (minDist2 > 1) {
          // Respawn from dominant or opposite edge — keeps directional pressure alive
          const recycleEdge = Math.random() < 0.60
            ? this.pressureEdge
            : (this.pressureEdge + 2) % 4
          const pos = this.laneEdgePoint(players, recycleEdge)
          e.x = pos.x
          e.y = pos.y
        }
      }
    }

    // ── Separation: push overlapping enemies apart ────────────────────────────
    const SEP_RADIUS = 40
    const SEP_FORCE  = 1.0
    const SEP_MAX    = 5
    const active = this.enemies.filter(e => e.active && !e.isBoss)
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = dx * dx + dy * dy
        if (d2 < SEP_RADIUS * SEP_RADIUS && d2 > 0) {
          const d  = Math.sqrt(d2)
          const push = Math.min((SEP_RADIUS - d) * SEP_FORCE, SEP_MAX)
          const nx = dx / d, ny = dy / d
          a.x += nx * push; a.y += ny * push
          b.x -= nx * push; b.y -= ny * push
        }
      }
    }

    this.enemies = this.enemies.filter(e => e.active)
  }

  findById(id: number): ServerEnemy | undefined {
    return this.enemies.find(e => e.id === id)
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private laneInterval(lane: LaneDef): number {
    if (this.elapsed <= lane.startTime) return lane.intervalStart
    const t = Math.min((this.elapsed - lane.startTime) / SPAWN_SCALE_DURATION, 1)
    return lane.intervalStart + (lane.intervalEnd - lane.intervalStart) * t
  }

  private laneBurst(lane: LaneDef): number {
    if (this.elapsed <= lane.startTime) return lane.burstStart
    const t = Math.min((this.elapsed - lane.startTime) / SPAWN_SCALE_DURATION, 1)
    return Math.round(lane.burstStart + (lane.burstEnd - lane.burstStart) * t)
  }

  private spawnEnemy(kind: SpawnKind, x: number, y: number, hpMult: number, players: SpawnerPlayer[]): ServerEnemy {
    const e = new ServerEnemy(kind as EnemyKind, x, y, hpMult)
    if (kind === 'ghost') {
      const target = this.nearestPlayerTo(x, y, players)
      e.initGhost(target.x, target.y)
    }
    if (kind === 'exploder') {
      e.onExplode = (ex, ey) => this.onExploderExplode?.(ex, ey)
    }
    this.enemies.push(e)
    return e
  }

  private spawnBoss(players: SpawnerPlayer[], hpMult: number) {
    this.bossAlive = true
    const pos = this.edgePoint(players)
    if (!this.firstBossSpawned) {
      this.firstBossSpawned = true
      const summoner = new ServerEnemy('summoner', pos.x, pos.y, hpMult)
      summoner.onSummon = (sx, sy, count, phase2) => {
        for (let i = 0; i < count; i++) {
          const a  = (i / count) * Math.PI * 2
          const mx = sx + Math.cos(a) * (80 + Math.random() * 60)
          const my = sy + Math.sin(a) * (80 + Math.random() * 60)
          const mk: EnemyKind = phase2 && i % 2 === 0 ? 'speeder' : 'basic'
          this.enemies.push(new ServerEnemy(mk, mx, my, hpMult))
        }
      }
      summoner.onInvulnChange = (invuln) => {
        this.onBossInvuln?.(summoner.id, invuln)
      }
      this.enemies.push(summoner)
      this.onBossSpawn?.(summoner)
    } else {
      const boss = new ServerEnemy('boss', pos.x, pos.y, hpMult)
      this.enemies.push(boss)
      this.onBossSpawn?.(boss)
    }
  }

  private nearestPlayerTo(ex: number, ey: number, players: SpawnerPlayer[]): SpawnerPlayer {
    if (players.length === 0) return { x: 2000, y: 2000, viewW: DEFAULT_VIEW_W, viewH: DEFAULT_VIEW_H, aura: 0, auraRange: 0, level: 1 }
    let nearest = players[0]
    let minD2   = Infinity
    for (const p of players) {
      const dx = p.x - ex, dy = p.y - ey
      const d2 = dx * dx + dy * dy
      if (d2 < minD2) { minD2 = d2; nearest = p }
    }
    return nearest
  }

  // Spawn on a screen edge. clusterCenter (-1..1) biases position along the edge;
  // each enemy varies ±35% around it so the burst arrives as a visible group.
  private laneEdgePoint(players: SpawnerPlayer[], fixedEdge?: number, clusterCenter?: number): { x: number; y: number } {
    const p    = players.length > 0 ? players[Math.floor(Math.random() * players.length)] : { x: 2000, y: 2000, viewW: DEFAULT_VIEW_W, viewH: DEFAULT_VIEW_H }
    const zoom = p.viewW <= 768 ? 0.7 : 1.2
    const halfW = (p.viewW / 2) / zoom + LANE_MARGIN
    const halfH = (p.viewH / 2) / zoom + LANE_MARGIN
    const edge  = fixedEdge ?? Math.floor(Math.random() * 4)
    const cc    = clusterCenter ?? (Math.random() * 2 - 1)
    const along = Math.max(-1, Math.min(1, cc + (Math.random() * 2 - 1) * 0.35))
    switch (edge) {
      case 0: return { x: p.x + along * halfW, y: p.y - halfH }
      case 1: return { x: p.x + along * halfW, y: p.y + halfH }
      case 2: return { x: p.x - halfW, y: p.y + along * halfH }
      default: return { x: p.x + halfW, y: p.y + along * halfH }
    }
  }

  // Spawn just off a random screen edge using SPAWN_MARGIN — for boss/final boss.
  private edgePoint(players: SpawnerPlayer[]): { x: number; y: number } {
    const p    = players.length > 0 ? players[Math.floor(Math.random() * players.length)] : { x: 2000, y: 2000, viewW: DEFAULT_VIEW_W, viewH: DEFAULT_VIEW_H }
    const zoom = p.viewW <= 768 ? 0.7 : 1.2
    const halfW = (p.viewW / 2) / zoom + SPAWN_MARGIN
    const halfH = (p.viewH / 2) / zoom + SPAWN_MARGIN
    const edge  = Math.floor(Math.random() * 4)
    switch (edge) {
      case 0: return { x: p.x + (Math.random() * 2 - 1) * halfW, y: p.y - halfH }
      case 1: return { x: p.x + (Math.random() * 2 - 1) * halfW, y: p.y + halfH }
      case 2: return { x: p.x - halfW, y: p.y + (Math.random() * 2 - 1) * halfH }
      default: return { x: p.x + halfW, y: p.y + (Math.random() * 2 - 1) * halfH }
    }
  }

  // Surge: spawn just off the given edge (0=top 1=bottom 2=left 3=right) with SPAWN_MARGIN.
  private surgeEdgePoint(players: SpawnerPlayer[], edge: number): { x: number; y: number } {
    const p    = players.length > 0 ? players[Math.floor(Math.random() * players.length)] : { x: 2000, y: 2000, viewW: DEFAULT_VIEW_W, viewH: DEFAULT_VIEW_H }
    const zoom = p.viewW <= 768 ? 0.7 : 1.2
    const halfW = (p.viewW / 2) / zoom + SPAWN_MARGIN
    const halfH = (p.viewH / 2) / zoom + SPAWN_MARGIN
    const along = (Math.random() * 2 - 1)
    switch (edge) {
      case 0: return { x: p.x + along * halfW, y: p.y - halfH }
      case 1: return { x: p.x + along * halfW, y: p.y + halfH }
      case 2: return { x: p.x - halfW, y: p.y + along * halfH }
      default: return { x: p.x + halfW, y: p.y + along * halfH }
    }
  }

  // ── Stage 2 update loop ───────────────────────────────────────────────────

  private updateStage2(players: SpawnerPlayer[], delta: number) {
    const hpMult   = computeStage2HpScale(this.elapsed)
    const MAX_S2   = 400

    // Initial fill — a small cluster from each side
    if (!this.stage2InitialFillDone && players.length > 0) {
      this.stage2InitialFillDone = true
      for (let i = 0; i < 3; i++) {
        const side = i < 2 ? i : Math.round(Math.random())
        const pos  = this.corridorEdgePoint(players, side)
        this.enemies.push(new ServerEnemy('drifter', pos.x, pos.y, hpMult))
      }
    }

    // Per-lane spawning — each lane independent, burst from one side
    for (let i = 0; i < STAGE2_LANE_DEFS.length; i++) {
      const lane = STAGE2_LANE_DEFS[i]
      if (this.elapsed < lane.startTime) continue
      this.stage2LaneTimers[i] -= delta
      if (this.stage2LaneTimers[i] <= 0 && this.enemies.length < MAX_S2) {
        this.stage2LaneTimers[i] = this.stage2LaneInterval(lane)
        const count = Math.min(this.stage2LaneBurst(lane), MAX_S2 - this.enemies.length)
        const side  = Math.round(Math.random())
        for (let j = 0; j < count; j++) {
          const pos = this.corridorEdgePoint(players, side)
          this.enemies.push(new ServerEnemy(lane.type as EnemyKind, pos.x, pos.y, hpMult))
        }
      }
    }

    // Scripted surge events — all enemies from one fixed side with speed boost
    for (const surge of STAGE2_SURGE_EVENTS) {
      if (!this.stage2SurgesFired.has(surge.triggerTime) && this.elapsed >= surge.triggerTime) {
        this.stage2SurgesFired.add(surge.triggerTime)
        this.onSurge?.(surge.type)
        this.stage2SurgeQueue.push({
          type: surge.type, remaining: surge.count, timer: 0,
          spawnInterval: surge.spawnInterval,
          angle: Math.random() < 0.5 ? 0 : Math.PI,  // 0 = right edge, π = left edge
        })
      }
    }
    for (const surge of this.stage2SurgeQueue) {
      surge.timer -= delta
      if (surge.timer <= 0 && surge.remaining > 0 && this.enemies.length < MAX_S2 + 100) {
        surge.timer += surge.spawnInterval
        const side = Math.cos(surge.angle) >= 0 ? 1 : 0
        const pos  = this.corridorEdgePoint(players, side)
        const e    = new ServerEnemy(surge.type as EnemyKind, pos.x, pos.y, hpMult)
        e.speedMult = SURGE_SPEED_MULT
        this.enemies.push(e)
        surge.remaining--
      }
    }
    this.stage2SurgeQueue = this.stage2SurgeQueue.filter(s => s.remaining > 0)

    // Move all enemies and clamp to corridor
    this.freezeTimer = Math.max(0, this.freezeTimer - delta)
    for (const e of this.enemies) {
      if (!e.active) continue
      const nearest = this.nearestPlayerTo(e.x, e.y, players)
      e.update(nearest.x, nearest.y, delta, this.freezeTimer > 0 ? 0 : 1)
      if (this.corridorHalfY !== null) {
        if (e.y < -this.corridorHalfY) e.y = -this.corridorHalfY
        else if (e.y > this.corridorHalfY) e.y = this.corridorHalfY
      }
    }

    // Recycle enemies that wandered off-screen — reposition to left or right edge
    if (players.length > 0) {
      for (const e of this.enemies) {
        if (!e.active) continue
        let minDist2 = Infinity
        for (const p of players) {
          const zoom   = p.viewW <= 768 ? 0.7 : 1.2
          const rHalfW = (p.viewW / 2) / zoom + SPAWN_MARGIN + RECYCLE_EXTRA
          const rHalfH = (p.viewH / 2) / zoom + SPAWN_MARGIN + RECYCLE_EXTRA
          const dx = Math.abs(e.x - p.x), dy = Math.abs(e.y - p.y)
          const d2 = Math.max(dx / rHalfW, dy / rHalfH)
          if (d2 < minDist2) minDist2 = d2
        }
        if (minDist2 > 1) {
          const pos = this.corridorEdgePoint(players, Math.round(Math.random()))
          e.x = pos.x
          e.y = pos.y
        }
      }
    }

    // Separation
    const SEP_RADIUS = 40, SEP_FORCE = 1.0, SEP_MAX = 5
    const active = this.enemies.filter(e => e.active)
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j]
        const dx = a.x - b.x, dy = a.y - b.y
        const d2 = dx * dx + dy * dy
        if (d2 < SEP_RADIUS * SEP_RADIUS && d2 > 0) {
          const d    = Math.sqrt(d2)
          const push = Math.min((SEP_RADIUS - d) * SEP_FORCE, SEP_MAX)
          const nx = dx / d, ny = dy / d
          a.x += nx * push; a.y += ny * push
          b.x -= nx * push; b.y -= ny * push
        }
      }
    }

    this.enemies = this.enemies.filter(e => e.active)
  }

  // ── Stage 5 update loop (cross-corridor labyrinth) ───────────────────────────
  private updateStage5(players: SpawnerPlayer[], delta: number) {
    const hpMult = computeStage2HpScale(this.elapsed)
    const MAX_S5 = 300

    if (!this.stage5InitialFillDone && players.length > 0) {
      this.stage5InitialFillDone = true
      // Announce and spawn the Minotaur at the maze center
      this.onBossWarning?.(false)
      this.minotaur = new ServerEnemy('minotaur', 0, 0, hpMult)
      this.enemies.push(this.minotaur)
      this.onBossSpawn?.(this.minotaur)
      // Seed entry corridors with initial enemies
      for (let i = 0; i < 4; i++) {
        const pos = this.stage5EdgePoint(i)
        this.enemies.push(new ServerEnemy('drifter', pos.x, pos.y, hpMult))
      }
    }

    for (let i = 0; i < STAGE2_LANE_DEFS.length; i++) {
      const lane = STAGE2_LANE_DEFS[i]
      if (this.elapsed < lane.startTime) continue
      this.stage5LaneTimers[i] -= delta
      if (this.stage5LaneTimers[i] <= 0 && this.enemies.length < MAX_S5) {
        this.stage5LaneTimers[i] = this.stage2LaneInterval(lane)
        const count = Math.min(this.stage2LaneBurst(lane), MAX_S5 - this.enemies.length)
        const side  = Math.floor(Math.random() * 4)
        for (let j = 0; j < count; j++) {
          const pos = this.stage5EdgePoint(side)
          this.enemies.push(new ServerEnemy(lane.type as EnemyKind, pos.x, pos.y, hpMult))
        }
      }
    }

    for (const surge of STAGE2_SURGE_EVENTS) {
      if (!this.stage5SurgesFired.has(surge.triggerTime) && this.elapsed >= surge.triggerTime) {
        this.stage5SurgesFired.add(surge.triggerTime)
        this.onSurge?.(surge.type)
        this.stage5SurgeQueue.push({
          type: surge.type, remaining: surge.count, timer: 0,
          spawnInterval: surge.spawnInterval,
          nextEdge: Math.floor(Math.random() * 4),
        })
      }
    }
    for (const surge of this.stage5SurgeQueue) {
      surge.timer -= delta
      if (surge.timer <= 0 && surge.remaining > 0 && this.enemies.length < MAX_S5 + 100) {
        surge.timer += surge.spawnInterval
        const pos = this.stage5EdgePoint(surge.nextEdge % 4)
        surge.nextEdge = (surge.nextEdge + 1) % 4
        const e = new ServerEnemy(surge.type as EnemyKind, pos.x, pos.y, hpMult)
        e.speedMult = SURGE_SPEED_MULT
        this.enemies.push(e)
        surge.remaining--
      }
    }
    this.stage5SurgeQueue = this.stage5SurgeQueue.filter(s => s.remaining > 0)

    this.freezeTimer = Math.max(0, this.freezeTimer - delta)
    for (const e of this.enemies) {
      if (!e.active) continue
      const ER = e.kind === 'minotaur' ? 28 : 14
      const nearest = this.nearestPlayerTo(e.x, e.y, players)
      const prevX = e.x, prevY = e.y
      e.update(nearest.x, nearest.y, delta, this.freezeTimer > 0 ? 0 : 1)
      // Maze wall collision (axis-separated — allows sliding along walls)
      if (s5IsWall(e.x + ER, prevY) || s5IsWall(e.x - ER, prevY)) e.x = prevX
      if (s5IsWall(e.x, e.y + ER) || s5IsWall(e.x, e.y - ER)) e.y = prevY
      e.x = Math.max(-S5_MAP_HALF, Math.min(S5_MAP_HALF, e.x))
      e.y = Math.max(-S5_MAP_HALF, Math.min(S5_MAP_HALF, e.y))
    }

    // Minotaur defeat + exit open detection
    if (this.minotaur && !this.minotaur.active && !this.minotaurDefeated) {
      this.minotaurDefeated = true
      this.onMinotaurDefeated?.()
    }
    if (this.minotaurDefeated && !this.exitReached) {
      for (const p of players) {
        if (Math.abs(p.x) < 90 && p.y > 2300) { this.exitReached = true; break }
      }
    }

    // Recycle enemies that escaped the map back to an entry corridor
    for (const e of this.enemies) {
      if (!e.active) continue
      const offMap = Math.abs(e.x) > S5_MAP_HALF + 100 || Math.abs(e.y) > S5_MAP_HALF + 100
      if (offMap) {
        const pos = this.stage5EdgePoint(Math.floor(Math.random() * 4))
        e.x = pos.x; e.y = pos.y
      }
    }

    const SEP_RADIUS = 40, SEP_FORCE = 1.0, SEP_MAX = 5
    const active = this.enemies.filter(e => e.active)
    const preSepX = active.map(e => e.x)
    const preSepY = active.map(e => e.y)
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j]
        const dx = a.x - b.x, dy = a.y - b.y
        const d2 = dx * dx + dy * dy
        if (d2 < SEP_RADIUS * SEP_RADIUS && d2 > 0) {
          const d = Math.sqrt(d2)
          const push = Math.min((SEP_RADIUS - d) * SEP_FORCE, SEP_MAX)
          const nx = dx / d, ny = dy / d
          a.x += nx * push; a.y += ny * push
          b.x -= nx * push; b.y -= ny * push
        }
      }
    }
    // Revert enemies pushed into walls by separation force
    for (let i = 0; i < active.length; i++) {
      const e = active[i]
      if (s5IsWall(e.x, e.y)) { e.x = preSepX[i]; e.y = preSepY[i] }
    }

    this.enemies = this.enemies.filter(e => e.active)
  }

  // Spawn just outside one of the 4 maze entry corridors.
  // Entry cells are at world x=0 (N/S) or world y=0 (W/E), width one cell (200px).
  private stage5EdgePoint(side: number): { x: number; y: number } {
    const edge   = S5_MAP_HALF + LANE_MARGIN  // just outside the 1500 boundary
    const spread = (Math.random() * 2 - 1) * 85  // ±85px within the 200px entry corridor
    switch (side) {
      case 0: return { x: -edge, y: spread }  // W entry
      case 1: return { x:  edge, y: spread }  // E entry
      case 2: return { x: spread, y: -edge }  // N entry
      default: return { x: spread, y:  edge } // S entry
    }
  }

  private stage2LaneInterval(lane: Stage2LaneDef): number {
    if (this.elapsed <= lane.startTime) return lane.intervalStart
    const t = Math.min((this.elapsed - lane.startTime) / SPAWN_SCALE_DURATION, 1)
    return lane.intervalStart + (lane.intervalEnd - lane.intervalStart) * t
  }

  private stage2LaneBurst(lane: Stage2LaneDef): number {
    if (this.elapsed <= lane.startTime) return lane.burstStart
    const t = Math.min((this.elapsed - lane.startTime) / SPAWN_SCALE_DURATION, 1)
    return Math.round(lane.burstStart + (lane.burstEnd - lane.burstStart) * t)
  }

  // Spawn at left (side=0) or right (side=1) edge of the corridor.
  // Y is relative to the nearest player so enemies always appear near the action,
  // clamped to the corridor's absolute world-space bounds.
  private corridorEdgePoint(players: SpawnerPlayer[], side: number): { x: number; y: number } {
    const p = players.length > 0
      ? players[Math.floor(Math.random() * players.length)]
      : { x: 2000, y: 2000, viewW: DEFAULT_VIEW_W, viewH: DEFAULT_VIEW_H, aura: 0, auraRange: 0, level: 1 }
    const zoom      = p.viewW <= 768 ? 0.7 : 1.2
    const halfW     = (p.viewW / 2) / zoom + LANE_MARGIN
    const corridorY = this.corridorHalfY ?? 380
    const halfCY    = corridorY * 0.85
    const rawY      = p.y + (Math.random() * 2 - 1) * halfCY
    const y         = Math.max(-corridorY, Math.min(corridorY, rawY))
    return side === 0
      ? { x: p.x - halfW, y }
      : { x: p.x + halfW, y }
  }

  freeze(ms: number) {
    this.freezeTimer = Math.max(this.freezeTimer, ms)
  }

  killAllNonBoss(): { id: number; x: number; y: number; xpValue: number }[] {
    const dead: { id: number; x: number; y: number; xpValue: number }[] = []
    for (const e of this.enemies) {
      if (!e.active || e.isBoss) continue
      e.active = false
      dead.push({ id: e.id, x: e.x, y: e.y, xpValue: e.xpValue })
    }
    this.enemies = this.enemies.filter(e => e.active)
    return dead
  }

  adminSpawnEnemy(kind: string, players: SpawnerPlayer[]): ServerEnemy | null {
    if (this.enemies.length >= MAX_ENEMIES) return null
    const hpMult = 1
    const pos = this.edgePoint(players)
    if (kind === 'finalBoss') {
      const e = new ServerEnemy('finalBoss' as EnemyKind, pos.x, pos.y, hpMult)
      this.enemies.push(e)
      return e
    }
    if (kind === 'boss' || kind === 'summoner') {
      const bossKind: EnemyKind = kind === 'summoner' ? 'summoner' : 'boss'
      const e = new ServerEnemy(bossKind, pos.x, pos.y, hpMult)
      if (bossKind === 'summoner') {
        e.onSummon = (sx, sy, count, phase2) => {
          for (let i = 0; i < count; i++) {
            const a  = (i / count) * Math.PI * 2
            const mx = sx + Math.cos(a) * (80 + Math.random() * 60)
            const my = sy + Math.sin(a) * (80 + Math.random() * 60)
            const mk: EnemyKind = phase2 && i % 2 === 0 ? 'speeder' : 'basic'
            this.enemies.push(new ServerEnemy(mk, mx, my, hpMult))
          }
        }
        e.onInvulnChange = (invuln) => this.onBossInvuln?.(e.id, invuln)
      }
      this.enemies.push(e)
      return e
    }
    const validKinds: SpawnKind[] = ['basic', 'speeder', 'tank', 'ranged', 'exploder', 'ghost', 'charger', 'necromancer', 'veteran', 'brute', 'revenant', 'warlord', 'titan']
    const safeKind: SpawnKind = validKinds.includes(kind as SpawnKind) ? (kind as SpawnKind) : 'basic'
    return this.spawnEnemy(safeKind, pos.x, pos.y, hpMult, players)
  }
}
