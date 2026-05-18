import Phaser from 'phaser'
import { Enemy } from './Enemy'
import type { AnyEnemy, EnemyType } from './Enemy'
import { RangedEnemy } from './RangedEnemy'
import { ExploderEnemy } from './ExploderEnemy'
import { GhostEnemy } from './GhostEnemy'
import { ChargerEnemy } from './ChargerEnemy'
import { NecromancerEnemy } from './NecromancerEnemy'
import { BossEnemy } from './BossEnemy'
import { FinalBossEnemy } from './FinalBossEnemy'
import { SummonerBoss } from './SummonerBoss'

export type SavedEnemyType = EnemyType | 'ranged' | 'exploder' | 'ghost' | 'charger' | 'necromancer' | 'boss' | 'summoner' | 'finalBoss'
export interface EnemySave { type: SavedEnemyType; x: number; y: number; hp: number }
import { RUN_DURATION } from './runData'
import { difficultyScale, computeSpeedScale, computeHpScale, computeDamageScale, computeXpScale } from './difficultyScale'

const SPAWN_MARGIN = 80    // world-px beyond the visible screen edge
const RECYCLE_EXTRA = 300  // additional world-px past the spawn edge before an enemy is recycled
const MAX_ENEMIES = 600
const BOSS_FIRST_SPAWN = 90_000
const BOSS_REPEAT = 120_000
const BOSS_WARNING = 5_000
const FINAL_BOSS_LOCK = RUN_DURATION - 30_000  // stop regular boss cycle 30s before end

type SpawnType = EnemyType | 'ranged' | 'exploder' | 'ghost' | 'charger' | 'necromancer'

interface LaneDef {
  type: SpawnType
  startTime: number      // ms when this lane becomes active
  intervalStart: number  // ms between bursts at startTime
  intervalEnd: number    // ms between bursts at RUN_DURATION
  burstStart: number     // enemies per burst at startTime
  burstEnd: number       // enemies per burst at RUN_DURATION
}

const LANE_DEFS: LaneDef[] = [
  { type: 'basic',       startTime: 0,        intervalStart: 1200,  intervalEnd: 250,  burstStart: 1, burstEnd: 3 },
  { type: 'speeder',     startTime: 20_000,   intervalStart: 1800,  intervalEnd: 350,  burstStart: 1, burstEnd: 3 },
  { type: 'tank',        startTime: 45_000,   intervalStart: 3000,  intervalEnd: 800,  burstStart: 1, burstEnd: 2 },
  { type: 'exploder',    startTime: 60_000,   intervalStart: 3500,  intervalEnd: 900,  burstStart: 1, burstEnd: 2 },
  { type: 'ranged',      startTime: 70_000,   intervalStart: 2500,  intervalEnd: 600,  burstStart: 1, burstEnd: 2 },
  { type: 'ghost',       startTime: 120_000,  intervalStart: 3000,  intervalEnd: 800,  burstStart: 1, burstEnd: 2 },
  { type: 'charger',     startTime: 300_000,  intervalStart: 4000,  intervalEnd: 1200, burstStart: 1, burstEnd: 2 },
  { type: 'necromancer', startTime: 480_000,  intervalStart: 6000,  intervalEnd: 2000, burstStart: 1, burstEnd: 1 },
]

export class EnemySpawner {
  private scene: Phaser.Scene
  private enemies: AnyEnemy[] = []
  private laneTimers: number[] = LANE_DEFS.map(l => l.intervalStart)
  private elapsed = 0
  private nextBossAt = BOSS_FIRST_SPAWN
  private bossAlive = false
  private warningFired = false
  private finalBossAlive = false
  private finalBossWarningFired = false

  onBossWarning?: () => void
  onBossSpawn?: () => void
  onFinalBossWarning?: () => void
  onFinalBossSpawn?: () => void
  onFinalBossDefeated?: () => void

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  get all(): AnyEnemy[] {
    return this.enemies
  }

  getSnapshot() {
    return {
      elapsed: this.elapsed,
      nextBossAt: this.nextBossAt,
      warningFired: this.warningFired,
      finalBossWarningFired: this.finalBossWarningFired,
      bossAlive: this.bossAlive,
      finalBossAlive: this.finalBossAlive,
    }
  }

  restore(snap: { elapsed: number; nextBossAt: number; warningFired: boolean; finalBossWarningFired: boolean; bossAlive?: boolean; finalBossAlive?: boolean }) {
    this.elapsed = snap.elapsed
    this.nextBossAt = snap.nextBossAt
    this.warningFired = snap.warningFired
    this.finalBossWarningFired = snap.finalBossWarningFired
    this.bossAlive = snap.bossAlive ?? false
    this.finalBossAlive = snap.finalBossAlive ?? false
    difficultyScale.speed  = computeSpeedScale(this.elapsed)
    difficultyScale.hp     = computeHpScale(this.elapsed)
    difficultyScale.damage = computeDamageScale(this.elapsed)
    difficultyScale.xp     = computeXpScale(this.elapsed)
    this.laneTimers = LANE_DEFS.map(l => this.laneInterval(l))
  }

  getSaveableEnemies(): EnemySave[] {
    const result: EnemySave[] = []
    for (const e of this.enemies) {
      if (!e.active) continue
      if (e instanceof FinalBossEnemy) {
        result.push({ type: 'finalBoss', x: e.x, y: e.y, hp: e.hp })
      } else if (e instanceof SummonerBoss) {
        result.push({ type: 'summoner', x: e.x, y: e.y, hp: e.hp })
      } else if (e instanceof BossEnemy) {
        result.push({ type: 'boss', x: e.x, y: e.y, hp: e.hp })
      } else if (e instanceof RangedEnemy) {
        result.push({ type: 'ranged', x: e.x, y: e.y, hp: e.hp })
      } else if (e instanceof ExploderEnemy) {
        result.push({ type: 'exploder', x: e.x, y: e.y, hp: e.hp })
      } else if (e instanceof GhostEnemy) {
        result.push({ type: 'ghost', x: e.x, y: e.y, hp: e.hp })
      } else if (e instanceof ChargerEnemy) {
        result.push({ type: 'charger', x: e.x, y: e.y, hp: e.hp })
      } else if (e instanceof NecromancerEnemy) {
        result.push({ type: 'necromancer', x: e.x, y: e.y, hp: e.hp })
      } else if (e instanceof Enemy) {
        result.push({ type: e.type, x: e.x, y: e.y, hp: e.hp })
      }
    }
    return result
  }

  restoreEnemies(saves: EnemySave[]) {
    for (const save of saves) {
      let e: AnyEnemy
      if (save.type === 'boss') {
        const b = new BossEnemy(this.scene, save.x, save.y)
        b.hp = save.hp
        this.enemies.push(b)
      } else if (save.type === 'summoner') {
        const s = new SummonerBoss(this.scene, save.x, save.y)
        s.hp = save.hp
        s.onSummon = (bx, by, count, phase2) => {
          for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2
            const mx = bx + Math.cos(a) * (80 + Math.random() * 60)
            const my = by + Math.sin(a) * (80 + Math.random() * 60)
            this.enemies.push(phase2 && i % 2 === 0
              ? new Enemy(this.scene, mx, my, 'speeder')
              : new Enemy(this.scene, mx, my, 'basic'))
          }
        }
        this.enemies.push(s)
      } else if (save.type === 'finalBoss') {
        const fb = new FinalBossEnemy(this.scene, save.x, save.y)
        fb.hp = save.hp
        this.enemies.push(fb)
      } else if (save.type === 'ranged') {
        e = new RangedEnemy(this.scene, save.x, save.y)
        e.hp = save.hp
        this.enemies.push(e)
      } else if (save.type === 'exploder') {
        e = new ExploderEnemy(this.scene, save.x, save.y)
        e.hp = save.hp
        this.enemies.push(e)
      } else if (save.type === 'ghost') {
        // Restore ghost heading toward screen centre — direction is approximate after refresh
        e = new GhostEnemy(this.scene, save.x, save.y, save.x, save.y - 400)
        e.hp = save.hp
        this.enemies.push(e)
      } else if (save.type === 'charger') {
        e = new ChargerEnemy(this.scene, save.x, save.y)
        e.hp = save.hp
        this.enemies.push(e)
      } else if (save.type === 'necromancer') {
        e = new NecromancerEnemy(this.scene, save.x, save.y)
        e.hp = save.hp
        this.enemies.push(e)
      } else {
        e = new Enemy(this.scene, save.x, save.y, save.type)
        e.hp = save.hp
        this.enemies.push(e)
      }
    }
    // Infer boss flags from the actual restored entities — avoids stale flag
    // if the boss died between the last save and the page refresh.
    this.bossAlive = this.enemies.some(e => (e instanceof BossEnemy || e instanceof SummonerBoss) && e.active)
    this.finalBossAlive = this.enemies.some(e => e instanceof FinalBossEnemy && e.active)
  }

  update(playerX: number, playerY: number, delta: number) {
    this.elapsed += delta
    difficultyScale.speed  = computeSpeedScale(this.elapsed)
    difficultyScale.hp     = computeHpScale(this.elapsed)
    difficultyScale.damage = computeDamageScale(this.elapsed)
    difficultyScale.xp     = computeXpScale(this.elapsed)

    const inFinalPhase = this.finalBossAlive || this.elapsed >= FINAL_BOSS_LOCK

    // Independent per-lane spawning — runs continuously, including during boss fights
    for (let i = 0; i < LANE_DEFS.length; i++) {
      const lane = LANE_DEFS[i]
      if (this.elapsed < lane.startTime) continue
      this.laneTimers[i] -= delta
      if (this.laneTimers[i] <= 0 && this.enemies.length < MAX_ENEMIES) {
        this.laneTimers[i] = this.laneInterval(lane)
        const count = Math.min(this.laneBurst(lane), MAX_ENEMIES - this.enemies.length)
        for (const { x, y } of this.burstEdgePoints(playerX, playerY, count)) {
          this.spawnEnemy(x, y, playerX, playerY, lane.type)
        }
      }
    }

    // Regular boss cycle (stops once we enter final phase lock)
    if (!inFinalPhase) {
      if (!this.bossAlive && !this.warningFired && this.elapsed >= this.nextBossAt - BOSS_WARNING) {
        this.warningFired = true
        this.onBossWarning?.()
      }
      if (!this.bossAlive && this.elapsed >= this.nextBossAt) {
        this.spawnBoss(playerX, playerY)
      }
    }

    // Final boss warning
    if (!this.finalBossWarningFired && this.elapsed >= RUN_DURATION - BOSS_WARNING) {
      this.finalBossWarningFired = true
      this.onFinalBossWarning?.()
    }

    // Final boss spawn
    if (!this.finalBossAlive && !this.finalBossWarningFired === false && this.elapsed >= RUN_DURATION) {
      this.finalBossAlive = true
      const { x, y } = this.edgeSpawnPoint(playerX, playerY)
      this.enemies.push(new FinalBossEnemy(this.scene, x, y))
      this.onFinalBossSpawn?.()
    }

    // Recycle enemies that have wandered well off-screen — frees cap for fresh spawns
    {
      const cam = this.scene.cameras.main
      const rHalfW = (cam.width  / 2) / cam.zoom + SPAWN_MARGIN + RECYCLE_EXTRA
      const rHalfH = (cam.height / 2) / cam.zoom + SPAWN_MARGIN + RECYCLE_EXTRA
      for (const e of this.enemies) {
        if (!e.active || e.isBoss) continue
        if (Math.abs(e.x - playerX) > rHalfW || Math.abs(e.y - playerY) > rHalfH) e.destroy()
      }
    }

    // Separation: push overlapping enemies apart so they don't stack into one sprite.
    const SEP_RADIUS = 22
    const SEP_FORCE  = 0.6
    const active = this.enemies.filter(e => e.active && !e.isBoss)
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dist2 = dx * dx + dy * dy
        if (dist2 < SEP_RADIUS * SEP_RADIUS && dist2 > 0) {
          const dist = Math.sqrt(dist2)
          const push = (SEP_RADIUS - dist) * SEP_FORCE
          const nx = dx / dist, ny = dy / dist
          a.x += nx * push; a.y += ny * push
          b.x -= nx * push; b.y -= ny * push
        }
      }
    }

    for (const e of this.enemies) {
      if (e.active) e.update(playerX, playerY, delta)
    }

    // Detect regular boss death
    if (this.bossAlive && !this.enemies.some(e => (e instanceof BossEnemy || e instanceof SummonerBoss) && e.active)) {
      this.bossAlive = false
      this.warningFired = false
      this.nextBossAt = this.elapsed + BOSS_REPEAT
    }

    // Detect final boss death
    if (this.finalBossAlive && !this.enemies.some(e => e instanceof FinalBossEnemy && e.active)) {
      this.finalBossAlive = false
      this.onFinalBossDefeated?.()
    }

    this.enemies = this.enemies.filter(e => e.active)
  }

  private edgeSpawnPoint(playerX: number, playerY: number): { x: number; y: number } {
    const cam = this.scene.cameras.main
    const halfW = (cam.width / 2) / cam.zoom + SPAWN_MARGIN
    const halfH = (cam.height / 2) / cam.zoom + SPAWN_MARGIN
    const edge = Math.floor(Math.random() * 4)
    let x: number, y: number
    switch (edge) {
      case 0: x = playerX + (Math.random() * 2 - 1) * halfW; y = playerY - halfH; break
      case 1: x = playerX + (Math.random() * 2 - 1) * halfW; y = playerY + halfH; break
      case 2: x = playerX - halfW; y = playerY + (Math.random() * 2 - 1) * halfH; break
      default: x = playerX + halfW; y = playerY + (Math.random() * 2 - 1) * halfH; break
    }
    return { x, y }
  }

  private burstEdgePoints(playerX: number, playerY: number, count: number): { x: number; y: number }[] {
    const cam = this.scene.cameras.main
    const halfW = (cam.width / 2) / cam.zoom + SPAWN_MARGIN
    const halfH = (cam.height / 2) / cam.zoom + SPAWN_MARGIN
    const SPACING = 32
    const edge = Math.floor(Math.random() * 4)
    const anchor = Math.random() * 2 - 1  // -1..1 position along the chosen edge
    return Array.from({ length: count }, (_, i) => {
      const off = (i - (count - 1) / 2) * SPACING
      switch (edge) {
        case 0: return { x: playerX + anchor * halfW + off, y: playerY - halfH }
        case 1: return { x: playerX + anchor * halfW + off, y: playerY + halfH }
        case 2: return { x: playerX - halfW, y: playerY + anchor * halfH + off }
        default: return { x: playerX + halfW, y: playerY + anchor * halfH + off }
      }
    })
  }

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

  private spawnEnemy(x: number, y: number, playerX: number, playerY: number, type: SpawnType) {
    if (type === 'ranged') {
      this.enemies.push(new RangedEnemy(this.scene, x, y))
    } else if (type === 'exploder') {
      this.enemies.push(new ExploderEnemy(this.scene, x, y))
    } else if (type === 'ghost') {
      this.enemies.push(new GhostEnemy(this.scene, x, y, playerX, playerY))
    } else if (type === 'charger') {
      this.enemies.push(new ChargerEnemy(this.scene, x, y))
    } else if (type === 'necromancer') {
      this.enemies.push(new NecromancerEnemy(this.scene, x, y))
    } else {
      this.enemies.push(new Enemy(this.scene, x, y, type))
    }
  }

  private spawnBoss(playerX: number, playerY: number) {
    this.bossAlive = true
    const { x, y } = this.edgeSpawnPoint(playerX, playerY)
    if (this.elapsed >= 5 * 60_000) {
      const boss = new SummonerBoss(this.scene, x, y)
      boss.onSummon = (bx, by, count, phase2) => {
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2
          const mx = bx + Math.cos(a) * (80 + Math.random() * 60)
          const my = by + Math.sin(a) * (80 + Math.random() * 60)
          this.enemies.push(phase2 && i % 2 === 0
            ? new Enemy(this.scene, mx, my, 'speeder')
            : new Enemy(this.scene, mx, my, 'basic'))
        }
      }
      this.enemies.push(boss)
    } else {
      this.enemies.push(new BossEnemy(this.scene, x, y))
    }
    this.onBossSpawn?.()
  }

  waveLabel(overrideElapsed?: number): string {
    if (this.finalBossAlive) return '☠ THE DEATH'
    if (this.bossAlive) return this.enemies.some(e => e instanceof SummonerBoss && e.active) ? '⚠ SUMMONER' : '⚠ BOSS FIGHT'
    const t = overrideElapsed ?? this.elapsed
    if (t < 20_000)  return 'Wave 1 — Basic'
    if (t < 45_000)  return 'Wave 2 — + Speeders'
    if (t < 60_000)  return 'Wave 3 — + Tanks'
    if (t < 70_000)  return 'Wave 4 — + Exploders'
    if (t < 120_000) return 'Wave 5 — + Ranged'
    if (t < 300_000) return 'Wave 6 — + Ghosts'
    if (t < 480_000) return 'Wave 7 — + Chargers'
    return 'Wave 8 — + Necromancers'
  }
}
