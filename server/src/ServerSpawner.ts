import { ServerEnemy } from './ServerEnemy.js'
import type { EnemyKind } from './protocol.js'

const RUN_DURATION     = 30 * 60 * 1000
const LANE_MARGIN      = 20    // px beyond screen edge for regular lane spawns (matches frontend)
const SPAWN_MARGIN     = 250   // px beyond screen edge for boss/surge spawns (matches frontend)
const RECYCLE_EXTRA    = 300   // additional px past spawn edge before enemy is recycled (matches frontend)
const INITIAL_FILL_COUNT = 2      // basics spawned from ONE random edge at run start
const DEFAULT_VIEW_W   = 1280  // fallback if client didn't report viewport
const DEFAULT_VIEW_H   = 720
const MAX_ENEMIES      = 600
const BOSS_FIRST_SPAWN = 300_000
const BOSS_REPEAT      = 240_000
const BOSS_WARNING     = 5_000
const FINAL_BOSS_LOCK  = RUN_DURATION - 30_000
const SURGE_SPEED_MULT = 2.5

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

// ── Lane definitions (mirrors EnemySpawner.ts LANE_DEFS) ─────────────────────
type SpawnKind = 'basic' | 'speeder' | 'tank' | 'exploder' | 'ghost' | 'ranged' | 'charger' | 'necromancer'

interface LaneDef {
  type: SpawnKind
  startTime: number
  intervalStart: number
  intervalEnd: number
  burstStart: number
  burstEnd: number
}

const LANE_DEFS: LaneDef[] = [
  { type: 'basic',       startTime: 0,        intervalStart: 1000,  intervalEnd: 250,  burstStart: 1, burstEnd: 8  },
  { type: 'speeder',     startTime: 50_000,   intervalStart: 1800,  intervalEnd: 350,  burstStart: 2, burstEnd: 4  },
  { type: 'tank',        startTime: 90_000,   intervalStart: 3000,  intervalEnd: 800,  burstStart: 1, burstEnd: 2 },
  { type: 'exploder',    startTime: 120_000,  intervalStart: 3500,  intervalEnd: 900,  burstStart: 1, burstEnd: 2 },
  { type: 'ghost',       startTime: 150_000,  intervalStart: 3000,  intervalEnd: 800,  burstStart: 1, burstEnd: 2 },
  { type: 'ranged',      startTime: 210_000,  intervalStart: 2500,  intervalEnd: 600,  burstStart: 1, burstEnd: 2 },
  { type: 'charger',     startTime: 480_000,  intervalStart: 4000,  intervalEnd: 1200, burstStart: 1, burstEnd: 2 },
  { type: 'necromancer', startTime: 780_000,  intervalStart: 6000,  intervalEnd: 2000, burstStart: 1, burstEnd: 1 },
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
  angle: number  // fixed spawn direction so the whole surge comes from one side
}

export class ServerSpawner {
  disabled = false  // set true for stages that manage their own enemies
  corridorHalfY: number | null = null  // non-null in stage 2: clamps enemy Y to ±this value
  private enemies: ServerEnemy[] = []
  private elapsed   = 0
  private laneTimers: number[] = LANE_DEFS.map(l => l.intervalStart)
  private nextBossAt        = BOSS_FIRST_SPAWN
  private bossAlive         = false
  private warningFired      = false
  private finalBossAlive    = false
  private finalWarningFired = false
  private surgesFired       = new Set<number>()
  private surgeQueue: ActiveSurge[] = []
  private initialFillDone   = false

  onBossWarning?:       (final: boolean) => void
  onBossSpawn?:         (e: ServerEnemy) => void
  onFinalBossDefeated?: () => void
  onSurge?:             (type: string) => void
  onBossInvuln?:        (bossId: number, invulnerable: boolean) => void
  onExploderExplode?:   (x: number, y: number) => void

  get all(): ServerEnemy[]  { return this.enemies }
  get runElapsed(): number   { return this.elapsed }
  get isFinished(): boolean  { return this.elapsed >= RUN_DURATION && !this.finalBossAlive }

  // Fast-forward to a mid-run point without firing any surge/boss events.
  // Called when a solo player reconnects after a page refresh.
  resumeFrom(ms: number) {
    this.elapsed = ms
    this.initialFillDone = true  // skip initial fill; server will re-populate naturally
    for (const surge of SURGE_EVENTS) {
      if (surge.triggerTime <= ms) this.surgesFired.add(surge.triggerTime)
    }
    // Advance nextBossAt past all boss cycles that would have completed
    while (this.nextBossAt <= ms) {
      this.nextBossAt += BOSS_REPEAT
    }
    // Mark warnings as already fired so they don't re-trigger on the first tick
    if (ms >= this.nextBossAt - BOSS_REPEAT - BOSS_WARNING) this.warningFired = true
    if (ms >= RUN_DURATION - BOSS_WARNING) this.finalWarningFired = true
  }

  update(players: SpawnerPlayer[], delta: number) {
    if (this.disabled) { this.elapsed += delta; return }
    this.elapsed += delta

    const speedMult   = computeSpeedScale(this.elapsed)
    const maxLevel    = players.length > 0 ? Math.max(...players.map(p => p.level)) : 1
    const hpMult      = computeHpScale(this.elapsed, maxLevel)
    const inFinal     = this.finalBossAlive || this.elapsed >= FINAL_BOSS_LOCK
    const playerScale = Math.sqrt(Math.max(1, players.length))
    const enemyCap    = Math.round(MAX_ENEMIES * playerScale)

    // ── Initial fill — a small cluster from ONE random edge (no rectangle) ──────
    if (!this.initialFillDone && players.length > 0) {
      this.initialFillDone = true
      const edge   = Math.floor(Math.random() * 4)
      const center = (Math.random() * 2 - 1) * 0.5
      for (let i = 0; i < INITIAL_FILL_COUNT; i++) {
        const pos = this.laneEdgePoint(players, edge, center)
        this.enemies.push(new ServerEnemy('basic', pos.x, pos.y, hpMult))
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
        // VS: whole burst comes from ONE edge, clustered near a random point
        const burstEdge   = Math.floor(Math.random() * 4)
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
          angle: Math.random() * Math.PI * 2,
        })
      }
    }
    for (const surge of this.surgeQueue) {
      surge.timer -= delta
      if (surge.timer <= 0 && surge.remaining > 0 && this.enemies.length < enemyCap + 200) {
        surge.timer += surge.spawnInterval
        const pos = this.surgeEdgePoint(players, surge.angle)
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
    for (const e of this.enemies) {
      if (!e.active) continue
      const nearest = this.nearestPlayerTo(e.x, e.y, players)
      e.update(nearest.x, nearest.y, delta, speedMult)
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
          const zoom = p.viewW <= 768 ? 0.7 : 1.4
          const rHalfW = (p.viewW / 2) / zoom + SPAWN_MARGIN + RECYCLE_EXTRA
          const rHalfH = (p.viewH / 2) / zoom + SPAWN_MARGIN + RECYCLE_EXTRA
          const dx = Math.abs(e.x - p.x), dy = Math.abs(e.y - p.y)
          const d2 = Math.max(dx / rHalfW, dy / rHalfH)  // 1.0 = exactly at recycle boundary
          if (d2 < minDist2) minDist2 = d2
        }
        if (minDist2 > 1) {
          const pos = this.laneEdgePoint(players)
          e.x = pos.x
          e.y = pos.y
        }
      }
    }

    // ── Separation: push overlapping enemies apart ────────────────────────────
    const SEP_RADIUS = 32
    const SEP_FORCE  = 0.9
    const active = this.enemies.filter(e => e.active && !e.isBoss)
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = dx * dx + dy * dy
        if (d2 < SEP_RADIUS * SEP_RADIUS && d2 > 0) {
          const d  = Math.sqrt(d2)
          const push = (SEP_RADIUS - d) * SEP_FORCE
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
    const t = Math.min((this.elapsed - lane.startTime) / (RUN_DURATION - lane.startTime), 1)
    return lane.intervalStart + (lane.intervalEnd - lane.intervalStart) * t
  }

  private laneBurst(lane: LaneDef): number {
    if (this.elapsed <= lane.startTime) return lane.burstStart
    const t = Math.min((this.elapsed - lane.startTime) / (RUN_DURATION - lane.startTime), 1)
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
    if (this.elapsed < 5 * 60_000) {
      // Early-game: Summoner boss that periodically calls in minions
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
    if (players.length === 0) return { x: 2000, y: 2000, viewW: DEFAULT_VIEW_W, viewH: DEFAULT_VIEW_H }
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
    const zoom = p.viewW <= 768 ? 0.7 : 1.4
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
    const zoom = p.viewW <= 768 ? 0.7 : 1.4
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

  // Surge: all enemies from the edge corresponding to the fixed angle — matches frontend surgeEdgePoint.
  private surgeEdgePoint(players: SpawnerPlayer[], angle: number): { x: number; y: number } {
    const p    = players.length > 0 ? players[Math.floor(Math.random() * players.length)] : { x: 2000, y: 2000, viewW: DEFAULT_VIEW_W, viewH: DEFAULT_VIEW_H }
    const zoom = p.viewW <= 768 ? 0.7 : 1.4
    const halfW = (p.viewW / 2) / zoom + SPAWN_MARGIN
    const halfH = (p.viewH / 2) / zoom + SPAWN_MARGIN
    const along = (Math.random() * 2 - 1)
    // Pick left/right edge if the angle is more horizontal, top/bottom if more vertical
    if (Math.abs(Math.cos(angle)) >= Math.abs(Math.sin(angle))) {
      const side = Math.cos(angle) >= 0 ? 1 : -1
      return { x: p.x + side * halfW, y: p.y + along * halfH }
    } else {
      const side = Math.sin(angle) >= 0 ? 1 : -1
      return { x: p.x + along * halfW, y: p.y + side * halfH }
    }
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
    const validKinds: SpawnKind[] = ['basic', 'speeder', 'tank', 'ranged', 'exploder', 'ghost', 'charger', 'necromancer']
    const safeKind: SpawnKind = validKinds.includes(kind as SpawnKind) ? (kind as SpawnKind) : 'basic'
    return this.spawnEnemy(safeKind, pos.x, pos.y, hpMult, players)
  }
}
