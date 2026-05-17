import Phaser, { TintModes } from 'phaser'
import type { AnyEnemy, EnemyBullet } from './Enemy'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { difficultyScale } from './difficultyScale'

const PREFERRED_DIST = 280
const MOVE_SPEED = 55
const FIRE_INTERVAL = 2500

class EnemyProjectile implements EnemyBullet {
  private graphic: Phaser.GameObjects.Image
  x: number
  y: number
  active = true
  private vx: number
  private vy: number
  private age = 0

  constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number) {
    this.x = x
    this.y = y
    const dx = targetX - x
    const dy = targetY - y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const speed = 200
    this.vx = (dx / dist) * speed
    this.vy = (dy / dist) * speed
    this.graphic = scene.add.image(x, y, 'enemy_bullet')
      .setRotation(Math.atan2(dy, dx))
      .setTint(0xdd1111)
      .setDepth(3)
  }

  update(delta: number) {
    this.age += delta
    if (this.age > 3000) { this.destroy(); return }
    const dt = delta / 1000
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.graphic.setPosition(this.x, this.y)
  }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}

export class RangedEnemy implements AnyEnemy {
  private graphic: Phaser.GameObjects.Sprite
  x: number
  y: number
  hp: number
  active = true
  contactDamage = 10
  xpValue = 2
  private scene: Phaser.Scene
  private projectiles: EnemyProjectile[] = []
  private fireTimer = 800
  private hitFlashTimer = 0
  private lastDir: Direction = 'down'
  private readonly baseScale = 1.2

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.hp = Math.round(40 * difficultyScale.hp)
    this.graphic = scene.add.sprite(x, y, 'enemy_ranged')
      .setDepth(2)
      .setScale(this.baseScale)
    this.graphic.play('enemy_ranged_down')
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
    const dist = Math.sqrt(dx * dx + dy * dy) || 1

    if (dist > PREFERRED_DIST + 30) {
      this.x += (dx / dist) * MOVE_SPEED * difficultyScale.speed * dt
      this.y += (dy / dist) * MOVE_SPEED * difficultyScale.speed * dt
    } else if (dist < PREFERRED_DIST - 30) {
      this.x -= (dx / dist) * MOVE_SPEED * difficultyScale.speed * dt
      this.y -= (dy / dist) * MOVE_SPEED * difficultyScale.speed * dt
    }
    this.graphic.setPosition(this.x, this.y)

    const dir = getDirection(dx, dy)
    this.lastDir = playDir(this.graphic, 'enemy_ranged', dir, this.lastDir, true)

    this.fireTimer -= delta
    if (this.fireTimer <= 0) {
      this.fireTimer = FIRE_INTERVAL
      this.projectiles.push(new EnemyProjectile(this.scene, this.x, this.y, targetX, targetY))
    }

    for (const p of this.projectiles) {
      if (p.active) p.update(delta)
    }
    this.projectiles = this.projectiles.filter(p => p.active)
  }

  getProjectiles(): EnemyBullet[] {
    return this.projectiles
  }

  destroy() {
    this.active = false
    for (const p of this.projectiles) p.destroy()
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
