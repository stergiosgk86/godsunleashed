import Phaser, { TintModes } from 'phaser'
import type { AnyEnemy } from './Enemy'
import type { EnemySnapshot, EnemyKind } from '../net/protocol'
import { type Direction, getDirection, playDir } from './spriteUtils'

const KIND_TO_SPRITE: Record<EnemyKind, string> = {
  basic:     'enemy_basic',
  speeder:   'enemy_speeder',
  tank:      'enemy_tank',
  ranged:    'enemy_ranged',
  exploder:  'enemy_exploder',
  boss:      'boss',
  finalBoss: 'boss',
}

const KIND_SCALE: Record<EnemyKind, number> = {
  basic: 1.2, speeder: 0.9, tank: 1.8, ranged: 1.2,
  exploder: 1.1, boss: 1.5, finalBoss: 1.8,
}

const KIND_CONTACT_DAMAGE: Record<EnemyKind, number> = {
  basic: 15, speeder: 10, tank: 30, ranged: 10,
  exploder: 0, boss: 40, finalBoss: 60,
}

const KIND_XP: Record<EnemyKind, number> = {
  basic: 1, speeder: 1, tank: 3, ranged: 2,
  exploder: 2, boss: 80, finalBoss: 200,
}

export class ClientEnemy implements AnyEnemy {
  readonly serverId: number
  readonly kind: EnemyKind
  x: number
  y: number
  hp: number
  active = true
  contactDamage: number
  xpValue: number
  isBoss: boolean

  private sprite: Phaser.GameObjects.Sprite
  private spriteKey: string
  private lastDir: Direction = 'down'
  private hitFlashTimer = 0
  private prevX: number
  private prevY: number

  constructor(scene: Phaser.Scene, snap: EnemySnapshot) {
    this.serverId = snap.id
    this.kind = snap.kind
    this.x = snap.x
    this.y = snap.y
    this.prevX = snap.x
    this.prevY = snap.y
    this.hp = snap.hp
    this.contactDamage = KIND_CONTACT_DAMAGE[snap.kind]
    this.xpValue = KIND_XP[snap.kind]
    this.isBoss = snap.kind === 'boss' || snap.kind === 'finalBoss'

    this.spriteKey = KIND_TO_SPRITE[snap.kind]
    const scale = KIND_SCALE[snap.kind]
    this.sprite = scene.add.sprite(snap.x, snap.y, this.spriteKey)
      .setDepth(this.isBoss ? 3 : 2)
      .setScale(scale)
    this.sprite.play(`${this.spriteKey}_down`)
    if (snap.kind === 'finalBoss') this.sprite.setTint(0xff88ff)
  }

  applySnapshot(snap: EnemySnapshot) {
    this.prevX = this.x
    this.prevY = this.y
    this.x = snap.x
    this.y = snap.y
    this.hp = snap.hp
    this.sprite.setPosition(snap.x, snap.y)

    const dx = snap.x - this.prevX
    const dy = snap.y - this.prevY
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      const dir = getDirection(dx, dy)
      this.lastDir = playDir(this.sprite, this.spriteKey, dir, this.lastDir, true)
    }
  }

  flashHit() {
    this.hitFlashTimer = 80
    this.sprite.setTint(0xffffff).setTintMode(TintModes.FILL)
  }

  tickFlash(delta: number) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta
      if (this.hitFlashTimer <= 0) this.sprite.clearTint()
    }
  }

  // AnyEnemy interface — no-ops in multiplayer (server is authoritative)
  takeDamage(_amount: number) { this.flashHit() }
  update(_tx: number, _ty: number, _delta: number) { this.tickFlash(16) }

  destroy() {
    this.active = false
    const baseScale = KIND_SCALE[this.kind]
    this.sprite.anims.stop()
    this.sprite.setTint(0xff2222).setTintMode(TintModes.FILL)
    const scene = this.sprite.scene
    scene.tweens.add({
      targets: this.sprite,
      scaleX: baseScale * 1.4,
      scaleY: baseScale * 1.4,
      duration: 60,
      ease: 'Power1',
      onComplete: () => {
        scene.tweens.add({
          targets: this.sprite,
          scaleX: 0, scaleY: 0, alpha: 0,
          duration: 280,
          ease: 'Power2In',
          onComplete: () => this.sprite.destroy(),
        })
      },
    })
  }
}
