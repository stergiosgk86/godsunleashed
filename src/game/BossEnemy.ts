import Phaser, { TintModes } from 'phaser'
import type { AnyEnemy, EnemyBullet } from './Enemy'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { useGameStore } from '../store/gameStore'

const BOSS_MAX_HP = 600
const BOSS_SPEED = 64
const CHARGE_SPEED = 336
const CHARGE_WINDUP = 500   // ms pause before dash
const CHARGE_DURATION = 700 // ms of actual dash
const SHOOT_INTERVAL = 3000
const CHARGE_INTERVAL = 6000
const SHOOT_COUNT = 7
const SHOOT_SPREAD = Math.PI / 3  // 60 degree fan

class BossProjectile implements EnemyBullet {
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
    const speed = 220
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.graphic = scene.add.image(x, y, 'enemy_bullet')
      .setScale(2)
      .setRotation(angle)
      .setDepth(3)
      .setTint(0xff6600)
  }

  update(delta: number) {
    this.age += delta
    if (this.age > 4000) { this.destroy(); return }
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

type BossState = 'chase' | 'windup' | 'charging'

export class BossEnemy implements AnyEnemy {
  private scene: Phaser.Scene
  private graphic: Phaser.GameObjects.Sprite
  x: number
  y: number
  hp = BOSS_MAX_HP
  active = true
  contactDamage = 30
  xpValue = 80
  isBoss = true
  private projectiles: BossProjectile[] = []
  private shootTimer = 1500
  private chargeTimer = CHARGE_INTERVAL
  private state: BossState = 'chase'
  private stateTimer = 0
  private chargeVx = 0
  private chargeVy = 0
  private hitFlashTimer = 0
  private lastDir: Direction = 'down'

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.graphic = scene.add.sprite(x, y, 'boss')
      .setDepth(3)
      .setScale(1.5)
    this.graphic.play('boss_down')
    useGameStore.getState().setBossHp(BOSS_MAX_HP, BOSS_MAX_HP)
  }

  private get isPhase2(): boolean { return this.hp < BOSS_MAX_HP * 0.5 }
  private get speedMultiplier(): number { return this.isPhase2 ? 1.5 : 1 }
  private get timerMultiplier(): number { return this.isPhase2 ? 0.6 : 1 }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount)
    this.hitFlashTimer = 80
    this.graphic.setTint(0xffffff).setTintMode(TintModes.FILL)
    useGameStore.getState().setBossHp(this.hp)

    // Phase 2 visual: tint boss red permanently in phase 2
    if (this.isPhase2) this.graphic.setTint(0xff8888)
  }

  update(targetX: number, targetY: number, delta: number) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta
      if (this.hitFlashTimer <= 0) {
        this.graphic.clearTint()
        if (this.isPhase2) this.graphic.setTint(0xff8888)
      }
    }

    const dt = delta / 1000
    const dx = targetX - this.x
    const dy = targetY - this.y

    // --- State machine ---
    if (this.state === 'chase') {
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 1) {
        const spd = BOSS_SPEED * this.speedMultiplier
        this.x += (dx / dist) * spd * dt
        this.y += (dy / dist) * spd * dt
        this.graphic.setPosition(this.x, this.y)
        const dir = getDirection(dx, dy)
        this.lastDir = playDir(this.graphic, 'boss', dir, this.lastDir, true)
      }

      // Shoot countdown
      this.shootTimer -= delta
      if (this.shootTimer <= 0) {
        this.shootTimer = SHOOT_INTERVAL * this.timerMultiplier
        this.fireSpread(targetX, targetY)
      }

      // Charge countdown
      this.chargeTimer -= delta
      if (this.chargeTimer <= 0) {
        this.chargeTimer = CHARGE_INTERVAL * this.timerMultiplier
        this.beginWindup(dx, dy)
      }

    } else if (this.state === 'windup') {
      // Brief pause — flash to warn player
      this.stateTimer -= delta
      const flash = Math.floor(this.stateTimer / 80) % 2 === 0
      this.graphic.setAlpha(flash ? 0.4 : 1)
      if (this.stateTimer <= 0) {
        this.graphic.setAlpha(1)
        this.state = 'charging'
        this.stateTimer = CHARGE_DURATION
      }

    } else if (this.state === 'charging') {
      this.stateTimer -= delta
      this.x += this.chargeVx * dt
      this.y += this.chargeVy * dt
      this.graphic.setPosition(this.x, this.y)
      if (this.stateTimer <= 0) {
        this.state = 'chase'
      }
    }

    // Update projectiles
    for (const p of this.projectiles) {
      if (p.active) p.update(delta)
    }
    this.projectiles = this.projectiles.filter(p => p.active)
  }

  private beginWindup(dx: number, dy: number) {
    this.state = 'windup'
    this.stateTimer = CHARGE_WINDUP
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    this.chargeVx = (dx / dist) * CHARGE_SPEED * this.speedMultiplier
    this.chargeVy = (dy / dist) * CHARGE_SPEED * this.speedMultiplier
  }

  private fireSpread(targetX: number, targetY: number) {
    const baseAngle = Math.atan2(targetY - this.y, targetX - this.x)
    const count = this.isPhase2 ? SHOOT_COUNT + 4 : SHOOT_COUNT
    for (let i = 0; i < count; i++) {
      const angle = baseAngle - SHOOT_SPREAD / 2 + (SHOOT_SPREAD / (count - 1)) * i
      this.projectiles.push(new BossProjectile(this.scene, this.x, this.y, angle))
    }
  }

  getProjectiles(): EnemyBullet[] {
    return this.projectiles
  }

  destroy() {
    this.active = false
    useGameStore.getState().setBossHp(null)
    for (const p of this.projectiles) p.destroy()
    this.graphic.anims.stop()
    this.graphic.clearTint()

    // Dramatic death: spin + expand + fade
    this.scene.tweens.add({
      targets: this.graphic,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      angle: 360,
      duration: 800,
      ease: 'Power2',
      onComplete: () => this.graphic.destroy(),
    })
  }
}
