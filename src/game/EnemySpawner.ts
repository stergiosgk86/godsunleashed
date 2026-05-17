import Phaser from 'phaser'
import { Enemy } from './Enemy'
import type { AnyEnemy, EnemyType } from './Enemy'
import { RangedEnemy } from './RangedEnemy'
import { ExploderEnemy } from './ExploderEnemy'
import { BossEnemy } from './BossEnemy'
import { FinalBossEnemy } from './FinalBossEnemy'
import { SummonerBoss } from './SummonerBoss'

export type SavedEnemyType = EnemyType | 'ranged' | 'exploder'
export interface EnemySave { type: SavedEnemyType; x: number; y: number; hp: number }
import { RUN_DURATION } from './runData'
import { difficultyScale, computeSpeedScale, computeHpScale, computeXpScale } from './difficultyScale'

const SPAWN_INTERVAL_START = 700
const SPAWN_INTERVAL_END   = 200
const SPAWN_RADIUS = 600
const MAX_ENEMIES = 300
const BOSS_FIRST_SPAWN = 90_000
const BOSS_REPEAT = 120_000
const BOSS_WARNING = 5_000
const FINAL_BOSS_LOCK = RUN_DURATION - 30_000  // stop regular boss cycle 30s before end

type SpawnType = EnemyType | 'ranged' | 'exploder'

export class EnemySpawner {
  private scene: Phaser.Scene
  private enemies: AnyEnemy[] = []
  private spawnTimer = 0
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
    }
  }

  restore(snap: { elapsed: number; nextBossAt: number; warningFired: boolean; finalBossWarningFired: boolean }) {
    this.elapsed = snap.elapsed
    this.nextBossAt = snap.nextBossAt
    this.warningFired = snap.warningFired
    this.finalBossWarningFired = snap.finalBossWarningFired
    difficultyScale.speed = computeSpeedScale(this.elapsed)
    difficultyScale.hp    = computeHpScale(this.elapsed)
    difficultyScale.xp    = computeXpScale(this.elapsed)
  }

  getSaveableEnemies(): EnemySave[] {
    const result: EnemySave[] = []
    for (const e of this.enemies) {
      if (!e.active) continue
      if (e instanceof BossEnemy || e instanceof FinalBossEnemy || e instanceof SummonerBoss) continue
      if (e instanceof RangedEnemy) {
        result.push({ type: 'ranged', x: e.x, y: e.y, hp: e.hp })
      } else if (e instanceof ExploderEnemy) {
        result.push({ type: 'exploder', x: e.x, y: e.y, hp: e.hp })
      } else if (e instanceof Enemy) {
        result.push({ type: e.type, x: e.x, y: e.y, hp: e.hp })
      }
    }
    return result
  }

  restoreEnemies(saves: EnemySave[]) {
    for (const save of saves) {
      let e: AnyEnemy
      if (save.type === 'ranged') {
        e = new RangedEnemy(this.scene, save.x, save.y)
      } else if (save.type === 'exploder') {
        e = new ExploderEnemy(this.scene, save.x, save.y)
      } else {
        e = new Enemy(this.scene, save.x, save.y, save.type)
      }
      e.hp = save.hp
      this.enemies.push(e)
    }
  }

  update(playerX: number, playerY: number, delta: number) {
    this.elapsed += delta
    this.spawnTimer += delta
    difficultyScale.speed = computeSpeedScale(this.elapsed)
    difficultyScale.hp    = computeHpScale(this.elapsed)
    difficultyScale.xp    = computeXpScale(this.elapsed)

    const inFinalPhase = this.finalBossAlive || this.elapsed >= FINAL_BOSS_LOCK

    // Regular enemy spawning (paused during any boss fight or final phase lock)
    const spawnInterval = SPAWN_INTERVAL_START - (SPAWN_INTERVAL_START - SPAWN_INTERVAL_END) * Math.min(this.elapsed / RUN_DURATION, 1)
    if (!this.bossAlive && !inFinalPhase && this.spawnTimer >= spawnInterval && this.enemies.length < MAX_ENEMIES) {
      this.spawnTimer = 0
      this.spawnEnemy(playerX, playerY)
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
      const angle = Math.random() * Math.PI * 2
      const x = playerX + Math.cos(angle) * SPAWN_RADIUS
      const y = playerY + Math.sin(angle) * SPAWN_RADIUS
      this.enemies.push(new FinalBossEnemy(this.scene, x, y))
      this.onFinalBossSpawn?.()
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

  private spawnEnemy(playerX: number, playerY: number) {
    const angle = Math.random() * Math.PI * 2
    const x = playerX + Math.cos(angle) * SPAWN_RADIUS
    const y = playerY + Math.sin(angle) * SPAWN_RADIUS
    const type = this.pickType()
    if (type === 'ranged') {
      this.enemies.push(new RangedEnemy(this.scene, x, y))
    } else if (type === 'exploder') {
      this.enemies.push(new ExploderEnemy(this.scene, x, y))
    } else {
      this.enemies.push(new Enemy(this.scene, x, y, type))
    }
  }

  private spawnBoss(playerX: number, playerY: number) {
    this.bossAlive = true
    const angle = Math.random() * Math.PI * 2
    const x = playerX + Math.cos(angle) * SPAWN_RADIUS
    const y = playerY + Math.sin(angle) * SPAWN_RADIUS
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

  private pickType(): SpawnType {
    const pool: SpawnType[] = ['basic', 'basic', 'basic']
    if (this.elapsed > 20_000) pool.push('speeder', 'speeder')
    if (this.elapsed > 45_000) pool.push('tank')
    if (this.elapsed > 60_000) pool.push('exploder')
    if (this.elapsed > 70_000) pool.push('ranged', 'ranged', 'exploder')
    return pool[Math.floor(Math.random() * pool.length)]
  }

  waveLabel(overrideElapsed?: number): string {
    if (this.finalBossAlive) return '☠ THE DEATH'
    if (this.bossAlive) return this.enemies.some(e => e instanceof SummonerBoss && e.active) ? '⚠ SUMMONER' : '⚠ BOSS FIGHT'
    const t = overrideElapsed ?? this.elapsed
    if (t < 20_000) return 'Wave 1 — Basic'
    if (t < 45_000) return 'Wave 2 — + Speeders'
    if (t < 60_000) return 'Wave 3 — + Tanks'
    if (t < 70_000) return 'Wave 4 — + Exploders'
    return 'Wave 5 — + Ranged'
  }
}
