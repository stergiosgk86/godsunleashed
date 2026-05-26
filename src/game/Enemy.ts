import Phaser, { TintModes } from 'phaser'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { difficultyScale } from './difficultyScale'

export type EnemyType = 'basic' | 'speeder' | 'tank' | 'veteran' | 'brute' | 'revenant' | 'titan'

export interface EnemyBullet {
  x: number
  y: number
  active: boolean
  destroy(): void
}

export interface AnyEnemy {
  x: number
  y: number
  hp: number
  active: boolean
  contactDamage: number
  xpValue: number
  isBoss?: boolean
  takeDamage(amount: number): void
  destroy(): void
  update(tx: number, ty: number, delta: number): void
  getProjectiles?(): EnemyBullet[]
}

interface EnemyConfig {
  speed: number
  maxHp: number
  textureKey: string
  contactDamage: number
  xpValue: number
  scale: number
  frameRate: number
  tint?: number
  alpha?: number
}

const CONFIGS: Record<EnemyType, EnemyConfig> = {
  basic:    { speed: 75,  maxHp: 1,  textureKey: 'enemy_basic',    contactDamage: 10, xpValue: 2,  scale: 1.2, frameRate: 8  },
  speeder:  { speed: 148, maxHp: 15, textureKey: 'enemy_speeder',   contactDamage: 8,  xpValue: 1,  scale: 0.9, frameRate: 12 },
  tank:     { speed: 38,  maxHp: 40, textureKey: 'enemy_tank',      contactDamage: 20, xpValue: 6,  scale: 1.8, frameRate: 5  },
  veteran:  { speed: 110, maxHp: 12, textureKey: 'enemy_veteran',   contactDamage: 14, xpValue: 3,  scale: 1.3, frameRate: 10 },
  brute:    { speed: 28,  maxHp: 25, textureKey: 'enemy_brute',     contactDamage: 25, xpValue: 8,  scale: 2.1, frameRate: 4  },
  revenant: { speed: 140, maxHp: 35, textureKey: 'enemy_revenant',  contactDamage: 15, xpValue: 10, scale: 1.0, frameRate: 8,  alpha: 0.75 },
  titan:    { speed: 18,  maxHp: 80, textureKey: 'enemy_titan',     contactDamage: 35, xpValue: 15, scale: 2.8, frameRate: 3  },
}

export class Enemy implements AnyEnemy {
  private scene: Phaser.Scene
  private graphic: Phaser.GameObjects.Sprite
  readonly type: EnemyType
  x: number
  y: number
  hp: number
  active = true
  contactDamage: number
  xpValue: number
  private speed: number
  speedMultiplier = 1.0
  private baseScale: number
  private textureKey: string
  private lastDir: Direction = 'down'
  private hitFlashTimer = 0
  private baseTint: number | undefined
  private baseAlpha: number

  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyType = 'basic') {
    const cfg = CONFIGS[type]
    this.type = type
    this.scene = scene
    this.x = x
    this.y = y
    this.hp = Math.round(cfg.maxHp * difficultyScale.hp)
    this.speed = cfg.speed
    this.contactDamage = Math.round(cfg.contactDamage * difficultyScale.damage)
    this.xpValue = cfg.xpValue
    this.textureKey = cfg.textureKey
    this.baseScale = cfg.scale
    this.baseTint  = cfg.tint
    this.baseAlpha = cfg.alpha ?? 1
    this.graphic = scene.add.sprite(x, y, cfg.textureKey)
      .setDepth(2)
      .setScale(cfg.scale)
    if (cfg.tint  !== undefined) this.graphic.setTint(cfg.tint)
    if (cfg.alpha !== undefined) this.graphic.setAlpha(cfg.alpha)
    this.graphic.play(`${cfg.textureKey}_down`)
  }

  takeDamage(amount: number) {
    this.hp -= amount
    this.hitFlashTimer = 80
    this.graphic.setTint(0xff4444)
  }

  update(targetX: number, targetY: number, delta: number) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta
      if (this.hitFlashTimer <= 0) {
        if (this.baseTint !== undefined) this.graphic.setTint(this.baseTint)
        else this.graphic.clearTint()
        this.graphic.setAlpha(this.baseAlpha)
      }
    }

    const dt = delta / 1000
    const dx = targetX - this.x
    const dy = targetY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 1) {
      this.x += (dx / dist) * this.speed * difficultyScale.speed * this.speedMultiplier * dt
      this.y += (dy / dist) * this.speed * difficultyScale.speed * this.speedMultiplier * dt
      this.graphic.setPosition(this.x, this.y)
      const dir = getDirection(dx, dy)
      this.lastDir = playDir(this.graphic, this.textureKey, dir, this.lastDir, true)
    }
  }

  destroy() {
    this.active = false
    this.graphic.anims.stop()
    this.graphic.setTint(0xff2222).setTintMode(TintModes.FILL)

    // Phase 1: quick pop up
    this.scene.tweens.add({
      targets: this.graphic,
      scaleX: this.baseScale * 1.4,
      scaleY: this.baseScale * 1.4,
      duration: 60,
      ease: 'Power1',
      onComplete: () => {
        // Phase 2: shrink + fade out
        this.scene.tweens.add({
          targets: this.graphic,
          scaleX: 0,
          scaleY: 0,
          alpha: 0,
          duration: 280,
          ease: 'Power2In',
          onComplete: () => this.graphic.destroy(),
        })
      },
    })
  }
}
