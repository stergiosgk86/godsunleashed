import Phaser, { TintModes } from 'phaser'
import type { AnyEnemy } from './Enemy'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { useGameStore } from '../store/gameStore'
import { difficultyScale } from './difficultyScale'

const SPEED = 65
const MAX_HP = 100
const XP_VALUE = 2
const TRIGGER_RADIUS = 110   // arms the bomb when player is this close
const COUNTDOWN_MS = 1200    // ms from trigger to detonation
const EXPLODE_RADIUS = 120   // AoE radius
const EXPLODE_DAMAGE = 45

export class ExploderEnemy implements AnyEnemy {
  private scene: Phaser.Scene
  private graphic: Phaser.GameObjects.Sprite
  x: number
  y: number
  hp: number
  active = true
  contactDamage = 0
  xpValue = XP_VALUE
  private state: 'chase' | 'countdown' = 'chase'
  private countdownTimer = 0
  private hitFlashTimer = 0
  private lastDir: Direction = 'down'
  private readonly baseScale = 1.1
  private lastPlayerX = 0
  private lastPlayerY = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.hp = Math.round(MAX_HP * difficultyScale.hp)
    this.graphic = scene.add.sprite(x, y, 'enemy_exploder')
      .setDepth(2)
      .setScale(this.baseScale)
    this.graphic.play('enemy_exploder_down')
  }

  takeDamage(amount: number) {
    this.hp -= amount
    this.hitFlashTimer = 80
    this.graphic.setTint(0xffffff).setTintMode(TintModes.FILL)
  }

  update(targetX: number, targetY: number, delta: number) {
    this.lastPlayerX = targetX
    this.lastPlayerY = targetY

    const dx = targetX - this.x
    const dy = targetY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const dt = delta / 1000

    if (this.state === 'chase') {
      if (this.hitFlashTimer > 0) {
        this.hitFlashTimer -= delta
        if (this.hitFlashTimer <= 0) this.graphic.clearTint()
      }

      if (dist > 1) {
        this.x += (dx / dist) * SPEED * difficultyScale.speed * dt
        this.y += (dy / dist) * SPEED * difficultyScale.speed * dt
        this.graphic.setPosition(this.x, this.y)
        const dir = getDirection(dx, dy)
        this.lastDir = playDir(this.graphic, 'enemy_exploder', dir, this.lastDir, true)
      }

      if (dist < TRIGGER_RADIUS) {
        this.state = 'countdown'
        this.countdownTimer = COUNTDOWN_MS
        this.graphic.anims.stop()
      }

    } else {
      // Countdown: stop moving, pulse warning faster as it approaches zero
      this.countdownTimer -= delta
      const t = 1 - this.countdownTimer / COUNTDOWN_MS  // 0→1 as countdown progresses
      const flashInterval = Math.max(55, 180 - t * 125)
      const flash = Math.floor(this.countdownTimer / flashInterval) % 2 === 0
      this.graphic.setAlpha(flash ? 1 : 0.25)
      this.graphic.setScale(this.baseScale + t * 0.35)
      this.graphic.setTint(0xff4400).setTintMode(TintModes.FILL)

      if (this.countdownTimer <= 0) {
        this.active = false
        this.explode()
      }
    }
  }

  private explode() {
    const dx = this.lastPlayerX - this.x
    const dy = this.lastPlayerY - this.y
    if (dx * dx + dy * dy < EXPLODE_RADIUS * EXPLODE_RADIUS) {
      useGameStore.getState().takeDamage(Math.round(EXPLODE_DAMAGE * difficultyScale.damage))
    }

    // Expanding ring
    const ring = this.scene.add.graphics().setDepth(10)
    ring.lineStyle(5, 0xff6600, 1)
    ring.strokeCircle(this.x, this.y, 18)
    ring.fillStyle(0xff8800, 0.45)
    ring.fillCircle(this.x, this.y, 18)
    this.scene.tweens.add({
      targets: ring,
      scaleX: EXPLODE_RADIUS / 18,
      scaleY: EXPLODE_RADIUS / 18,
      alpha: 0,
      duration: 380,
      ease: 'Power2Out',
      onComplete: () => ring.destroy(),
    })

    this.graphic.setAlpha(0)
    this.scene.time.delayedCall(50, () => this.graphic.destroy())
  }

  destroy() {
    if (!this.active) return
    this.active = false
    this.explode()
  }
}
