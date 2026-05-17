import type { EnemyKind, EnemySnapshot } from './protocol.js'

interface Cfg {
  speed: number; maxHp: number; xpValue: number; isBoss: boolean
}

const CONFIGS: Record<EnemyKind, Cfg> = {
  basic:     { speed: 80,  maxHp: 25,   xpValue: 1,   isBoss: false },
  speeder:   { speed: 190, maxHp: 8,    xpValue: 1,   isBoss: false },
  tank:      { speed: 35,  maxHp: 100,  xpValue: 3,   isBoss: false },
  ranged:    { speed: 55,  maxHp: 40,   xpValue: 2,   isBoss: false },
  exploder:  { speed: 65,  maxHp: 55,   xpValue: 2,   isBoss: false },
  boss:      { speed: 55,  maxHp: 2500, xpValue: 80,  isBoss: true  },
  finalBoss: { speed: 72,  maxHp: 8000, xpValue: 200, isBoss: true  },
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

  // Boss state machine
  private bossState: 'chase' | 'windup' | 'charging' = 'chase'
  private bossTimer = 0
  private chargeVx = 0
  private chargeVy = 0
  private chargeTimer = 6000
  private shootTimer = 1500

  // Exploder state
  private exploderArmed = false
  private exploderTimer = 0

  // Ranged preferred distance
  private readonly RANGED_DIST = 280

  constructor(kind: EnemyKind, x: number, y: number, hpMult = 1) {
    this.id = _nextId++
    this.kind = kind
    this.x = x
    this.y = y
    const cfg = CONFIGS[kind]
    this.hp = Math.round(cfg.maxHp * hpMult)
    this.maxHp = this.hp
    this.speed = cfg.speed
    this.xpValue = cfg.xpValue
    this.isBoss = cfg.isBoss
    // Boss charge timer starts higher so it doesn't charge immediately
    if (kind === 'boss' || kind === 'finalBoss') this.chargeTimer = 8000
  }

  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount)
    if (this.hp <= 0) { this.active = false; return true }
    return false
  }

  update(nearestX: number, nearestY: number, delta: number, speedMult = 1) {
    if (!this.active) return
    const dt = delta / 1000
    const dx = nearestX - this.x
    const dy = nearestY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1

    switch (this.kind) {
      case 'basic':
      case 'speeder':
      case 'tank':
        this.x += (dx / dist) * this.speed * speedMult * dt
        this.y += (dy / dist) * this.speed * speedMult * dt
        break

      case 'ranged': {
        if (dist > this.RANGED_DIST + 30) {
          this.x += (dx / dist) * this.speed * speedMult * dt
          this.y += (dy / dist) * this.speed * speedMult * dt
        } else if (dist < this.RANGED_DIST - 30) {
          this.x -= (dx / dist) * this.speed * speedMult * dt
          this.y -= (dy / dist) * this.speed * speedMult * dt
        }
        break
      }

      case 'exploder':
        if (!this.exploderArmed) {
          this.x += (dx / dist) * this.speed * speedMult * dt
          this.y += (dy / dist) * this.speed * speedMult * dt
          if (dist < 110) { this.exploderArmed = true; this.exploderTimer = 1200 }
        } else {
          this.exploderTimer -= delta
          if (this.exploderTimer <= 0) this.active = false
        }
        break

      case 'boss':
      case 'finalBoss':
        this.updateBoss(dx, dy, dist, dt, delta)
        break
    }
  }

  private updateBoss(dx: number, dy: number, dist: number, dt: number, delta: number) {
    const phase2 = this.hp < this.maxHp * 0.5
    const spdMult = phase2 ? 1.5 : 1
    const tmMult  = phase2 ? 0.6 : 1
    const isFinal = this.kind === 'finalBoss'

    if (this.bossState === 'chase') {
      this.x += (dx / dist) * this.speed * spdMult * dt
      this.y += (dy / dist) * this.speed * spdMult * dt
      this.shootTimer -= delta
      this.chargeTimer -= delta
      if (this.chargeTimer <= 0) {
        this.chargeTimer = (isFinal ? 4500 : 6000) * tmMult
        this.bossState = 'windup'
        this.bossTimer = 500
        this.chargeVx = (dx / dist) * (isFinal ? 520 : 420) * spdMult
        this.chargeVy = (dy / dist) * (isFinal ? 520 : 420) * spdMult
      }
    } else if (this.bossState === 'windup') {
      this.bossTimer -= delta
      if (this.bossTimer <= 0) {
        this.bossState = 'charging'
        this.bossTimer = isFinal ? 900 : 700
      }
    } else {
      this.bossTimer -= delta
      this.x += this.chargeVx * dt
      this.y += this.chargeVy * dt
      if (this.bossTimer <= 0) this.bossState = 'chase'
    }
  }

  snapshot(): EnemySnapshot {
    return { id: this.id, kind: this.kind, x: this.x, y: this.y, hp: this.hp, maxHp: this.maxHp }
  }
}
