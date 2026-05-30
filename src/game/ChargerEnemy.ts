import Phaser, { TintModes } from 'phaser'
import type { AnyEnemy } from './Enemy'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { difficultyScale } from './difficultyScale'

const WALK_SPEED        = 72
const CHARGE_SPEED      = 440
const MAX_HP            = 10
const WALK_DAMAGE       = 12
const CHARGE_DAMAGE     = 30
const XP_VALUE          = 5
const TELEGRAPH_MS      = 900
const CHARGE_MS         = 650
const COOLDOWN_MS       = 2000

type ChargerState = 'walk' | 'telegraph' | 'charge' | 'cooldown'

export class ChargerEnemy implements AnyEnemy {
  private scene: Phaser.Scene
  private graphic: Phaser.GameObjects.Sprite
  x: number
  y: number
  hp: number
  active = true
  contactDamage: number
  xpValue = XP_VALUE
  hitRadius = 20.8  // 32px frame × scale 1.3 × 0.5
  private state: ChargerState = 'walk'
  private stateTimer = 0
  private chargeVx = 0
  private chargeVy = 0
  private lastDir: Direction = 'down'
  private hitFlashTimer = 0
  private readonly baseScale = 1.3

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.hp = Math.round(MAX_HP * difficultyScale.hp)
    this.contactDamage = Math.round(WALK_DAMAGE * difficultyScale.damage)
    this.graphic = scene.add.sprite(x, y, 'enemy_charger')
      .setDepth(2)
      .setScale(this.baseScale)
    this.graphic.play('enemy_charger_down')
  }

  takeDamage(amount: number) {
    this.hp -= amount
    this.hitFlashTimer = 80
    this.graphic.setTint(0xff4444)
  }

  update(playerX: number, playerY: number, delta: number) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta
      if (this.hitFlashTimer <= 0) this.graphic.clearTint()
    }

    const dt = delta / 1000
    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1

    switch (this.state) {
      case 'walk': {
        this.x += (dx / dist) * WALK_SPEED * difficultyScale.speed * dt
        this.y += (dy / dist) * WALK_SPEED * difficultyScale.speed * dt
        const dir = getDirection(dx, dy)
        this.lastDir = playDir(this.graphic, 'enemy_charger', dir, this.lastDir, true)
        this.stateTimer += delta
        if (this.stateTimer >= 2500) {
          this.stateTimer = 0
          this.state = 'telegraph'
          this.graphic.anims.stop()
          this.chargeVx = (dx / dist) * CHARGE_SPEED
          this.chargeVy = (dy / dist) * CHARGE_SPEED
        }
        break
      }

      case 'telegraph': {
        // Flash yellow-white as warning
        const flash = Math.floor(this.stateTimer / 90) % 2 === 0
        this.graphic.setTint(flash ? 0xffffaa : 0xff8800).setTintMode(TintModes.FILL)
        // Track player during telegraph so the charge feels aimed
        this.chargeVx = (dx / dist) * CHARGE_SPEED
        this.chargeVy = (dy / dist) * CHARGE_SPEED
        this.stateTimer += delta
        if (this.stateTimer >= TELEGRAPH_MS) {
          this.stateTimer = 0
          this.state = 'charge'
          this.graphic.clearTint()
          this.contactDamage = Math.round(CHARGE_DAMAGE * difficultyScale.damage)
        }
        break
      }

      case 'charge': {
        this.x += this.chargeVx * difficultyScale.speed * dt
        this.y += this.chargeVy * difficultyScale.speed * dt
        const cdir = getDirection(this.chargeVx, this.chargeVy)
        this.lastDir = playDir(this.graphic, 'enemy_charger', cdir, this.lastDir, true)
        this.stateTimer += delta
        if (this.stateTimer >= CHARGE_MS) {
          this.stateTimer = 0
          this.state = 'cooldown'
          this.contactDamage = Math.round(WALK_DAMAGE * difficultyScale.damage)
          this.graphic.anims.stop()
        }
        break
      }

      case 'cooldown': {
        // Drift slowly while recovering
        this.x += (dx / dist) * (WALK_SPEED * 0.4) * difficultyScale.speed * dt
        this.y += (dy / dist) * (WALK_SPEED * 0.4) * difficultyScale.speed * dt
        this.stateTimer += delta
        if (this.stateTimer >= COOLDOWN_MS) {
          this.stateTimer = 0
          this.state = 'walk'
          const dir = getDirection(dx, dy)
          this.lastDir = playDir(this.graphic, 'enemy_charger', dir, this.lastDir, true)
        }
        break
      }
    }

    this.graphic.setPosition(this.x, this.y)
  }

  destroy() {
    if (!this.active) return
    this.active = false
    this.graphic.anims.stop()
    this.graphic.setTint(0xff2222).setTintMode(TintModes.FILL)
    this.scene.tweens.add({
      targets: this.graphic,
      scaleX: this.baseScale * 1.4,
      scaleY: this.baseScale * 1.4,
      duration: 60,
      ease: 'Power1',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.graphic,
          scaleX: 0, scaleY: 0, alpha: 0,
          duration: 280,
          ease: 'Power2In',
          onComplete: () => this.graphic.destroy(),
        })
      },
    })
  }
}
