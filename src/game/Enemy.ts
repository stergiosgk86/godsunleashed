import Phaser, { TintModes } from 'phaser'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { difficultyScale } from './difficultyScale'

export type EnemyType = 'basic' | 'speeder' | 'tank'

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
}

const CONFIGS: Record<EnemyType, EnemyConfig> = {
  basic:   { speed: 80,  maxHp: 60,  textureKey: 'enemy_basic',   contactDamage: 15, xpValue: 1, scale: 1.2, frameRate: 8  },
  speeder: { speed: 190, maxHp: 20,  textureKey: 'enemy_speeder',  contactDamage: 10, xpValue: 1, scale: 0.9, frameRate: 12 },
  tank:    { speed: 35,  maxHp: 250, textureKey: 'enemy_tank',     contactDamage: 30, xpValue: 3, scale: 1.8, frameRate: 5  },
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
  private baseScale: number
  private textureKey: string
  private lastDir: Direction = 'down'
  private hitFlashTimer = 0

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
    this.graphic = scene.add.sprite(x, y, cfg.textureKey)
      .setDepth(2)
      .setScale(cfg.scale)
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
      if (this.hitFlashTimer <= 0) this.graphic.clearTint()
    }

    const dt = delta / 1000
    const dx = targetX - this.x
    const dy = targetY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 1) {
      this.x += (dx / dist) * this.speed * difficultyScale.speed * dt
      this.y += (dy / dist) * this.speed * difficultyScale.speed * dt
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
