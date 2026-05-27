import type { EnemyKind, EnemySnapshot } from './protocol.js'

// ── Ghost ────────────────────────────────────────────────────────────────────
const GHOST_DESPAWN_DIST = 1400

// ── Charger ──────────────────────────────────────────────────────────────────
const CHARGER_WALK_SPEED   = 55
const CHARGER_CHARGE_SPEED = 550
const CHARGER_TELEGRAPH_MS = 900
const CHARGER_CHARGE_MS    = 650
const CHARGER_COOLDOWN_MS  = 2000
const CHARGER_WALK_MS      = 2500

// ── Ranged ────────────────────────────────────────────────────────────────────
const RANGED_FIRE_INTERVAL = 2500
const RANGED_PROJ_SPEED    = 200

// ── Necromancer ───────────────────────────────────────────────────────────────
const NECRO_PREFERRED_DIST = 200
const NECRO_FIRE_INTERVAL  = 3500
const NECRO_PROJ_COUNT     = 8
const NECRO_PROJ_SPEED     = 160

// ── Summoner ──────────────────────────────────────────────────────────────────
const SUMMONER_INVULN_INTERVAL = 10_000
const SUMMONER_INVULN_DURATION =  5_000
const SUMMONER_SUMMON_P1       =  8_000
const SUMMONER_SUMMON_P2       =  4_500
const SUMMONER_COUNT_P1        = 12
const SUMMONER_COUNT_P2        = 18

interface Cfg { speed: number; maxHp: number; xpValue: number; isBoss: boolean }

const CONFIGS: Record<EnemyKind, Cfg> = {
  basic:       { speed: 75,   maxHp: 1,    xpValue: 2,   isBoss: false },
  speeder:     { speed: 95,   maxHp: 15,   xpValue: 3,   isBoss: false },
  tank:        { speed: 65,   maxHp: 40,   xpValue: 8,   isBoss: false },
  ranged:      { speed: 65,   maxHp: 25,   xpValue: 5,   isBoss: false },
  exploder:    { speed: 78,   maxHp: 20,   xpValue: 5,   isBoss: false },
  ghost:       { speed: 180,  maxHp: 8,    xpValue: 3,   isBoss: false },
  charger:     { speed: 72,   maxHp: 50,   xpValue: 7,   isBoss: false },
  necromancer: { speed: 55,   maxHp: 65,   xpValue: 7,   isBoss: false },
  summoner:    { speed: 45,   maxHp: 2500, xpValue: 150, isBoss: true  },
  boss:        { speed: 55,   maxHp: 2500, xpValue: 80,  isBoss: true  },
  finalBoss:   { speed: 72,   maxHp: 5000, xpValue: 500, isBoss: true  },
}

let _nextId = 1

export class ServerEnemy {
  readonly id: number
  readonly kind: EnemyKind
  x: number
  y: number
  hp: number
  readonly maxHp: number
  readonly speed: number
  readonly xpValue: number
  readonly isBoss: boolean
  active = true
  speedMult = 1  // per-enemy multiplier; set to SURGE_SPEED_MULT for surge enemies

  pendingProjectiles: Array<{ x: number; y: number; vx: number; vy: number }> = []

  // ── Boss / finalBoss state ────────────────────────────────────────────────
  private bossState: 'chase' | 'windup' | 'charging' = 'chase'
  private bossTimer  = 0
  private bossChargeVx = 0
  private bossChargeVy = 0
  private bossChargeTimer: number
  private shootTimer  = 1500
  private ringTimer   = 9000 * 0.6

  // ── Exploder state ────────────────────────────────────────────────────────
  private exploderArmed = false
  private exploderTimer = 0

  // ── Ghost state ───────────────────────────────────────────────────────────
  private ghostVx = 0
  private ghostVy = 0

  // ── Charger state ─────────────────────────────────────────────────────────
  private chargerState: 'walk' | 'telegraph' | 'charge' | 'cooldown' = 'walk'
  private chargerTimer = 0
  private chargerVx    = 0
  private chargerVy    = 0

  // ── Ranged state ──────────────────────────────────────────────────────────
  private rangedFireTimer = 800  // first shot quick, matches frontend fireTimer=800

  // ── Necromancer state ─────────────────────────────────────────────────────
  private necroFireTimer = 1200  // first burst is quick

  // ── Summoner state ────────────────────────────────────────────────────────
  private summonerInvulnCountdown = SUMMONER_INVULN_INTERVAL
  private summonerInvulnRemaining = 0
  private summonerIsInvulnerable  = false
  private summonerSummonTimer: number
  onSummon?: (x: number, y: number, count: number, phase2: boolean) => void
  onInvulnChange?: (invulnerable: boolean) => void
  onExplode?: (x: number, y: number) => void

  private readonly RANGED_DIST = 280

  constructor(kind: EnemyKind, x: number, y: number, hpMult = 1) {
    this.id   = _nextId++
    this.kind = kind
    this.x    = x
    this.y    = y
    const cfg = CONFIGS[kind]
    this.hp      = Math.round(cfg.maxHp * hpMult)
    this.maxHp   = this.hp
    this.speed   = cfg.speed
    this.xpValue = cfg.xpValue
    this.isBoss  = cfg.isBoss
    // Initial shoot/charge timers match frontend BossEnemy and FinalBossEnemy
    if (kind === 'finalBoss') {
      this.shootTimer      = 2000   // matches FinalBossEnemy shootTimer=2000
      this.bossChargeTimer = 4500   // matches FinalBossEnemy CHARGE_INTERVAL=4500
    } else if (kind === 'boss') {
      this.shootTimer      = 1500   // matches BossEnemy shootTimer=1500
      this.bossChargeTimer = 6000   // matches BossEnemy CHARGE_INTERVAL=6000
    }
    // Summoner first summon is earlier (half interval)
    this.summonerSummonTimer = SUMMONER_SUMMON_P1 * 0.5
  }

  // Call after constructing a ghost to lock in its heading toward the nearest player.
  initGhost(targetX: number, targetY: number) {
    const dx = targetX - this.x
    const dy = targetY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    this.ghostVx = (dx / dist) * this.speed
    this.ghostVy = (dy / dist) * this.speed
  }

  takeDamage(amount: number): boolean {
    if (this.kind === 'summoner' && this.summonerIsInvulnerable) return false
    this.hp = Math.max(0, this.hp - amount)
    if (this.hp <= 0) { this.active = false; return true }
    return false
  }

  update(nearestX: number, nearestY: number, delta: number, globalSpeedMult = 1) {
    if (!this.active) return
    const dt   = delta / 1000
    const eff  = globalSpeedMult * this.speedMult
    const dx   = nearestX - this.x
    const dy   = nearestY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1

    switch (this.kind) {
      case 'basic':
      case 'speeder':
      case 'tank':
        this.x += (dx / dist) * this.speed * eff * dt
        this.y += (dy / dist) * this.speed * eff * dt
        break

      case 'ranged':
        if (dist > this.RANGED_DIST + 30) {
          this.x += (dx / dist) * this.speed * eff * dt
          this.y += (dy / dist) * this.speed * eff * dt
        } else if (dist < this.RANGED_DIST - 30) {
          this.x -= (dx / dist) * this.speed * eff * dt
          this.y -= (dy / dist) * this.speed * eff * dt
        }
        this.rangedFireTimer -= delta
        if (this.rangedFireTimer <= 0) {
          this.rangedFireTimer = RANGED_FIRE_INTERVAL
          const angle = Math.atan2(dy, dx)
          this.pendingProjectiles.push({
            x: this.x, y: this.y,
            vx: Math.cos(angle) * RANGED_PROJ_SPEED,
            vy: Math.sin(angle) * RANGED_PROJ_SPEED,
          })
        }
        break

      case 'exploder':
        if (!this.exploderArmed) {
          this.x += (dx / dist) * this.speed * eff * dt
          this.y += (dy / dist) * this.speed * eff * dt
          if (dist < 110) { this.exploderArmed = true; this.exploderTimer = 1200 }
        } else {
          this.exploderTimer -= delta
          if (this.exploderTimer <= 0) {
            this.onExplode?.(this.x, this.y)
            this.active = false
          }
        }
        break

      case 'ghost':
        this.x += this.ghostVx * eff * dt
        this.y += this.ghostVy * eff * dt
        if (dist > GHOST_DESPAWN_DIST) this.active = false
        break

      case 'charger':
        this.updateCharger(dx, dy, dist, dt, delta, eff)
        break

      case 'necromancer':
        this.updateNecromancer(dx, dy, dist, dt, delta, eff)
        break

      case 'summoner':
        this.updateSummoner(dx, dy, dist, dt, delta)
        break

      case 'boss':
      case 'finalBoss':
        this.updateBoss(dx, dy, dist, dt, delta)
        break
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private updateCharger(dx: number, dy: number, dist: number, dt: number, delta: number, eff: number) {
    switch (this.chargerState) {
      case 'walk':
        this.x += (dx / dist) * CHARGER_WALK_SPEED * eff * dt
        this.y += (dy / dist) * CHARGER_WALK_SPEED * eff * dt
        this.chargerTimer += delta
        if (this.chargerTimer >= CHARGER_WALK_MS) {
          this.chargerTimer = 0
          this.chargerState = 'telegraph'
          this.chargerVx = (dx / dist) * CHARGER_CHARGE_SPEED
          this.chargerVy = (dy / dist) * CHARGER_CHARGE_SPEED
        }
        break
      case 'telegraph':
        // Keep updating aim during telegraph so the charge feels targeted
        this.chargerVx = (dx / dist) * CHARGER_CHARGE_SPEED
        this.chargerVy = (dy / dist) * CHARGER_CHARGE_SPEED
        this.chargerTimer += delta
        if (this.chargerTimer >= CHARGER_TELEGRAPH_MS) {
          this.chargerTimer = 0
          this.chargerState = 'charge'
        }
        break
      case 'charge':
        this.x += this.chargerVx * eff * dt
        this.y += this.chargerVy * eff * dt
        this.chargerTimer += delta
        if (this.chargerTimer >= CHARGER_CHARGE_MS) {
          this.chargerTimer = 0
          this.chargerState = 'cooldown'
        }
        break
      case 'cooldown':
        this.x += (dx / dist) * CHARGER_WALK_SPEED * 0.4 * eff * dt
        this.y += (dy / dist) * CHARGER_WALK_SPEED * 0.4 * eff * dt
        this.chargerTimer += delta
        if (this.chargerTimer >= CHARGER_COOLDOWN_MS) {
          this.chargerTimer = 0
          this.chargerState = 'walk'
        }
        break
    }
  }

  private updateNecromancer(dx: number, dy: number, dist: number, dt: number, delta: number, eff: number) {
    if (dist > NECRO_PREFERRED_DIST + 30) {
      this.x += (dx / dist) * this.speed * eff * dt
      this.y += (dy / dist) * this.speed * eff * dt
    } else if (dist < NECRO_PREFERRED_DIST - 30) {
      this.x -= (dx / dist) * this.speed * eff * dt
      this.y -= (dy / dist) * this.speed * eff * dt
    }
    this.necroFireTimer -= delta
    if (this.necroFireTimer <= 0) {
      this.necroFireTimer = NECRO_FIRE_INTERVAL
      for (let i = 0; i < NECRO_PROJ_COUNT; i++) {
        const angle = (i / NECRO_PROJ_COUNT) * Math.PI * 2
        this.pendingProjectiles.push({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * NECRO_PROJ_SPEED,
          vy: Math.sin(angle) * NECRO_PROJ_SPEED,
        })
      }
    }
  }

  private updateSummoner(dx: number, dy: number, dist: number, dt: number, delta: number) {
    this.x += (dx / dist) * this.speed * dt
    this.y += (dy / dist) * this.speed * dt

    const phase2 = this.hp < this.maxHp * 0.5
    if (this.summonerIsInvulnerable) {
      this.summonerInvulnRemaining -= delta
      if (this.summonerInvulnRemaining <= 0) {
        this.summonerIsInvulnerable  = false
        this.summonerInvulnCountdown = SUMMONER_INVULN_INTERVAL
        this.onInvulnChange?.(false)
      }
    } else {
      this.summonerInvulnCountdown -= delta
      if (this.summonerInvulnCountdown <= 0) {
        this.summonerIsInvulnerable  = true
        this.summonerInvulnRemaining = SUMMONER_INVULN_DURATION
        this.onInvulnChange?.(true)
        // Shield-up burst matches frontend SummonerBoss.activateShield()
        const burstCount = phase2 ? SUMMONER_COUNT_P2 : SUMMONER_COUNT_P1
        this.onSummon?.(this.x, this.y, burstCount, phase2)
        this.summonerSummonTimer = phase2 ? SUMMONER_SUMMON_P2 : SUMMONER_SUMMON_P1
      }
    }

    const interval = phase2 ? SUMMONER_SUMMON_P2 : SUMMONER_SUMMON_P1
    const count    = phase2 ? SUMMONER_COUNT_P2 : SUMMONER_COUNT_P1
    this.summonerSummonTimer -= delta
    if (this.summonerSummonTimer <= 0) {
      this.summonerSummonTimer = interval
      this.onSummon?.(this.x, this.y, count, phase2)
    }
  }

  private updateBoss(dx: number, dy: number, dist: number, dt: number, delta: number) {
    const isFinal = this.kind === 'finalBoss'
    // FinalBoss enters phase 2 at 35% HP (matches FinalBossEnemy: hp < FINAL_HP * 0.35)
    // Regular boss enters phase 2 at 50% HP (matches BossEnemy: hp < BOSS_MAX_HP * 0.5)
    const phase2  = isFinal ? this.hp < this.maxHp * 0.35 : this.hp < this.maxHp * 0.5
    const spdMult = phase2 ? (isFinal ? 1.6 : 1.5) : 1
    const tmMult  = phase2 ? (isFinal ? 0.55 : 0.6) : 1

    if (this.bossState === 'chase') {
      this.x += (dx / dist) * this.speed * spdMult * dt
      this.y += (dy / dist) * this.speed * spdMult * dt
      this.shootTimer      -= delta
      this.bossChargeTimer -= delta
      if (this.shootTimer <= 0) {
        this.shootTimer = (isFinal ? 2200 : 3000) * tmMult
        this.fireSpread(dx, dy, dist, isFinal, phase2)
      }
      if (isFinal) {
        this.ringTimer -= delta
        if (this.ringTimer <= 0) {
          this.ringTimer = 9000 * tmMult
          this.fireRing(phase2)
        }
      }
      if (this.bossChargeTimer <= 0) {
        this.bossChargeTimer = (isFinal ? 4500 : 6000) * tmMult
        this.bossState  = 'windup'
        this.bossTimer  = 500
        this.bossChargeVx = (dx / dist) * (isFinal ? 520 : 420) * spdMult
        this.bossChargeVy = (dy / dist) * (isFinal ? 520 : 420) * spdMult
      }
    } else if (this.bossState === 'windup') {
      this.bossTimer -= delta
      if (this.bossTimer <= 0) {
        this.bossState = 'charging'
        this.bossTimer = isFinal ? 900 : 700
      }
    } else {
      this.bossTimer -= delta
      this.x += this.bossChargeVx * dt
      this.y += this.bossChargeVy * dt
      if (this.bossTimer <= 0) this.bossState = 'chase'
    }
  }

  private fireSpread(dx: number, dy: number, dist: number, isFinal: boolean, phase2: boolean) {
    const baseAngle  = Math.atan2(dy, dx)
    const spread     = isFinal ? Math.PI / 2.2 : Math.PI / 3
    const baseCount  = isFinal ? 10 : 7
    const count      = phase2 ? baseCount + (isFinal ? 6 : 4) : baseCount
    const speed      = isFinal ? 230 : 220
    for (let i = 0; i < count; i++) {
      const angle = baseAngle - spread / 2 + (spread / (count - 1)) * i
      this.pendingProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed })
    }
  }

  private fireRing(phase2: boolean) {
    const count = phase2 ? 24 : 16
    const speed = phase2 ? 280 : 220
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      this.pendingProjectiles.push({ x: this.x, y: this.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed })
    }
  }

  snapshot(): EnemySnapshot {
    const snap: EnemySnapshot = { id: this.id, kind: this.kind, x: this.x, y: this.y, hp: this.hp, maxHp: this.maxHp }
    if (this.kind === 'charger') snap.isCharging = this.chargerState === 'charge'
    return snap
  }
}
