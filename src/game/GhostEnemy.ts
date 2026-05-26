import Phaser, { TintModes } from 'phaser'
import type { AnyEnemy } from './Enemy'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { difficultyScale } from './difficultyScale'

const SPEED          = 224
const MAX_HP         = 2
const CONTACT_DAMAGE = 12
const XP_VALUE       = 2
const DESPAWN_DIST   = 1400

export class GhostEnemy implements AnyEnemy {
  private scene: Phaser.Scene
  private graphic: Phaser.GameObjects.Sprite
  x: number
  y: number
  hp: number
  active = true
  contactDamage: number
  xpValue = XP_VALUE
  private vx: number
  private vy: number
  private lastDir: Direction = 'down'
  private hitFlashTimer = 0
  private readonly baseScale = 0.9

  constructor(scene: Phaser.Scene, x: number, y: number, playerX: number, playerY: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.hp = Math.round(MAX_HP * difficultyScale.hp)
    this.contactDamage = Math.round(CONTACT_DAMAGE * difficultyScale.damage)

    // Fly in a straight line toward the player's position at spawn time
    const dx = playerX - x
    const dy = playerY - y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    this.vx = (dx / dist) * SPEED
    this.vy = (dy / dist) * SPEED

    this.graphic = scene.add.sprite(x, y, 'enemy_ghost')
      .setDepth(2)
      .setScale(this.baseScale)
      .setAlpha(0.82)
      .setTint(0xaaddff)
    this.graphic.play('enemy_ghost_down')
  }

  takeDamage(amount: number) {
    this.hp -= amount
    this.hitFlashTimer = 80
    this.graphic.setTint(0xff4444)
  }

  update(playerX: number, playerY: number, delta: number) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta
      if (this.hitFlashTimer <= 0) this.graphic.setTint(0xaaddff)
    }

    const dt = delta / 1000
    this.x += this.vx * difficultyScale.speed * dt
    this.y += this.vy * difficultyScale.speed * dt
    this.graphic.setPosition(this.x, this.y)

    const dir = getDirection(this.vx, this.vy)
    this.lastDir = playDir(this.graphic, 'enemy_ghost', dir, this.lastDir, true)

    const dx = this.x - playerX
    const dy = this.y - playerY
    if (dx * dx + dy * dy > DESPAWN_DIST * DESPAWN_DIST) {
      this.active = false
      this.graphic.destroy()
    }
  }

  destroy() {
    if (!this.active) return
    this.active = false
    this.graphic.anims.stop()
    this.graphic.setTint(0xaaddff).setTintMode(TintModes.FILL)
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
