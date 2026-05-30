import Phaser, { TintModes } from 'phaser'
import type { AnyEnemy, EnemyBullet } from './Enemy'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { useGameStore } from '../store/gameStore'

const FINAL_HP        = 2000
const BOSS_SPEED      = 80
const CHARGE_SPEED    = 416
const CHARGE_WINDUP   = 500
const CHARGE_DURATION = 900
const SHOOT_INTERVAL  = 2200
const RING_INTERVAL   = 9000
const CHARGE_INTERVAL = 4500
const SHOOT_COUNT     = 10
const RING_COUNT      = 16
const SHOOT_SPREAD    = Math.PI / 2.2

class FinalProjectile implements EnemyBullet {
  private graphic: Phaser.GameObjects.Image
  x: number; y: number
  active = true
  private vx: number; private vy: number
  private age = 0

  constructor(scene: Phaser.Scene, x: number, y: number, angle: number, speed = 230) {
    this.x = x; this.y = y
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.graphic = scene.add.image(x, y, 'enemy_bullet')
      .setScale(2.5).setRotation(angle).setDepth(3).setTint(0xcc00ff)
  }

  update(delta: number) {
    this.age += delta
    if (this.age > 5000) { this.destroy(); return }
    const dt = delta / 1000
    this.x += this.vx * dt; this.y += this.vy * dt
    this.graphic.setPosition(this.x, this.y)
  }

  destroy() { this.graphic.destroy(); this.active = false }
}

type BossState = 'chase' | 'windup' | 'charging'

export class FinalBossEnemy implements AnyEnemy {
  private scene: Phaser.Scene
  private graphic: Phaser.GameObjects.Sprite
  x: number; y: number
  hp = FINAL_HP
  active = true
  contactDamage = 30
  xpValue = 500
  isBoss = true
  hitRadius = 96  // 96px frame × scale 2.0 × 0.5
  private projectiles: FinalProjectile[] = []
  private shootTimer = 2000
  private ringTimer = RING_INTERVAL * 0.6
  private chargeTimer = CHARGE_INTERVAL
  private state: BossState = 'chase'
  private stateTimer = 0
  private chargeVx = 0; private chargeVy = 0
  private hitFlashTimer = 0
  private lastDir: Direction = 'down'

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene; this.x = x; this.y = y
    this.graphic = scene.add.sprite(x, y, 'boss')
      .setDepth(3).setScale(2.0).setTint(0x9922cc)
    this.graphic.play('boss_down')
    useGameStore.getState().setBossHp(FINAL_HP, FINAL_HP)
  }

  private get isPhase2(): boolean { return this.hp < FINAL_HP * 0.35 }
  private get speedMult(): number { return this.isPhase2 ? 1.6 : 1 }
  private get timerMult(): number { return this.isPhase2 ? 0.55 : 1 }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount)
    this.hitFlashTimer = 80
    this.graphic.setTint(0xffffff).setTintMode(TintModes.FILL)
    useGameStore.getState().setBossHp(this.hp)
    if (this.isPhase2) this.graphic.setTint(0xff00aa)
  }

  update(targetX: number, targetY: number, delta: number) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta
      if (this.hitFlashTimer <= 0) {
        this.graphic.clearTint()
        this.graphic.setTint(this.isPhase2 ? 0xff00aa : 0x9922cc)
      }
    }

    const dt = delta / 1000
    const dx = targetX - this.x
    const dy = targetY - this.y

    if (this.state === 'chase') {
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 1) {
        const spd = BOSS_SPEED * this.speedMult
        this.x += (dx / dist) * spd * dt
        this.y += (dy / dist) * spd * dt
        this.graphic.setPosition(this.x, this.y)
        const dir = getDirection(dx, dy)
        this.lastDir = playDir(this.graphic, 'boss', dir, this.lastDir, true)
      }

      // Fan spread
      this.shootTimer -= delta
      if (this.shootTimer <= 0) {
        this.shootTimer = SHOOT_INTERVAL * this.timerMult
        this.fireSpread(targetX, targetY)
      }

      // 360° ring
      this.ringTimer -= delta
      if (this.ringTimer <= 0) {
        this.ringTimer = RING_INTERVAL * this.timerMult
        this.fireRing()
      }

      // Charge
      this.chargeTimer -= delta
      if (this.chargeTimer <= 0) {
        this.chargeTimer = CHARGE_INTERVAL * this.timerMult
        this.beginWindup(dx, dy)
      }

    } else if (this.state === 'windup') {
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
      if (this.stateTimer <= 0) this.state = 'chase'
    }

    for (const p of this.projectiles) if (p.active) p.update(delta)
    this.projectiles = this.projectiles.filter(p => p.active)
  }

  private beginWindup(dx: number, dy: number) {
    this.state = 'windup'
    this.stateTimer = CHARGE_WINDUP
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    this.chargeVx = (dx / dist) * CHARGE_SPEED * this.speedMult
    this.chargeVy = (dy / dist) * CHARGE_SPEED * this.speedMult
  }

  private fireSpread(targetX: number, targetY: number) {
    const baseAngle = Math.atan2(targetY - this.y, targetX - this.x)
    const count = this.isPhase2 ? SHOOT_COUNT + 6 : SHOOT_COUNT
    for (let i = 0; i < count; i++) {
      const angle = baseAngle - SHOOT_SPREAD / 2 + (SHOOT_SPREAD / (count - 1)) * i
      this.projectiles.push(new FinalProjectile(this.scene, this.x, this.y, angle))
    }
  }

  private fireRing() {
    const count = this.isPhase2 ? RING_COUNT + 8 : RING_COUNT
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const speed = this.isPhase2 ? 280 : 220
      this.projectiles.push(new FinalProjectile(this.scene, this.x, this.y, angle, speed))
    }
  }

  getProjectiles(): EnemyBullet[] { return this.projectiles }

  destroy() {
    this.active = false
    useGameStore.getState().setBossHp(null)
    for (const p of this.projectiles) p.destroy()
    this.graphic.anims.stop()
    this.graphic.clearTint()

    this.scene.tweens.add({
      targets: this.graphic,
      scaleX: 5, scaleY: 5, alpha: 0, angle: 720,
      duration: 1200, ease: 'Power2',
      onComplete: () => this.graphic.destroy(),
    })
  }
}
