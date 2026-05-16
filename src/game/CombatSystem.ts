import Phaser from 'phaser'
import type { AnyEnemy } from './Enemy'
import type { ClientEnemy } from './ClientEnemy'
import { Projectile } from './Projectile'
import { XPOrb } from './XPOrb'
import { CoinOrb } from './CoinOrb'
import { PassiveItem, ALL_ITEM_TYPES } from './PassiveItem'
import { EffectsSystem } from './EffectsSystem'
import { useGameStore, weaponBaseDamage } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'
import { soundSystem } from './SoundSystem'
import { activeNetClient } from '../net/netState'

const HIT_RADIUS = 20
const CONTACT_RADIUS = 28
const BULLET_HIT_RADIUS = 15

export class CombatSystem {
  private scene: Phaser.Scene
  private effects: EffectsSystem
  private projectiles: Projectile[] = []
  private orbs: XPOrb[] = []
  private coins: CoinOrb[] = []
  private passiveItems: PassiveItem[] = []
  private fireTimer = 0
  private auraTimer = 0
  private auraAngle = 0
  private auraFlashTimer = -1
  private auraGraphic: Phaser.GameObjects.Graphics
  private orbAngle = 0
  private orbGraphic: Phaser.GameObjects.Graphics
  private orbHitCooldowns = new Map<AnyEnemy, number>()

  constructor(scene: Phaser.Scene, effects: EffectsSystem) {
    this.scene = scene
    this.effects = effects
    this.auraGraphic = scene.add.graphics().setDepth(2)
    this.orbGraphic = scene.add.graphics().setDepth(5)
  }

  update(playerX: number, playerY: number, enemies: AnyEnemy[], delta: number) {
    const { might, level, attackInterval, addXP, takeDamage, addSessionCoins, piercing, aura, orbital, lifeDrain } = useGameStore.getState()
    const damage = Math.floor(weaponBaseDamage(level) * might)

    const { activeProfileId, profiles } = useProfileStore.getState()
    const activeProfile = profiles.find(p => p.id === activeProfileId)
    const luckRank = activeProfile?.upgrades.luck ?? 0
    const magnetRank = activeProfile?.upgrades.magnet ?? 0
    const coinDropChance = 0.05 + luckRank * 0.01

    // Auto-fire toward nearest enemy
    this.fireTimer += delta
    if (this.fireTimer >= attackInterval) {
      this.fireTimer = 0
      const target = this.findNearest(playerX, playerY, enemies)
      if (target) {
        const { multiShot, piercing: isPiercing } = useGameStore.getState()
        const baseAngle = Math.atan2(target.y - playerY, target.x - playerX)
        const spreadRad = 15 * (Math.PI / 180)
        for (let i = 0; i <= multiShot; i++) {
          const side = i % 2 === 1 ? 1 : -1
          const offset = i === 0 ? 0 : Math.ceil(i / 2) * side * spreadRad
          const angle = baseAngle + offset
          const tx = playerX + Math.cos(angle) * 1000
          const ty = playerY + Math.sin(angle) * 1000
          const proj = new Projectile(this.scene, playerX, playerY, tx, ty)
          proj.piercing = isPiercing
          this.projectiles.push(proj)
        }
        soundSystem.shoot()
      }
    }

    // Move player projectiles + check enemy hits
    for (const p of this.projectiles) {
      if (!p.active) continue
      p.update(delta)
      if (!p.active) continue

      for (const e of enemies) {
        if (!e.active || p.hitTargets.has(e)) continue
        const dx = p.x - e.x
        const dy = p.y - e.y
        if (dx * dx + dy * dy < HIT_RADIUS * HIT_RADIUS) {
          this.applyHit(e, damage, coinDropChance, lifeDrain)
          if (p.piercing) {
            p.hitTargets.add(e)
          } else {
            p.destroy()
            break
          }
        }
      }
    }

    // Collect XP orbs
    let xpGained = 0
    for (const orb of this.orbs) {
      if (!orb.active) continue
      const collected = orb.update(playerX, playerY, delta)
      if (collected > 0) {
        this.effects.showXPCollect(orb.x, orb.y)
        soundSystem.xpCollect()
        xpGained += collected
      }
    }
    if (xpGained > 0) addXP(xpGained)

    // Collect coins
    let coinsGained = 0
    for (const coin of this.coins) {
      if (!coin.active) continue
      if (coin.update(playerX, playerY, delta, magnetRank)) {
        soundSystem.coinCollect()
        coinsGained++
      }
    }
    if (coinsGained > 0) addSessionCoins(coinsGained)

    // Collect passive items
    for (const item of this.passiveItems) {
      if (!item.active) continue
      if (item.update(playerX, playerY, delta)) {
        this.effects.showItemCollect(item.x, item.y, item.getLabel(), item.getColor())
      }
    }
    this.passiveItems = this.passiveItems.filter(i => i.active)

    // Enemy contact damage
    for (const e of enemies) {
      if (!e.active) continue
      const dx = e.x - playerX
      const dy = e.y - playerY
      if (dx * dx + dy * dy < CONTACT_RADIUS * CONTACT_RADIUS) {
        takeDamage(e.contactDamage)
        break
      }
    }

    // Enemy projectile → player collision
    for (const e of enemies) {
      if (!e.active) continue
      const bullets = e.getProjectiles?.() ?? []
      for (const b of bullets) {
        if (!b.active) continue
        const dx = b.x - playerX
        const dy = b.y - playerY
        if (dx * dx + dy * dy < BULLET_HIT_RADIUS * BULLET_HIT_RADIUS) {
          takeDamage(20)
          b.destroy()
          this.effects.shakeCamera()
        }
      }
    }

    this.projectiles = this.projectiles.filter(p => p.active)
    this.orbs = this.orbs.filter(o => o.active)
    this.coins = this.coins.filter(c => c.active)

    // Aura
    this.auraGraphic.clear()
    if (aura > 0) {
      const radius = 60 + aura * 30
      this.auraAngle += delta * 0.0015

      // Faint inner fill
      this.auraGraphic.fillStyle(0x5511cc, 0.07)
      this.auraGraphic.fillCircle(playerX, playerY, radius)

      // Outer rotating arc segments
      const numArcs = 3 + aura
      const arcLen = (Math.PI * 2 / numArcs) * 0.65
      for (let i = 0; i < numArcs; i++) {
        const start = this.auraAngle + (i / numArcs) * Math.PI * 2
        this.auraGraphic.lineStyle(2, 0xbb66ff, 0.9)
        this.auraGraphic.beginPath()
        this.auraGraphic.arc(playerX, playerY, radius, start, start + arcLen, false)
        this.auraGraphic.strokePath()
      }

      // Inner counter-rotating arcs
      const innerR = radius * 0.55
      for (let i = 0; i < 2; i++) {
        const start = -this.auraAngle * 1.8 + i * Math.PI
        this.auraGraphic.lineStyle(1, 0xdd99ff, 0.35)
        this.auraGraphic.beginPath()
        this.auraGraphic.arc(playerX, playerY, innerR, start, start + Math.PI * 0.6, false)
        this.auraGraphic.strokePath()
      }

      // Damage tick
      this.auraTimer += delta
      if (this.auraTimer >= 800) {
        this.auraTimer = 0
        this.auraFlashTimer = 0
        const auraDmg = damage * aura
        for (const e of enemies) {
          if (!e.active) continue
          const dx = e.x - playerX
          const dy = e.y - playerY
          if (dx * dx + dy * dy < radius * radius) {
            this.applyHit(e, auraDmg, coinDropChance, lifeDrain)
          }
        }
      }

      // Expanding shockwave on damage tick
      if (this.auraFlashTimer >= 0) {
        this.auraFlashTimer += delta
        const t = Math.min(this.auraFlashTimer / 300, 1)
        if (t >= 1) {
          this.auraFlashTimer = -1
        } else {
          const ease = 1 - (1 - t) * (1 - t)
          this.auraGraphic.lineStyle(3, 0xeeccff, (1 - t) * 0.95)
          this.auraGraphic.strokeCircle(playerX, playerY, radius + ease * radius * 0.35)
          this.auraGraphic.fillStyle(0xaa55ff, (1 - t) * 0.18)
          this.auraGraphic.fillCircle(playerX, playerY, radius)
        }
      }
    }

    // Spirit Orbs
    this.orbGraphic.clear()
    if (orbital > 0) {
      const ORBIT_RADIUS = 85
      const ORB_RADIUS = 9
      const ORB_HIT_RADIUS = 16
      const HIT_COOLDOWN = 500
      const orbDamage = Math.max(1, Math.floor(weaponBaseDamage(level) * might * 0.65))

      this.orbAngle += delta * 0.0018

      const now = Date.now()
      for (let i = 0; i < orbital; i++) {
        const angle = this.orbAngle + (i / orbital) * Math.PI * 2
        const ox = playerX + Math.cos(angle) * ORBIT_RADIUS
        const oy = playerY + Math.sin(angle) * ORBIT_RADIUS

        // Glow ring
        this.orbGraphic.fillStyle(0x8833ff, 0.18)
        this.orbGraphic.fillCircle(ox, oy, ORB_RADIUS + 6)
        // Core
        this.orbGraphic.fillStyle(0xcc88ff, 1)
        this.orbGraphic.fillCircle(ox, oy, ORB_RADIUS)
        // Inner bright
        this.orbGraphic.fillStyle(0xeeddff, 1)
        this.orbGraphic.fillCircle(ox, oy, ORB_RADIUS * 0.5)
        // Highlight
        this.orbGraphic.fillStyle(0xffffff, 0.85)
        this.orbGraphic.fillCircle(ox - 3, oy - 3, 3)

        for (const e of enemies) {
          if (!e.active) continue
          const dx = e.x - ox
          const dy = e.y - oy
          if (dx * dx + dy * dy < ORB_HIT_RADIUS * ORB_HIT_RADIUS) {
            const lastHit = this.orbHitCooldowns.get(e) ?? 0
            if (now - lastHit >= HIT_COOLDOWN) {
              this.orbHitCooldowns.set(e, now)
              this.applyHit(e, orbDamage, coinDropChance, lifeDrain)
            }
          }
        }
      }

      // Prune dead enemies from cooldown map
      for (const [e] of this.orbHitCooldowns) {
        if (!e.active) this.orbHitCooldowns.delete(e)
      }
    }
  }

  private applyHit(e: AnyEnemy, damage: number, coinDropChance: number, lifeDrain: number) {
    const net = activeNetClient
    this.effects.showDamageNumber(e.x, e.y, this.jitter(damage))
    soundSystem.enemyHit()
    if (net && 'serverId' in e) {
      // Multiplayer: report hit to server, server decides outcome
      net.send({ type: 'hit', enemyId: (e as ClientEnemy).serverId, damage })
      e.takeDamage(damage)  // visual flash only
    } else {
      e.takeDamage(damage)
      if (e.hp <= 0) this.killEnemy(e, coinDropChance, lifeDrain)
    }
  }

  private killEnemy(e: AnyEnemy, coinDropChance: number, lifeDrain: number) {
    if (lifeDrain > 0) {
      useGameStore.setState(s => ({ hp: Math.min(s.maxHp, s.hp + lifeDrain) }))
    }
    this.effects.showDeathBurst(e.x, e.y)
    if (e.isBoss) soundSystem.bossDie()
    else soundSystem.enemyDie()
    this.spawnDrops(e, coinDropChance)
    e.destroy()
  }

  private jitter(dmg: number): number {
    return Math.max(1, dmg + Math.floor(Math.random() * 11) - 5)
  }

  private randomItemType() {
    return ALL_ITEM_TYPES[Math.floor(Math.random() * ALL_ITEM_TYPES.length)]
  }

  private spawnDrops(e: AnyEnemy, coinDropChance: number) {
    this.orbs.push(new XPOrb(this.scene, e.x, e.y, e.xpValue))
    if (e.isBoss) {
      const count = 4 + Math.floor(Math.random() * 5)
      for (let i = 0; i < count; i++) {
        const ox = e.x + (Math.random() - 0.5) * 80
        const oy = e.y + (Math.random() - 0.5) * 80
        this.coins.push(new CoinOrb(this.scene, ox, oy))
      }
      // Boss always drops a passive item
      this.passiveItems.push(new PassiveItem(this.scene, e.x, e.y, this.randomItemType()))
    } else {
      if (Math.random() < coinDropChance) {
        this.coins.push(new CoinOrb(this.scene, e.x, e.y))
      }
      // 3% chance for a passive item drop
      if (Math.random() < 0.03) {
        this.passiveItems.push(new PassiveItem(this.scene, e.x, e.y, this.randomItemType()))
      }
    }
  }

  private findNearest(px: number, py: number, enemies: AnyEnemy[]): AnyEnemy | null {
    let nearest: AnyEnemy | null = null
    let minDist = Infinity
    for (const e of enemies) {
      if (!e.active) continue
      const dx = e.x - px
      const dy = e.y - py
      const dist = dx * dx + dy * dy
      if (dist < minDist) { minDist = dist; nearest = e }
    }
    return nearest
  }
}
