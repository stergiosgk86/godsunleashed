import Phaser from 'phaser'
import type { AnyEnemy } from './Enemy'
import type { ClientEnemy } from './ClientEnemy'
import { Projectile } from './Projectile'
import { ThunderboltProjectile } from './ThunderboltProjectile'
import { Boomerang } from './Boomerang'
import { Axe } from './Axe'
import { XPOrb } from './XPOrb'
import { CoinOrb } from './CoinOrb'
import { HealthPotion } from './HealthPotion'
import { EffectsSystem } from './EffectsSystem'
import { useGameStore, weaponBaseDamage } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'
import { soundSystem } from './SoundSystem'
import { difficultyScale } from './difficultyScale'
import { activeNetClient } from '../net/netState'
import { minimapData } from './minimapData'

const CONTACT_RADIUS = 28
const CONTACT_ENEMY_COOLDOWN = 1000  // ms between hits from each individual enemy
const BULLET_HIT_RADIUS = 15
const BOOMERANG_INTERVAL = 3000
const AXE_INTERVAL = 3000
const AXE_HIT_R = 20
const AXE_DAMAGE_MULT = 2.5
const BOOMERANG_HIT_R = 22
const FLAME_SPAWN_DIST = 55
const FLAME_RADIUS = 50
const FLAME_DURATION = 3000
const FLAME_TICK = 600
const NOVA_INTERVAL = 7000
const NOVA_RADIUS = 230
const LIGHTNING_INTERVAL = 4000
const LIGHTNING_TARGETS = 2
const LIGHTNING_DAMAGE_MULT = 3.5
const POTION_KILL_THRESHOLD = 100
const POTION_HEAL = 25
const POTION_MAX = 3
const POTION_SPAWN_MIN = 180
const POTION_SPAWN_MAX = 320

interface FlamePool {
  x: number; y: number
  timer: number; tickTimer: number
  graphic: Phaser.GameObjects.Graphics
}

export const VAMPIRIC_PERCENT = 0.0025  // 0.25% lifesteal per hit

export class CombatSystem {
  private scene: Phaser.Scene
  private effects: EffectsSystem
  private projectiles: Projectile[] = []
  private orbs: XPOrb[] = []
  private coins: CoinOrb[] = []
  private potions: HealthPotion[] = []
  private potionKillCounter = 0
  private playerX = 0
  private playerY = 0
  private fireTimer = 0
  private auraTimer = 0
  private auraAngle = 0
  private auraFlashTimer = -1
  private auraGraphic: Phaser.GameObjects.Graphics
  private orbAngle = 0
  private orbCenterX = 0
  private orbCenterY = 0
  private orbCenterInit = false
  private orbGraphic: Phaser.GameObjects.Graphics
  private orbHitCooldowns = new Map<AnyEnemy, number>()
  private contactCooldowns = new Map<AnyEnemy, number>()
  private vampiricPool = 0
  // Boomerang
  private boomerangs: Boomerang[] = []
  private boomerangTimer = 0
  // Axe
  private axes: Axe[] = []
  private axeTimer = 0
  private axeDir = 1
  // Flame Trail
  private flamePools: FlamePool[] = []
  private lastFlameX = -1
  private lastFlameY = -1
  private flameTime = 0
  // Blood Nova
  private bloodNovaTimer = 0
  // Lightning
  private lightningTimer = 0
  private useThunderbolts: boolean
  private frontArcOnly: boolean
  private facingVx = 0
  private facingVy = 1
  private swingSide = 1   // alternates -1 / +1 for whip crescent direction
  private arcGraphic: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, effects: EffectsSystem, useThunderbolts = false, frontArcOnly = false) {
    this.useThunderbolts = useThunderbolts
    this.frontArcOnly = frontArcOnly
    this.arcGraphic = scene.add.graphics().setDepth(3)
    this.scene = scene
    this.effects = effects
    this.auraGraphic = scene.add.graphics().setDepth(2)
    this.orbGraphic = scene.add.graphics().setDepth(5)
  }

  setFacing(vx: number, vy: number) {
    const mag = Math.sqrt(vx * vx + vy * vy)
    if (mag > 0) { this.facingVx = vx / mag; this.facingVy = vy / mag }
  }

  private static readonly SLASH_RANGE = 120

  // Full front hemisphere — dot > 0 means any enemy on the forward side
  private inFrontHemisphere(ex: number, ey: number, px: number, py: number): boolean {
    const dx = ex - px, dy = ey - py
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    return (dx / dist) * this.facingVx + (dy / dist) * this.facingVy > 0
  }

  private fireSwordSwing(px: number, py: number, damage: number, enemies: AnyEnemy[], coinDropChance: number, lifeDrain: number, vampiric: boolean) {
    const r2 = CombatSystem.SLASH_RANGE * CombatSystem.SLASH_RANGE
    let hit = false
    for (const e of enemies) {
      if (!e.active) continue
      const dx = e.x - px, dy = e.y - py
      if (dx * dx + dy * dy > r2) continue
      if (!this.inFrontHemisphere(e.x, e.y, px, py)) continue
      this.applyHit(e, damage, coinDropChance, lifeDrain, vampiric)
      hit = true
    }
    if (hit) soundSystem.enemyHit()
    this.showWhipEffect(px, py, this.swingSide)
    this.swingSide *= -1
  }

  private showWhipEffect(px: number, py: number, side: number) {
    const g = this.scene.add.graphics().setDepth(6)
    const baseAngle = Math.atan2(this.facingVy, this.facingVx)
    const R = CombatSystem.SLASH_RANGE
    const perpBase = baseAngle + side * Math.PI / 2
    const halfSpan = Math.PI * 0.55   // ~100° each side → 200° total crescent
    const innerR = R * 0.25
    const steps = 28

    const draw = (progress: number, alpha: number) => {
      g.clear()
      const outerR = R * progress
      if (progress < 0.05) return

      // Faint crescent fill
      g.fillStyle(0xfff0b4, alpha * 0.08)
      g.beginPath()
      for (let i = 0; i <= steps; i++) {
        const a = perpBase - halfSpan + (i / steps) * halfSpan * 2
        if (i === 0) g.moveTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
        else g.lineTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
      }
      for (let i = steps; i >= 0; i--) {
        const a = perpBase - halfSpan + (i / steps) * halfSpan * 2
        g.lineTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
      }
      g.fillPath()

      // Outer glow
      g.lineStyle(9, 0xfff0b4, alpha * 0.15)
      g.beginPath()
      for (let i = 0; i <= steps; i++) {
        const a = perpBase - halfSpan + (i / steps) * halfSpan * 2
        if (i === 0) g.moveTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
        else g.lineTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
      }
      g.strokePath()

      // Bright outer arc edge
      g.lineStyle(2, 0xffffff, alpha * 0.92)
      g.beginPath()
      for (let i = 0; i <= steps; i++) {
        const a = perpBase - halfSpan + (i / steps) * halfSpan * 2
        if (i === 0) g.moveTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
        else g.lineTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
      }
      g.strokePath()

      // Dim inner arc edge
      g.lineStyle(1.5, 0xffffff, alpha * 0.38)
      g.beginPath()
      for (let i = 0; i <= steps; i++) {
        const a = perpBase - halfSpan + (i / steps) * halfSpan * 2
        if (i === 0) g.moveTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
        else g.lineTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
      }
      g.strokePath()

      // End cap lines connecting inner to outer
      for (const s of [-1, 1] as const) {
        const a = perpBase + s * halfSpan
        g.lineStyle(1.5, 0xffffff, alpha * 0.48)
        g.beginPath()
        g.moveTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
        g.lineTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
        g.strokePath()
      }
    }

    // Phase 1: snap out (70ms)
    const snap = { t: 0 }
    this.scene.tweens.add({
      targets: snap, t: 1, duration: 70, ease: 'Power3.Out',
      onUpdate: () => draw(snap.t, 1),
      onComplete: () => {
        // Phase 2: brief hold then fade (80ms hold + 160ms fade)
        this.scene.time.delayedCall(80, () => {
          const fade = { t: 1 }
          this.scene.tweens.add({
            targets: fade, t: 0, duration: 160, ease: 'Power2.In',
            onUpdate: () => draw(1, fade.t),
            onComplete: () => g.destroy(),
          })
        })
      },
    })
  }

  private drawSwordIndicator(px: number, py: number) {
    this.arcGraphic.clear()
    if (!this.frontArcOnly) return
    const R = CombatSystem.SLASH_RANGE
    const baseAngle = Math.atan2(this.facingVy, this.facingVx)
    const halfSpan = Math.PI * 0.55
    const innerR = R * 0.25
    const steps = 20

    // Draw faint crescent outline for each side
    for (const side of [-1, 1]) {
      const perpBase = baseAngle + side * Math.PI / 2
      this.arcGraphic.lineStyle(1, 0xffffff, 0.12)
      this.arcGraphic.beginPath()
      for (let i = 0; i <= steps; i++) {
        const a = perpBase - halfSpan + (i / steps) * halfSpan * 2
        if (i === 0) this.arcGraphic.moveTo(px + Math.cos(a) * R, py + Math.sin(a) * R)
        else this.arcGraphic.lineTo(px + Math.cos(a) * R, py + Math.sin(a) * R)
      }
      this.arcGraphic.strokePath()
      this.arcGraphic.lineStyle(1, 0xffffff, 0.06)
      this.arcGraphic.beginPath()
      for (let i = 0; i <= steps; i++) {
        const a = perpBase - halfSpan + (i / steps) * halfSpan * 2
        if (i === 0) this.arcGraphic.moveTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
        else this.arcGraphic.lineTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
      }
      this.arcGraphic.strokePath()
    }
  }

  update(playerX: number, playerY: number, enemies: AnyEnemy[], delta: number) {
    this.playerX = playerX
    this.playerY = playerY
    const { might, level, attackInterval, addXP, takeDamage, takeContactDamage, addSessionCoins, aura, auraTick, orbital, lifeDrain, boomerang, flameTrail, bloodNova, vampiric, lightning, axe } = useGameStore.getState()
    const damage = Math.floor(weaponBaseDamage(level) * might)

    const { upgrades } = useProfileStore.getState()
    const luckRank = upgrades.luck
    const magnetRank = upgrades.magnet
    const growthRank = upgrades.growth
    const coinDropChance = 0.02 + luckRank * 0.01

    this.drawSwordIndicator(playerX, playerY)

    // Auto-fire / melee sweep
    const net = activeNetClient
    this.fireTimer += delta
    if (this.fireTimer >= attackInterval) {
      this.fireTimer = 0
      if (this.frontArcOnly) {
        // Ares: melee arc sweep — no projectile, direct damage in front cone
        this.fireSwordSwing(playerX, playerY, damage, enemies, coinDropChance, lifeDrain, vampiric)
      } else {
        const target = this.findNearest(playerX, playerY, enemies, 600)
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
            const proj = this.useThunderbolts
              ? new ThunderboltProjectile(this.scene, playerX, playerY, tx, ty)
              : new Projectile(this.scene, playerX, playerY, tx, ty)
            proj.piercing = isPiercing
            this.projectiles.push(proj)
            if (net) net.send({ type: 'projectile', x: playerX, y: playerY, vx: proj.vx, vy: proj.vy })
          }
          soundSystem.shoot()
        }
      }
    }

    // Move player projectiles + check enemy hits
    const camWV = this.scene.cameras.main.worldView
    const PROJ_OFF_MARGIN = 200  // keep alive this many px past the screen edge so projectiles can reach enemies spawned just off-screen
    for (const p of this.projectiles) {
      if (!p.active) continue
      p.update(delta)
      if (!p.active) continue

      if (p.x < camWV.left  - PROJ_OFF_MARGIN || p.x > camWV.right  + PROJ_OFF_MARGIN ||
          p.y < camWV.top   - PROJ_OFF_MARGIN || p.y > camWV.bottom + PROJ_OFF_MARGIN) {
        p.destroy()
        continue
      }

      for (const e of enemies) {
        if (!e.active || p.hitTargets.has(e)) continue
        const dx = p.x - e.x
        const dy = p.y - e.y
        if (dx * dx + dy * dy < p.hitRadius * p.hitRadius) {
          this.applyHit(e, damage, coinDropChance, lifeDrain, vampiric)
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
    if (xpGained > 0) addXP(Math.round(xpGained * (1 + growthRank * 0.03) * difficultyScale.xp))

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

    // Collect health potions
    for (const pot of this.potions) {
      if (!pot.active) continue
      if (pot.update(playerX, playerY, delta)) {
        const { healPlayer } = useGameStore.getState()
        healPlayer(POTION_HEAL)
        soundSystem.healCollect()
        this.effects.showItemCollect(playerX, playerY, `+${POTION_HEAL} HP`, 0x44ff66, 20)
      }
    }
    this.potions = this.potions.filter(p => p.active)

    // Enemy contact damage — per-enemy cooldown so hordes deal proportional damage
    {
      const now = Date.now()
      for (const e of enemies) {
        if (!e.active) continue
        const dx = e.x - playerX
        const dy = e.y - playerY
        if (dx * dx + dy * dy < CONTACT_RADIUS * CONTACT_RADIUS) {
          const last = this.contactCooldowns.get(e) ?? 0
          if (now - last >= CONTACT_ENEMY_COOLDOWN) {
            this.contactCooldowns.set(e, now)
            takeContactDamage(e.contactDamage)
          }
        }
      }
      for (const [e] of this.contactCooldowns) {
        if (!e.active) this.contactCooldowns.delete(e)
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
          takeDamage(Math.round(20 * difficultyScale.damage))
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

      // Damage tick
      this.auraTimer += delta
      if (this.auraTimer >= 1500 - auraTick * 250) {
        this.auraTimer = 0
        this.auraFlashTimer = 0
        const auraDmg = damage * aura
        for (const e of enemies) {
          if (!e.active || !this.isOnScreen(e.x, e.y)) continue
          const dx = e.x - playerX
          const dy = e.y - playerY
          if (dx * dx + dy * dy < radius * radius) {
            this.applyHit(e, auraDmg, coinDropChance, lifeDrain, vampiric)
          }
        }
      }

      // All visuals only during the flash window (500ms after each damage tick)
      if (this.auraFlashTimer >= 0) {
        this.auraFlashTimer += delta
        const t = Math.min(this.auraFlashTimer / 500, 1)
        if (t >= 1) {
          this.auraFlashTimer = -1
        } else {
          const fade = 1 - t
          const ease = 1 - (1 - t) * (1 - t)

          // Layered glow fills
          this.auraGraphic.fillStyle(0x2200aa, 0.10 * fade)
          this.auraGraphic.fillCircle(playerX, playerY, radius * 1.15)
          this.auraGraphic.fillStyle(0x4411cc, 0.15 * fade)
          this.auraGraphic.fillCircle(playerX, playerY, radius)
          this.auraGraphic.fillStyle(0x6622ee, 0.18 * fade)
          this.auraGraphic.fillCircle(playerX, playerY, radius * 0.7)
          this.auraGraphic.fillStyle(0x8833ff, 0.20 * fade)
          this.auraGraphic.fillCircle(playerX, playerY, radius * 0.42)

          // Outer ring
          this.auraGraphic.lineStyle(5, 0x9944ff, 0.6 * fade)
          this.auraGraphic.strokeCircle(playerX, playerY, radius)

          // Rotating arc segments with bright tips
          const numArcs = 3 + aura
          const arcLen = (Math.PI * 2 / numArcs) * 0.55
          for (let i = 0; i < numArcs; i++) {
            const start = this.auraAngle + (i / numArcs) * Math.PI * 2
            this.auraGraphic.lineStyle(2.5, 0xcc77ff, 0.9 * fade)
            this.auraGraphic.beginPath()
            this.auraGraphic.arc(playerX, playerY, radius, start, start + arcLen, false)
            this.auraGraphic.strokePath()
            const tipAngle = start + arcLen
            this.auraGraphic.fillStyle(0xffffff, 0.75 * fade)
            this.auraGraphic.fillCircle(playerX + Math.cos(tipAngle) * radius, playerY + Math.sin(tipAngle) * radius, 2.5)
          }

          // Mid-radius counter-rotating arcs
          const midR = radius * 0.72
          const numMidArcs = 2 + aura
          for (let i = 0; i < numMidArcs; i++) {
            const start = -this.auraAngle * 1.5 + (i / numMidArcs) * Math.PI * 2
            this.auraGraphic.lineStyle(1.5, 0xee99ff, 0.5 * fade)
            this.auraGraphic.beginPath()
            this.auraGraphic.arc(playerX, playerY, midR, start, start + Math.PI * 0.5, false)
            this.auraGraphic.strokePath()
          }

          // Inner fast-rotating arcs
          for (let i = 0; i < 2; i++) {
            const start = this.auraAngle * 2.3 + i * Math.PI
            this.auraGraphic.lineStyle(1, 0xffeeff, 0.38 * fade)
            this.auraGraphic.beginPath()
            this.auraGraphic.arc(playerX, playerY, radius * 0.44, start, start + Math.PI * 0.4, false)
            this.auraGraphic.strokePath()
          }

          // Edge sparks
          const numSparks = 6 + aura * 2
          for (let i = 0; i < numSparks; i++) {
            const sparkAngle = this.auraAngle * 2.1 + (i / numSparks) * Math.PI * 2
            const sparkR = radius + Math.sin(this.auraAngle * 5 + i * 1.3) * 7
            const sx = playerX + Math.cos(sparkAngle) * sparkR
            const sy = playerY + Math.sin(sparkAngle) * sparkR
            this.auraGraphic.fillStyle(0xcc88ff, 0.6 * fade)
            this.auraGraphic.fillCircle(sx, sy, 3)
            this.auraGraphic.fillStyle(0xffffff, 0.85 * fade)
            this.auraGraphic.fillCircle(sx, sy, 1.5)
          }

          // Expanding shockwave
          this.auraGraphic.lineStyle(5, 0xffffff, (1 - t) * 0.75)
          this.auraGraphic.strokeCircle(playerX, playerY, radius + ease * radius * 0.4)
          this.auraGraphic.lineStyle(2, 0xdd99ff, (1 - t) * 0.55)
          this.auraGraphic.strokeCircle(playerX, playerY, radius + ease * radius * 0.22)
          this.auraGraphic.fillStyle(0xbb55ff, (1 - t) * 0.18)
          this.auraGraphic.fillCircle(playerX, playerY, radius)
        }
      }
    }

    // Spirit Orbs
    this.orbGraphic.clear()
    if (orbital > 0) {
      const ORBIT_RADIUS = 115
      const ORB_RADIUS = 13
      const ORB_HIT_RADIUS = 20
      const HIT_COOLDOWN = 500
      const orbDamage = Math.max(1, Math.floor(weaponBaseDamage(level) * might * 0.65))

      this.orbAngle += delta * 0.0018

      // Smooth the orbit center so fast player movement doesn't distort apparent rotation speed
      if (!this.orbCenterInit) { this.orbCenterX = playerX; this.orbCenterY = playerY; this.orbCenterInit = true }
      const lag = 1 - Math.exp(-delta / 90)
      this.orbCenterX += (playerX - this.orbCenterX) * lag
      this.orbCenterY += (playerY - this.orbCenterY) * lag

      const now = Date.now()
      for (let i = 0; i < orbital; i++) {
        const angle = this.orbAngle + (i / orbital) * Math.PI * 2
        const ox = this.orbCenterX + Math.cos(angle) * ORBIT_RADIUS
        const oy = this.orbCenterY + Math.sin(angle) * ORBIT_RADIUS

        // Glow ring
        this.orbGraphic.fillStyle(0x8833ff, 0.18)
        this.orbGraphic.fillCircle(ox, oy, ORB_RADIUS + 8)
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
          const dist2 = dx * dx + dy * dy
          if (dist2 < ORB_HIT_RADIUS * ORB_HIT_RADIUS) {
            const dist = Math.sqrt(dist2) || 1
            e.x += (dx / dist) * 28
            e.y += (dy / dist) * 28
            const lastHit = this.orbHitCooldowns.get(e) ?? 0
            if (now - lastHit >= HIT_COOLDOWN) {
              this.orbHitCooldowns.set(e, now)
              this.applyHit(e, orbDamage, coinDropChance, lifeDrain, vampiric)
            }
          }
        }
      }

      // Prune dead enemies from cooldown map
      for (const [e] of this.orbHitCooldowns) {
        if (!e.active) this.orbHitCooldowns.delete(e)
      }
    }

    // === Boomerang ===
    if (boomerang) {
      this.boomerangTimer += delta
      if (this.boomerangTimer >= BOOMERANG_INTERVAL) {
        this.boomerangTimer = 0
        const target = this.findNearest(playerX, playerY, enemies)
        if (target) {
          this.boomerangs.push(new Boomerang(this.scene, playerX, playerY, target.x, target.y))
          soundSystem.shoot()
        }
      }
      for (const b of this.boomerangs) {
        if (!b.active) continue
        b.update(delta, playerX, playerY)
        if (!b.active) continue
        const hitTargets = b.returning ? b.hitTargetsBack : b.hitTargetsOut
        for (const e of enemies) {
          if (!e.active || hitTargets.has(e)) continue
          const dx = b.x - e.x
          const dy = b.y - e.y
          if (dx * dx + dy * dy < BOOMERANG_HIT_R * BOOMERANG_HIT_R) {
            hitTargets.add(e)
            const bmgDamage = b.returning ? damage : Math.floor(damage * 1.5)
            this.applyHit(e, bmgDamage, coinDropChance, lifeDrain, vampiric)
          }
        }
      }
      this.boomerangs = this.boomerangs.filter(b => b.active)
    }

    // === Flame Trail ===
    if (flameTrail) {
      if (this.lastFlameX < 0) { this.lastFlameX = playerX; this.lastFlameY = playerY }
      const fdx = playerX - this.lastFlameX
      const fdy = playerY - this.lastFlameY
      if (fdx * fdx + fdy * fdy >= FLAME_SPAWN_DIST * FLAME_SPAWN_DIST) {
        this.spawnFlame(playerX, playerY)
        this.lastFlameX = playerX
        this.lastFlameY = playerY
      }
      this.flameTime += delta
      const flameDmg = Math.max(1, Math.floor(weaponBaseDamage(level) * might * 0.4))
      for (const f of this.flamePools) {
        f.timer -= delta
        f.tickTimer -= delta
        f.graphic.setAlpha(0.7 + 0.2 * Math.sin(this.flameTime * 0.007 + f.x * 0.05))
        if (f.tickTimer <= 0) {
          f.tickTimer += FLAME_TICK
          for (const e of enemies) {
            if (!e.active || !this.isOnScreen(e.x, e.y)) continue
            const dx = e.x - f.x
            const dy = e.y - f.y
            if (dx * dx + dy * dy < FLAME_RADIUS * FLAME_RADIUS) {
              this.applyHit(e, flameDmg, coinDropChance, lifeDrain, vampiric)
            }
          }
        }
        if (f.timer <= 0) f.graphic.destroy()
      }
      this.flamePools = this.flamePools.filter(f => f.timer > 0)
    }

    // === Blood Nova ===
    if (bloodNova) {
      this.bloodNovaTimer += delta
      if (this.bloodNovaTimer >= NOVA_INTERVAL) {
        this.bloodNovaTimer = 0
        const novaDmg = Math.floor(weaponBaseDamage(level) * might * 5)
        this.fireBloodNova(playerX, playerY, novaDmg, enemies, coinDropChance, lifeDrain, vampiric)
      }
    }

    // === War Axe ===
    if (axe) {
      this.axeTimer += delta
      if (this.axeTimer >= AXE_INTERVAL) {
        this.axeTimer = 0
        const target = this.findNearest(playerX, playerY, enemies)
        const dirX = target ? Math.sign(target.x - playerX) || this.axeDir : this.axeDir
        this.axeDir = -dirX
        this.axes.push(new Axe(this.scene, playerX, playerY, dirX))
        soundSystem.shoot()
      }
      const axeDamage = Math.floor(weaponBaseDamage(level) * might * AXE_DAMAGE_MULT)
      for (const a of this.axes) {
        if (!a.active) continue
        a.update(delta)
        if (!a.active) continue
        for (const e of enemies) {
          if (!e.active || a.currentHitTargets.has(e)) continue
          const dx = a.x - e.x
          const dy = a.y - e.y
          if (dx * dx + dy * dy < AXE_HIT_R * AXE_HIT_R) {
            a.currentHitTargets.add(e)
            this.applyHit(e, axeDamage, coinDropChance, lifeDrain, vampiric)
          }
        }
      }
      this.axes = this.axes.filter(a => a.active)
    }

    // === Lightning Strike ===
    if (lightning) {
      this.lightningTimer += delta
      if (this.lightningTimer >= LIGHTNING_INTERVAL) {
        this.lightningTimer = 0
        const boltDmg = Math.floor(weaponBaseDamage(level) * might * LIGHTNING_DAMAGE_MULT)
        const cam = this.scene.cameras.main.worldView
        const active = enemies.filter(e => e.active && cam.contains(e.x, e.y))
        // Pick up to LIGHTNING_TARGETS distinct random enemies
        const targets: AnyEnemy[] = []
        const pool = [...active]
        for (let i = 0; i < LIGHTNING_TARGETS && pool.length > 0; i++) {
          const idx = Math.floor(Math.random() * pool.length)
          targets.push(pool.splice(idx, 1)[0])
        }
        for (const t of targets) {
          this.fireLightningBolt(t.x, t.y)
          this.applyHit(t, boltDmg, coinDropChance, lifeDrain, vampiric)
        }
      }
    }
  }

  private spawnFlame(x: number, y: number) {
    const g = this.scene.add.graphics().setDepth(1.5).setPosition(x, y)
    const vr = 30
    g.fillStyle(0xff3300, 0.9)
    g.fillCircle(0, 0, vr)
    g.fillStyle(0xff6600, 0.85)
    g.fillCircle(0, 0, vr * 0.65)
    g.fillStyle(0xffaa00, 0.8)
    g.fillCircle(0, 0, vr * 0.35)
    this.flamePools.push({ x, y, timer: FLAME_DURATION, tickTimer: 0, graphic: g })
  }

  private fireLightningBolt(x: number, y: number) {
    const top = y - 280

    // Build a jagged zigzag path from above down to the target
    const points: { x: number; y: number }[] = [{ x, y: top }]
    const segments = 8
    for (let i = 1; i < segments; i++) {
      const t = i / segments
      const jitter = (1 - t * 0.5) * 50
      points.push({ x: x + (Math.random() - 0.5) * jitter * 2, y: top + (y - top) * t })
    }
    points.push({ x, y })

    const g = this.scene.add.graphics().setDepth(8)

    const draw = (alpha: number) => {
      g.clear()
      // Outer blue-white glow
      g.lineStyle(6, 0x99ccff, alpha * 0.35)
      g.beginPath()
      g.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
      g.strokePath()
      // Mid yellow-white
      g.lineStyle(3, 0xffffaa, alpha * 0.8)
      g.beginPath()
      g.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
      g.strokePath()
      // Bright white core
      g.lineStyle(1.5, 0xffffff, alpha)
      g.beginPath()
      g.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
      g.strokePath()
      // Impact flash at target
      g.fillStyle(0xffffff, alpha * 0.7)
      g.fillCircle(x, y, 16 * alpha)
      g.fillStyle(0xaaddff, alpha * 0.35)
      g.fillCircle(x, y, 28 * alpha)
    }

    draw(1)

    const obj = { alpha: 1 }
    this.scene.tweens.add({
      targets: obj,
      alpha: 0,
      duration: 380,
      ease: 'Power2In',
      onUpdate: () => draw(obj.alpha),
      onComplete: () => g.destroy(),
    })
  }

  private fireBloodNova(playerX: number, playerY: number, damage: number, enemies: AnyEnemy[], coinDropChance: number, lifeDrain: number, vampiric: boolean) {
    const { maxHp } = useGameStore.getState()
    const cost = Math.max(1, Math.floor(maxHp * 0.08))
    useGameStore.setState(s => ({ hp: Math.max(1, s.hp - cost) }))

    for (const e of enemies) {
      if (!e.active || !this.isOnScreen(e.x, e.y)) continue
      const dx = e.x - playerX
      const dy = e.y - playerY
      if (dx * dx + dy * dy < NOVA_RADIUS * NOVA_RADIUS) {
        this.applyHit(e, damage, coinDropChance, lifeDrain, vampiric)
      }
    }

    const g = this.scene.add.graphics().setDepth(6)
    const obj = { t: 0 }
    this.scene.tweens.add({
      targets: obj,
      t: 1,
      duration: 650,
      ease: 'Power2Out',
      onUpdate: () => {
        const t = obj.t
        const r = 30 + (NOVA_RADIUS - 30) * t
        const alpha = 1 - t
        g.clear()
        g.lineStyle(3 + (1 - t) * 9, 0xff1111, alpha)
        g.strokeCircle(playerX, playerY, r)
        g.fillStyle(0xcc0000, alpha * 0.18)
        g.fillCircle(playerX, playerY, r)
      },
      onComplete: () => g.destroy(),
    })
  }

  private applyHit(e: AnyEnemy, damage: number, coinDropChance: number, lifeDrain: number, vampiric: boolean) {
    const net = activeNetClient
    const actual = this.jitter(damage)
    useGameStore.getState().addDamage(actual)
    this.effects.showDamageNumber(e.x, e.y, actual)
    soundSystem.enemyHit()
    if (vampiric) {
      this.vampiricPool += actual * VAMPIRIC_PERCENT
      if (this.vampiricPool >= 1) {
        const heal = Math.floor(this.vampiricPool)
        this.vampiricPool -= heal
        useGameStore.setState(s => ({ hp: Math.min(s.maxHp, s.hp + heal) }))
      }
    }
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
    const { addKill, addBossKill } = useGameStore.getState()
    addKill()
    if (e.isBoss) { soundSystem.bossDie(); addBossKill() }
    else soundSystem.enemyDie()
    this.spawnDrops(e, coinDropChance)
    e.destroy()

    if (!e.isBoss) {
      const luckRank = useProfileStore.getState().upgrades.luck
      const threshold = Math.floor(POTION_KILL_THRESHOLD / (1 + luckRank * 0.12))
      this.potionKillCounter++
      if (this.potionKillCounter >= threshold && this.potions.length < POTION_MAX) {
        this.potionKillCounter = 0
        const angle = Math.random() * Math.PI * 2
        const dist = POTION_SPAWN_MIN + Math.random() * (POTION_SPAWN_MAX - POTION_SPAWN_MIN)
        this.potions.push(new HealthPotion(this.scene, this.playerX + Math.cos(angle) * dist, this.playerY + Math.sin(angle) * dist))
      }
    }
  }

  private jitter(dmg: number): number {
    return Math.max(1, dmg + Math.floor(Math.random() * 5) - 2)
  }

  spawnDropsAt(x: number, y: number, xpValue: number, isBoss: boolean) {
    const luckRank = useProfileStore.getState().upgrades.luck
    const coinDropChance = 0.02 + luckRank * 0.01

    this.orbs.push(new XPOrb(this.scene, x, y, xpValue))
    if (isBoss) {
      const count = 4 + Math.floor(Math.random() * 5)
      for (let i = 0; i < count; i++) {
        this.coins.push(new CoinOrb(this.scene, x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80))
      }
    } else {
      if (Math.random() < coinDropChance) {
        const a = Math.random() * Math.PI * 2
        this.coins.push(new CoinOrb(this.scene, x + Math.cos(a) * 20, y + Math.sin(a) * 20))
      }
    }
  }

  private spawnDrops(e: AnyEnemy, _coinDropChance: number) {
    this.spawnDropsAt(e.x, e.y, e.xpValue, e.isBoss ?? false)
  }

  private isOnScreen(x: number, y: number): boolean {
    const wv = this.scene.cameras.main.worldView
    return x >= wv.left && x <= wv.right && y >= wv.top && y <= wv.bottom
  }

  private findNearest(px: number, py: number, enemies: AnyEnemy[], maxRange = Infinity): AnyEnemy | null {
    const TEAMMATE_CLEAR_R = 60 * 60
    const maxRange2 = maxRange * maxRange
    const remotes = minimapData.remotePlayers
    let nearest: AnyEnemy | null = null
    let minDist = Infinity
    let fallback: AnyEnemy | null = null
    let minFallback = Infinity
    for (const e of enemies) {
      if (!e.active || !this.isOnScreen(e.x, e.y)) continue
      const dx = e.x - px
      const dy = e.y - py
      const dist = dx * dx + dy * dy
      if (dist > maxRange2) continue
      // Prefer enemies not in a teammate's personal space to avoid visual confusion
      const nearTeammate = remotes.some(rp => {
        const rdx = e.x - rp.x, rdy = e.y - rp.y
        return rdx * rdx + rdy * rdy < TEAMMATE_CLEAR_R
      })
      if (nearTeammate) {
        if (dist < minFallback) { minFallback = dist; fallback = e }
      } else {
        if (dist < minDist) { minDist = dist; nearest = e }
      }
    }
    return nearest ?? fallback
  }
}
