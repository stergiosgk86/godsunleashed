import Phaser, { TintModes } from 'phaser'
import type { AnyEnemy, EnemyBullet } from './Enemy'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { difficultyScale } from './difficultyScale'

const MOVE_SPEED      = 48
const MAX_HP          = 10
const CONTACT_DAMAGE  = 10
const XP_VALUE        = 5
const PREFERRED_DIST  = 200
const FIRE_INTERVAL   = 3500
const PROJECTILE_COUNT = 8
const PROJECTILE_SPEED = 160
const PROJECTILE_DAMAGE = 10

class NecroProjectile implements EnemyBullet {
  private graphic: Phaser.GameObjects.Image
  x: number
  y: number
  active = true
  private vx: number
  private vy: number
  private age = 0

  constructor(scene: Phaser.Scene, x: number, y: number, angle: number) {
    this.x = x
    this.y = y
    this.vx = Math.cos(angle) * PROJECTILE_SPEED
    this.vy = Math.sin(angle) * PROJECTILE_SPEED
    this.graphic = scene.add.image(x, y, 'enemy_bullet')
      .setRotation(angle)
      .setTint(0xaa00ff)
      .setScale(1.2)
      .setDepth(3)
  }

  get damage() { return PROJECTILE_DAMAGE }

  update(delta: number) {
    this.age += delta
    if (this.age > 2800) { this.destroy(); return }
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

export class NecromancerEnemy implements AnyEnemy {
  private scene: Phaser.Scene
  private graphic: Phaser.GameObjects.Sprite
  x: number
  y: number
  hp: number
  active = true
  contactDamage: number
  xpValue = XP_VALUE
  hitRadius = 17.6  // 32px frame × scale 1.1 × 0.5
  private projectiles: NecroProjectile[] = []
  private fireTimer = 1200  // first burst comes quickly
  private hitFlashTimer = 0
  private lastDir: Direction = 'down'
  private readonly baseScale = 1.1

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.hp = Math.round(MAX_HP * difficultyScale.hp)
    this.contactDamage = Math.round(CONTACT_DAMAGE * difficultyScale.damage)
    this.graphic = scene.add.sprite(x, y, 'enemy_necromancer')
      .setDepth(2)
      .setScale(this.baseScale)
      .setTint(0xcc88ff)
    this.graphic.play('enemy_necromancer_down')
  }

  takeDamage(amount: number) {
    this.hp -= amount
    this.hitFlashTimer = 80
    this.graphic.setTint(0xff4444)
  }

  update(playerX: number, playerY: number, delta: number) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta
      if (this.hitFlashTimer <= 0) this.graphic.setTint(0xcc88ff)
    }

    const dt = delta / 1000
    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1

    // Keep preferred distance from player
    if (dist > PREFERRED_DIST + 30) {
      this.x += (dx / dist) * MOVE_SPEED * difficultyScale.speed * dt
      this.y += (dy / dist) * MOVE_SPEED * difficultyScale.speed * dt
    } else if (dist < PREFERRED_DIST - 30) {
      this.x -= (dx / dist) * MOVE_SPEED * difficultyScale.speed * dt
      this.y -= (dy / dist) * MOVE_SPEED * difficultyScale.speed * dt
    }
    this.graphic.setPosition(this.x, this.y)
    this.lastDir = playDir(this.graphic, 'enemy_necromancer', getDirection(dx, dy), this.lastDir, true)

    // Fire burst
    this.fireTimer -= delta
    if (this.fireTimer <= 0) {
      this.fireTimer = FIRE_INTERVAL
      this.fireBurst()
    }

    for (const p of this.projectiles) {
      if (p.active) p.update(delta)
    }
    this.projectiles = this.projectiles.filter(p => p.active)
  }

  private fireBurst() {
    // Brief visual flash on cast
    this.graphic.setTint(0xffffff).setTintMode(TintModes.FILL)
    this.scene.time.delayedCall(120, () => {
      if (this.active) this.graphic.setTint(0xcc88ff)
    })

    for (let i = 0; i < PROJECTILE_COUNT; i++) {
      const angle = (i / PROJECTILE_COUNT) * Math.PI * 2
      this.projectiles.push(new NecroProjectile(this.scene, this.x, this.y, angle))
    }
  }

  getProjectiles(): EnemyBullet[] {
    return this.projectiles
  }

  destroy() {
    if (!this.active) return
    this.active = false
    for (const p of this.projectiles) p.destroy()
    this.graphic.anims.stop()
    this.graphic.setTint(0xcc88ff).setTintMode(TintModes.FILL)
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
