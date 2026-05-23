import Phaser, { TintModes } from 'phaser'
import type { AnyEnemy, EnemyBullet } from './Enemy'
import type { EnemySnapshot, EnemyKind } from '../net/protocol'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { difficultyScale } from './difficultyScale'

class BossProjectile implements EnemyBullet {
  x: number
  y: number
  active = true
  private graphic: Phaser.GameObjects.Image
  private vx: number
  private vy: number
  private age = 0
  private maxAge: number

  constructor(scene: Phaser.Scene, x: number, y: number, vx: number, vy: number, kind: EnemyKind) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    const isFinal = kind === 'finalBoss'
    this.maxAge = isFinal ? 5000 : 4000
    this.graphic = scene.add.image(x, y, 'enemy_bullet')
      .setRotation(Math.atan2(vy, vx))
      .setTint(isFinal ? 0xcc00ff : 0xff6600)
      .setScale(isFinal ? 2.5 : 2.0)
      .setDepth(3)
  }

  update(delta: number) {
    this.age += delta
    if (this.age > this.maxAge) { this.destroy(); return }
    const dt = delta / 1000
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.graphic.setPosition(this.x, this.y)
  }

  destroy() { this.graphic.destroy(); this.active = false }
}

const KIND_TO_SPRITE: Record<EnemyKind, string> = {
  basic:       'enemy_basic',
  speeder:     'enemy_speeder',
  tank:        'enemy_tank',
  ranged:      'enemy_ranged',
  exploder:    'enemy_exploder',
  ghost:       'enemy_ghost',
  charger:     'enemy_charger',
  necromancer: 'enemy_necromancer',
  veteran:     'enemy_veteran',
  brute:       'enemy_brute',
  revenant:    'enemy_revenant',
  warlord:     'enemy_warlord',
  titan:       'enemy_titan',
  summoner:    'boss',
  boss:        'boss',
  finalBoss:   'boss',
}

const KIND_SCALE: Record<EnemyKind, number> = {
  basic: 1.2, speeder: 0.9, tank: 1.8, ranged: 1.2,
  exploder: 1.1, ghost: 0.9, charger: 1.3, necromancer: 1.1,
  veteran: 1.3, brute: 2.1, revenant: 1.0, warlord: 1.5, titan: 2.8,
  summoner: 1.6, boss: 1.5, finalBoss: 1.8,
}

const KIND_CONTACT_DAMAGE: Record<EnemyKind, number> = {
  basic: 10, speeder: 8, tank: 20, ranged: 10,
  exploder: 0, ghost: 12, charger: 12, necromancer: 10,
  veteran: 14, brute: 25, revenant: 15, warlord: 18, titan: 35,
  summoner: 35, boss: 40, finalBoss: 60,
}

const KIND_XP: Record<EnemyKind, number> = {
  basic: 2, speeder: 1, tank: 6, ranged: 4,
  exploder: 4, ghost: 2, charger: 5, necromancer: 5,
  veteran: 3, brute: 8, revenant: 10, warlord: 12, titan: 15,
  summoner: 150, boss: 80, finalBoss: 200,
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
  private projectiles: BossProjectile[] = []

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
    this.isBoss = snap.kind === 'boss' || snap.kind === 'finalBoss' || snap.kind === 'summoner'

    this.spriteKey = KIND_TO_SPRITE[snap.kind]
    const scale = KIND_SCALE[snap.kind]
    this.sprite = scene.add.sprite(snap.x, snap.y, this.spriteKey)
      .setDepth(this.isBoss ? 3 : 2)
      .setScale(scale)
    this.sprite.play(`${this.spriteKey}_down`)
    if (snap.kind === 'finalBoss') this.sprite.setTint(0xff88ff)
    if (snap.kind === 'summoner')  this.sprite.setTint(0x33dd77)
  }

  applySnapshot(snap: EnemySnapshot) {
    this.prevX = this.x
    this.prevY = this.y
    this.x = snap.x
    this.y = snap.y
    this.hp = snap.hp
    this.sprite.setPosition(snap.x, snap.y)
    // Rescale contact damage every tick so it matches the server difficulty curve
    if (this.kind === 'charger') {
      this.contactDamage = Math.round((snap.isCharging ? 30 : 12) * difficultyScale.damage)
    } else {
      this.contactDamage = Math.round(KIND_CONTACT_DAMAGE[this.kind] * difficultyScale.damage)
    }

    const dx = snap.x - this.prevX
    const dy = snap.y - this.prevY
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      const dir = getDirection(dx, dy)
      this.lastDir = playDir(this.sprite, this.spriteKey, dir, this.lastDir, true)
    }
  }

  // AnyEnemy interface — server is authoritative for HP; client shows hit flash only
  takeDamage(_amount: number) {
    this.hitFlashTimer = 80
    this.sprite.setTint(0xff4444)
  }

  update(_tx: number, _ty: number, delta: number) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta
      if (this.hitFlashTimer <= 0) this.sprite.clearTint()
    }
    for (const p of this.projectiles) p.update(delta)
    this.projectiles = this.projectiles.filter(p => p.active)
  }

  addProjectile(x: number, y: number, vx: number, vy: number) {
    if (!this.active || !this.sprite.scene) return
    this.projectiles.push(new BossProjectile(this.sprite.scene, x, y, vx, vy, this.kind))
  }

  getProjectiles(): BossProjectile[] {
    return this.projectiles
  }

  destroy() {
    this.active = false
    for (const p of this.projectiles) p.destroy()
    this.projectiles = []
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
