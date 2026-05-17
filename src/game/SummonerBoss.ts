import Phaser, { TintModes } from 'phaser'
import type { AnyEnemy } from './Enemy'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { useGameStore } from '../store/gameStore'

const MAX_HP           = 4000
const SPEED            = 45
const INVULN_INTERVAL  = 10_000  // 10s vulnerable before next shield
const INVULN_DURATION  =  5_000  // 5s invulnerable
const SUMMON_INTERVAL_P1 = 8_000
const SUMMON_INTERVAL_P2 = 4_500
const SUMMON_COUNT_P1  = 6
const SUMMON_COUNT_P2  = 10

const TINT_NORMAL = 0x33dd77
const TINT_P2     = 0xff8844

export class SummonerBoss implements AnyEnemy {
  private scene: Phaser.Scene
  private graphic: Phaser.GameObjects.Sprite
  private shield: Phaser.GameObjects.Graphics
  x: number
  y: number
  hp = MAX_HP
  active = true
  contactDamage = 35
  xpValue = 150
  isBoss = true

  private invulnCountdown = INVULN_INTERVAL
  private invulnRemaining = 0
  private isInvulnerable = false
  private summonTimer = SUMMON_INTERVAL_P1 * 0.5  // first summon sooner
  private hitFlashTimer = 0
  private lastDir: Direction = 'down'

  // Set by EnemySpawner to push new minions into the active enemy list
  onSummon?: (x: number, y: number, count: number, phase2: boolean) => void

  private get isPhase2(): boolean { return this.hp < MAX_HP * 0.5 }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.graphic = scene.add.sprite(x, y, 'boss')
      .setDepth(3)
      .setScale(1.6)
      .setTint(TINT_NORMAL)
    this.graphic.play('boss_down')
    this.shield = scene.add.graphics().setDepth(4)
    useGameStore.getState().setBossHp(MAX_HP, MAX_HP)
  }

  takeDamage(amount: number) {
    if (this.isInvulnerable) return
    this.hp = Math.max(0, this.hp - amount)
    this.hitFlashTimer = 80
    this.graphic.setTint(0xffffff).setTintMode(TintModes.FILL)
    useGameStore.getState().setBossHp(this.hp)
    if (this.isPhase2) this.graphic.setTint(TINT_P2)
  }

  update(targetX: number, targetY: number, delta: number) {
    const dt = delta / 1000
    const dx = targetX - this.x
    const dy = targetY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Move (slower while shielded)
    const spd = SPEED * (this.isPhase2 ? 1.4 : 1) * (this.isInvulnerable ? 0.35 : 1)
    if (dist > 1) {
      this.x += (dx / dist) * spd * dt
      this.y += (dy / dist) * spd * dt
    }
    this.graphic.setPosition(this.x, this.y)
    this.shield.setPosition(0, 0)
    const dir = getDirection(dx, dy)
    this.lastDir = playDir(this.graphic, 'boss', dir, this.lastDir, dist > 1)

    // Hit flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta
      if (this.hitFlashTimer <= 0) {
        this.graphic.clearTint()
        this.graphic.setTint(this.isPhase2 ? TINT_P2 : TINT_NORMAL)
      }
    }

    // Invulnerability cycle
    if (this.isInvulnerable) {
      this.invulnRemaining -= delta
      this.drawShield(this.invulnRemaining / INVULN_DURATION)
      if (this.invulnRemaining <= 0) {
        this.isInvulnerable = false
        this.invulnCountdown = INVULN_INTERVAL
        this.graphic.setAlpha(1)
        this.shield.clear()
        this.graphic.setTint(this.isPhase2 ? TINT_P2 : TINT_NORMAL)
      }
    } else {
      this.shield.clear()
      this.invulnCountdown -= delta
      if (this.invulnCountdown <= 0) {
        this.activateShield()
      }
    }

    // Periodic minion summon
    this.summonTimer -= delta
    const interval = this.isPhase2 ? SUMMON_INTERVAL_P2 : SUMMON_INTERVAL_P1
    if (this.summonTimer <= 0) {
      this.summonTimer = interval
      this.callMinions(this.isPhase2 ? SUMMON_COUNT_P2 : SUMMON_COUNT_P1)
    }
  }

  private activateShield() {
    this.isInvulnerable = true
    this.invulnRemaining = INVULN_DURATION
    // Summon a burst of minions when the shield goes up
    const count = this.isPhase2 ? SUMMON_COUNT_P2 : SUMMON_COUNT_P1
    this.callMinions(count)
    // Reset the regular summon timer so it doesn't stack with the shield summon
    this.summonTimer = (this.isPhase2 ? SUMMON_INTERVAL_P2 : SUMMON_INTERVAL_P1)
  }

  private callMinions(count: number) {
    this.onSummon?.(this.x, this.y, count, this.isPhase2)
    // Pulse graphic to signal summon
    this.scene.tweens.add({
      targets: this.graphic,
      scaleX: 1.6 * 1.35,
      scaleY: 1.6 * 1.35,
      duration: 180,
      yoyo: true,
      ease: 'Power2',
    })
  }

  private drawShield(_t: number) {
    const pulse = 0.65 + Math.sin(Date.now() / 180) * 0.35
    const r = 52 + pulse * 10
    this.shield.clear()
    this.shield.lineStyle(4, 0xffdd00, 0.85 * pulse)
    this.shield.strokeCircle(this.x, this.y, r)
    this.shield.fillStyle(0xffdd00, 0.12 * pulse)
    this.shield.fillCircle(this.x, this.y, r)
    // Fade the boss slightly while shielded
    this.graphic.setAlpha(0.65 + pulse * 0.2)
  }

  getProjectiles() { return [] }

  destroy() {
    this.active = false
    useGameStore.getState().setBossHp(null)
    this.shield.destroy()
    this.graphic.anims.stop()
    this.graphic.clearTint()
    this.scene.tweens.add({
      targets: this.graphic,
      scaleX: 3.5,
      scaleY: 3.5,
      alpha: 0,
      angle: 360,
      duration: 900,
      ease: 'Power2',
      onComplete: () => this.graphic.destroy(),
    })
  }
}
