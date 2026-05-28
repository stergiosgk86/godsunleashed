import Phaser from 'phaser'
import type { AnyEnemy } from './Enemy'
import type { ClientEnemy } from './ClientEnemy'
import { Projectile } from './Projectile'
import { SunBeam } from './SunBeam'
import { Boomerang } from './Boomerang'
import { Axe } from './Axe'
import { XPOrb } from './XPOrb'
import { CoinOrb } from './CoinOrb'
import { HealthPotion } from './HealthPotion'
import { EffectsSystem } from './EffectsSystem'
import { useGameStore, weaponBaseDamage, getValidatedCombatState } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'
import { soundSystem } from './SoundSystem'
import { difficultyScale } from './difficultyScale'
import { activeNetClient } from '../net/netState'
import { minimapData } from './minimapData'

const CONTACT_RADIUS = 28
const CONTACT_ENEMY_COOLDOWN = 240   // ms — matches VS post-hit immunity window
const BULLET_HIT_RADIUS = 15
const BOOMERANG_INTERVAL = 3000
const AXE_INTERVAL = 4000
const AXE_HIT_R = 20
const AXE_DAMAGE_MULT = 2.5
const BOOMERANG_HIT_R = 28
const FLAME_SPAWN_DIST = 55
const FLAME_RADIUS = 50
const FLAME_DURATION = 3000
const FLAME_TICK = 600
const NOVA_INTERVAL = 90000
const LIGHTNING_INTERVAL = 4500
const LIGHTNING_TARGETS = 2
const LIGHTNING_DAMAGE_MULT = 3.5
const DUAL_GUN_SPEED = 350
const DUAL_GUN_DAMAGE_MULT = 0.6
const DUAL_GUN_BURST_DELAY = 200  // ms between each staggered gun shot (VS: 0.2s)
const POTION_KILL_THRESHOLD = 100
const POTION_HEAL = 25
const POTION_MAX = 3
const POTION_SPAWN_MIN = 180
const POTION_SPAWN_MAX = 320
const DIVINE_ACTIVE_MS  = 3000
const DIVINE_COOLDOWN_MS = 9000

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
  private auraAngle = 0
  private auraFlashTimer = -1
  private auraHitCooldowns = new Map<AnyEnemy, number>()
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
  private wandTimer = 0
  private boomerangTimer = 0
  // Dual guns (Chronos / Equinox + Solstice)
  private sunBeams: SunBeam[] = []
  private dualGunTimer = 0
  private dualGunQueue: Array<{ timeLeft: number; gold: boolean }> = []
  // Axe
  private axes: Axe[] = []
  private axeTimer = 0
  private axeDir = 1
  // Flame Trail
  private flamePools: FlamePool[] = []
  private lastFlameX = NaN
  private lastFlameY = NaN
  private flameTime = 0
  // Blood Nova
  private bloodNovaTimer = 0
  public novaPaused = false
  // Lightning
  private lightningTimer = 0
  private frontArcOnly: boolean
  private facingVx = 0
  private facingVy = 1
  private playerMoving = false
  private arcGraphic: Phaser.GameObjects.Graphics
  // Divine Shield
  private divineTimer = 0
  private divinePhase: 'active' | 'cooldown' = 'cooldown'
  private divineInitialized = false
  private divineGraphic: Phaser.GameObjects.Graphics
  private divineAngle = 0

  constructor(scene: Phaser.Scene, effects: EffectsSystem, frontArcOnly = false) {
    this.frontArcOnly = frontArcOnly
    this.arcGraphic = scene.add.graphics().setDepth(3)
    this.scene = scene
    this.effects = effects
    this.auraGraphic = scene.add.graphics().setDepth(2)
    this.orbGraphic = scene.add.graphics().setDepth(5)
    this.divineGraphic = scene.add.graphics().setDepth(7)
  }

  setFacing(vx: number, vy: number) {
    const mag = Math.sqrt(vx * vx + vy * vy)
    if (mag > 0) { this.facingVx = vx / mag; this.facingVy = vy / mag }
  }

  setMoving(moving: boolean) {
    this.playerMoving = moving
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
    soundSystem.shootMelee()
    if (hit) soundSystem.enemyHit()
    this.showSlashEffect(px, py)
  }

  private showSlashEffect(px: number, py: number) {
    const g = this.scene.add.graphics().setDepth(6)
    const baseAngle = Math.atan2(this.facingVy, this.facingVx)
    const R = CombatSystem.SLASH_RANGE
    const halfSpan = Math.PI * 0.5
    const innerR = R * 0.18
    const steps = 32

    const draw = (sweepFrac: number, alpha: number) => {
      g.clear()
      if (sweepFrac < 0.02) return
      const outerR = R

      const startA = baseAngle - halfSpan
      const endA   = baseAngle - halfSpan + halfSpan * 2 * sweepFrac
      const arcSteps = Math.max(2, Math.round(steps * sweepFrac))

      // Solid filled wedge
      g.fillStyle(0xff5500, alpha * 0.35)
      g.beginPath()
      for (let i = 0; i <= arcSteps; i++) {
        const a = startA + (i / arcSteps) * (endA - startA)
        if (i === 0) g.moveTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
        else g.lineTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
      }
      for (let i = arcSteps; i >= 0; i--) {
        const a = startA + (i / arcSteps) * (endA - startA)
        g.lineTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
      }
      g.fillPath()

      // Wide outer glow arc
      g.lineStyle(18, 0xff6600, alpha * 0.4)
      g.beginPath()
      for (let i = 0; i <= arcSteps; i++) {
        const a = startA + (i / arcSteps) * (endA - startA)
        if (i === 0) g.moveTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
        else g.lineTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
      }
      g.strokePath()

      // Crisp bright outer arc edge
      g.lineStyle(3, 0xffdd88, alpha * 0.95)
      g.beginPath()
      for (let i = 0; i <= arcSteps; i++) {
        const a = startA + (i / arcSteps) * (endA - startA)
        if (i === 0) g.moveTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
        else g.lineTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
      }
      g.strokePath()

      // Bright sweeping tip streak
      const tipA = endA
      const trailA = Math.max(startA, tipA - 0.65)
      const tipSteps = Math.max(2, Math.round(steps * 0.35))
      g.lineStyle(6, 0xffffff, alpha * 1.0)
      g.beginPath()
      for (let i = 0; i <= tipSteps; i++) {
        const a = trailA + (i / tipSteps) * (tipA - trailA)
        if (i === 0) g.moveTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
        else g.lineTo(px + Math.cos(a) * outerR, py + Math.sin(a) * outerR)
      }
      g.strokePath()

      // Inner arc
      g.lineStyle(2, 0xffaa44, alpha * 0.55)
      g.beginPath()
      for (let i = 0; i <= arcSteps; i++) {
        const a = startA + (i / arcSteps) * (endA - startA)
        if (i === 0) g.moveTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
        else g.lineTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
      }
      g.strokePath()

      // Cap lines
      for (const capA of [startA, endA]) {
        g.lineStyle(2, 0xffdd88, alpha * 0.5)
        g.beginPath()
        g.moveTo(px + Math.cos(capA) * innerR, py + Math.sin(capA) * innerR)
        g.lineTo(px + Math.cos(capA) * outerR, py + Math.sin(capA) * outerR)
        g.strokePath()
      }
    }

    // Sweep across (75ms), brief hold, then fade (180ms)
    const sweep = { t: 0 }
    this.scene.tweens.add({
      targets: sweep, t: 1, duration: 75, ease: 'Power3.Out',
      onUpdate: () => draw(sweep.t, 1),
      onComplete: () => {
        this.scene.time.delayedCall(40, () => {
          const fade = { t: 1 }
          this.scene.tweens.add({
            targets: fade, t: 0, duration: 180, ease: 'Power2.In',
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
    const halfSpan = Math.PI * 0.5
    const innerR = R * 0.18
    const steps = 24

    // Forward arc centered on facing direction
    this.arcGraphic.lineStyle(1, 0xff6622, 0.18)
    this.arcGraphic.beginPath()
    for (let i = 0; i <= steps; i++) {
      const a = baseAngle - halfSpan + (i / steps) * halfSpan * 2
      if (i === 0) this.arcGraphic.moveTo(px + Math.cos(a) * R, py + Math.sin(a) * R)
      else this.arcGraphic.lineTo(px + Math.cos(a) * R, py + Math.sin(a) * R)
    }
    this.arcGraphic.strokePath()
    this.arcGraphic.lineStyle(1, 0xff6622, 0.09)
    this.arcGraphic.beginPath()
    for (let i = 0; i <= steps; i++) {
      const a = baseAngle - halfSpan + (i / steps) * halfSpan * 2
      if (i === 0) this.arcGraphic.moveTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
      else this.arcGraphic.lineTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
    }
    this.arcGraphic.strokePath()
  }

  update(playerX: number, playerY: number, enemies: AnyEnemy[], delta: number) {
    this.playerX = playerX
    this.playerY = playerY
    const { might, level, attackInterval, wandAttackInterval, addXP, takeDamage, takeContactDamage, addSessionCoins, aura, auraTick, auraRange, orbital, orbSpeed, orbPower, orbRange, lifeDrain, wand, boomerang, flameTrail, bloodNova, bloodNovaCD, vampiric, lightning, lightningTargets, lightningCooldown, axe, divineShield, setDivineShield, multiShot, piercing: isPiercing, magnetRange, equinox, solstice, dualGunDamage, dualGunAttackInterval, dualGunExtra, echo } = getValidatedCombatState()
    const damage = Math.floor(weaponBaseDamage(level) * might)

    const { upgrades } = useProfileStore.getState()
    const luckRank = upgrades.luck
    const magnetRank = upgrades.magnet
    const growthRank = upgrades.growth
    const coinDropChance = 0.02 + luckRank * 0.01

    this.drawSwordIndicator(playerX, playerY)

    // Ares primary weapon: melee arc sweep (front-arc only)
    if (this.frontArcOnly) {
      this.fireTimer += delta
      if (this.fireTimer >= attackInterval) {
        this.fireTimer = 0
        this.fireSwordSwing(playerX, playerY, damage, enemies, coinDropChance, lifeDrain, vampiric)
      }
    }

    // Arcane Wand: fires magic bolts at nearest enemy
    if (wand) {
      this.wandTimer += delta
      if (this.wandTimer >= wandAttackInterval) {
        this.wandTimer = 0
        const target = this.findNearest(playerX, playerY, enemies, 700)
        if (target) {
          const baseAngle = Math.atan2(target.y - playerY, target.x - playerX)
          const spreadRad = 15 * (Math.PI / 180)
          for (let i = 0; i <= multiShot + echo; i++) {
            const side = i % 2 === 1 ? 1 : -1
            const offset = i === 0 ? 0 : Math.ceil(i / 2) * side * spreadRad
            const angle = baseAngle + offset
            const proj = new Projectile(this.scene, playerX, playerY,
              playerX + Math.cos(angle) * 1000, playerY + Math.sin(angle) * 1000)
            proj.piercing = isPiercing
            this.projectiles.push(proj)
          }
          soundSystem.shootWand()
        }
      }
    }

    // Both guns fire 4 diagonal beams (NE/SE/SW/NW). Equinox = gold, Solstice = cyan.
    // With both equipped, gun 2 fires 200ms after gun 1 so its beams trail behind.
    // dualGunExtra adds more trailing volleys at 200ms intervals.
    if (equinox || solstice) {
      this.dualGunTimer += delta
      if (this.dualGunTimer >= dualGunAttackInterval) {
        this.dualGunTimer = 0
        soundSystem.shootWand()
        // Build shot sequence: equinox=gold, solstice=cyan, repeated per dualGunExtra
        const shots: boolean[] = []  // true = gold (equinox), false = cyan (solstice)
        for (let burst = 0; burst <= dualGunExtra + echo; burst++) {
          if (equinox)  shots.push(true)
          if (solstice) shots.push(false)
        }
        this.fireSunBeams(playerX, playerY, shots[0])
        for (let i = 1; i < shots.length; i++) {
          this.dualGunQueue.push({ timeLeft: i * DUAL_GUN_BURST_DELAY, gold: shots[i] })
        }
      }
    }

    // Process queued sequential bursts
    for (let i = this.dualGunQueue.length - 1; i >= 0; i--) {
      this.dualGunQueue[i].timeLeft -= delta
      if (this.dualGunQueue[i].timeLeft <= 0) {
        const q = this.dualGunQueue.splice(i, 1)[0]
        this.fireSunBeams(playerX, playerY, q.gold)
      }
    }

    // Move sun beams + check enemy hits (pierce — beam continues through enemies)
    const camWVBeams = this.scene.cameras.main.worldView
    const BEAM_OFF_MARGIN = 200
    const gunDmgActive = Math.floor(weaponBaseDamage(level) * might * DUAL_GUN_DAMAGE_MULT * (1 + dualGunDamage * 0.3))
    for (const b of this.sunBeams) {
      if (!b.active) continue
      b.update(delta)
      if (!b.active) continue
      if (b.x < camWVBeams.left  - BEAM_OFF_MARGIN || b.x > camWVBeams.right  + BEAM_OFF_MARGIN ||
          b.y < camWVBeams.top   - BEAM_OFF_MARGIN || b.y > camWVBeams.bottom + BEAM_OFF_MARGIN) {
        b.destroy(); continue
      }
      for (const e of enemies) {
        if (!e.active || b.hitTargets.has(e)) continue
        const dx = b.x - e.x
        const dy = b.y - e.y
        if (dx * dx + dy * dy < b.hitRadius * b.hitRadius) {
          this.applyHit(e, gunDmgActive, coinDropChance, lifeDrain, vampiric)
          b.hitTargets.add(e)  // pierce: beam keeps going
        }
      }
    }
    this.sunBeams = this.sunBeams.filter(b => b.active)

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
      const collected = orb.update(playerX, playerY, delta, magnetRange)
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
          takeDamage(10)
          b.destroy()
        }
      }
    }

    this.projectiles = this.projectiles.filter(p => p.active)
    this.orbs = this.orbs.filter(o => o.active)
    this.coins = this.coins.filter(c => c.active)

    // Aura (Garlic-style: always-visible field + knockback on damage pulse)
    this.auraGraphic.clear()
    if (aura > 0) {
      const radius = 60 + auraRange * 30
      this.auraAngle += delta * 0.0015

      // VS Garlic-style: per-enemy cooldown — immediate hit on first contact, re-hit only after interval
      const auraDmg = damage * aura
      const tickInterval = 700 - auraTick * 80
      const nowAura = Date.now()
      for (const e of enemies) {
        if (!e.active || !this.isOnScreen(e.x, e.y)) continue
        const dx = e.x - playerX
        const dy = e.y - playerY
        if (dx * dx + dy * dy >= radius * radius) continue
        const lastHit = this.auraHitCooldowns.get(e) ?? 0
        if (nowAura - lastHit >= tickInterval) {
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if ('knockbackDx' in e) {
            (e as any).knockbackDx = dx / dist
            ;(e as any).knockbackDy = dy / dist
          }
          this.applyAuraHit(e, auraDmg, playerX, playerY, coinDropChance, lifeDrain, vampiric)
          this.auraHitCooldowns.set(e, nowAura)
          this.auraFlashTimer = 0
        }
      }
      // Prune dead enemies from cooldown map
      for (const [e] of this.auraHitCooldowns) {
        if (!e.active) this.auraHitCooldowns.delete(e)
      }

      // Always-visible base: soft pulsing field
      const pulse = 0.5 + 0.5 * Math.sin(this.auraAngle * 4)
      this.auraGraphic.fillStyle(0x4411cc, 0.04 + 0.03 * pulse)
      this.auraGraphic.fillCircle(playerX, playerY, radius)
      this.auraGraphic.lineStyle(2.5, 0x9944ff, 0.25 + 0.15 * pulse)
      this.auraGraphic.strokeCircle(playerX, playerY, radius)

      // Rotating arc segments (always visible)
      const numArcs = 3 + aura
      const arcLen = (Math.PI * 2 / numArcs) * 0.55
      for (let i = 0; i < numArcs; i++) {
        const start = this.auraAngle + (i / numArcs) * Math.PI * 2
        this.auraGraphic.lineStyle(1.5, 0xcc77ff, 0.35)
        this.auraGraphic.beginPath()
        this.auraGraphic.arc(playerX, playerY, radius, start, start + arcLen, false)
        this.auraGraphic.strokePath()
        const tipAngle = start + arcLen
        this.auraGraphic.fillStyle(0xffffff, 0.45)
        this.auraGraphic.fillCircle(playerX + Math.cos(tipAngle) * radius, playerY + Math.sin(tipAngle) * radius, 2)
      }

      // Damage pulse flash (500ms window on top of base)
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

          // Arc segments bright on pulse
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
      const ORBIT_RADIUS = 75 + orbRange * 20
      const ORB_RADIUS = 13 + orbRange * 2
      const ORB_HIT_RADIUS = 20 + orbRange * 3
      const HIT_COOLDOWN = 500
      const orbDamage = Math.max(1, Math.floor(weaponBaseDamage(level) * might * 0.65 * (1 + orbPower * 0.2)))

      this.orbAngle += delta * 0.0018 * (1 + orbSpeed * 0.25)

      // Smooth the orbit center so fast player movement doesn't distort apparent rotation speed
      if (!this.orbCenterInit) { this.orbCenterX = playerX; this.orbCenterY = playerY; this.orbCenterInit = true }
      const lag = 1 - Math.exp(-delta / 90)
      this.orbCenterX += (playerX - this.orbCenterX) * lag
      this.orbCenterY += (playerY - this.orbCenterY) * lag

      const orbCount = orbital + echo
      const now = Date.now()
      for (let i = 0; i < orbCount; i++) {
        const angle = this.orbAngle + (i / orbCount) * Math.PI * 2
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
          const toTarget = Math.atan2(target.y - playerY, target.x - playerX)
          const perpX = -Math.sin(toTarget)
          const perpY = Math.cos(toTarget)
          for (let ei = 0; ei <= echo; ei++) {
            const offset = (ei - echo / 2) * 24
            this.boomerangs.push(new Boomerang(this.scene, playerX + perpX * offset, playerY + perpY * offset, target.x, target.y))
          }
          soundSystem.shootBoomerang()
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
            this.applyHit(e, Math.floor(damage * 1.5), coinDropChance, lifeDrain, vampiric)
          }
        }
      }
      this.boomerangs = this.boomerangs.filter(b => b.active)
    }

    // === Flame Trail ===
    if (flameTrail) {
      if (isNaN(this.lastFlameX)) { this.lastFlameX = playerX; this.lastFlameY = playerY }
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
      const novaInterval = NOVA_INTERVAL - bloodNovaCD * 10000
      if (this.bloodNovaTimer >= novaInterval) {
        this.bloodNovaTimer = 0
        const novaDmg = Math.floor(weaponBaseDamage(level) * might * 30)
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
        for (let ei = 0; ei <= echo; ei++) {
          const yOff = (ei - echo / 2) * 24
          this.axes.push(new Axe(this.scene, playerX, playerY + yOff, dirX))
        }
        soundSystem.shootAxe()
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
      const lightningInterval = LIGHTNING_INTERVAL - lightningCooldown * 1000
      if (this.lightningTimer >= lightningInterval) {
        this.lightningTimer = 0
        const boltDmg = Math.floor(weaponBaseDamage(level) * might * LIGHTNING_DAMAGE_MULT)
        const cam = this.scene.cameras.main.worldView
        const active = enemies.filter(e => e.active && cam.contains(e.x, e.y))
        const targetCount = LIGHTNING_TARGETS + lightningTargets
        const targets: AnyEnemy[] = []
        const pool = [...active]
        for (let i = 0; i < targetCount && pool.length > 0; i++) {
          const idx = Math.floor(Math.random() * pool.length)
          targets.push(pool.splice(idx, 1)[0])
        }
        for (const t of targets) {
          this.fireLightningBolt(t.x, t.y)
          this.applyHit(t, boltDmg, coinDropChance, lifeDrain, vampiric)
        }
      }
    }

    // === Divine Shield (VS Laurel-style: timed i-frame window) ===
    this.divineGraphic.clear()
    if (divineShield) {
      if (!this.divineInitialized) {
        this.divineInitialized = true
        this.divinePhase = 'active'
        this.divineTimer = 0
        setDivineShield(true)
      }

      this.divineAngle += delta * 0.002
      this.divineTimer += delta

      if (this.divinePhase === 'active') {
        if (this.divineTimer >= DIVINE_ACTIVE_MS) {
          this.divineTimer = 0
          this.divinePhase = 'cooldown'
          setDivineShield(false)
        } else {
          // Active window: pulsing golden ring
          const pulse = 0.8 + 0.2 * Math.sin(this.divineAngle * 1.5)
          const R = 38 * pulse
          this.divineGraphic.fillStyle(0xffee88, 0.12 * pulse)
          this.divineGraphic.fillCircle(playerX, playerY, R * 1.3)
          this.divineGraphic.fillStyle(0xffdd00, 0.20 * pulse)
          this.divineGraphic.fillCircle(playerX, playerY, R)
          this.divineGraphic.lineStyle(3, 0xffee44, 0.9 * pulse)
          this.divineGraphic.strokeCircle(playerX, playerY, R)
          this.divineGraphic.lineStyle(1.5, 0xffffff, 0.55 * pulse)
          this.divineGraphic.strokeCircle(playerX, playerY, R * 1.15)
          const numArcs = 4
          for (let i = 0; i < numArcs; i++) {
            const a = this.divineAngle + (i / numArcs) * Math.PI * 2
            const arcLen = Math.PI * 0.35
            this.divineGraphic.lineStyle(2.5, 0xffee00, 0.85 * pulse)
            this.divineGraphic.beginPath()
            this.divineGraphic.arc(playerX, playerY, R, a, a + arcLen, false)
            this.divineGraphic.strokePath()
            const tipA = a + arcLen
            this.divineGraphic.fillStyle(0xffffff, 0.9 * pulse)
            this.divineGraphic.fillCircle(playerX + Math.cos(tipA) * R, playerY + Math.sin(tipA) * R, 2.5)
          }
        }
      } else {
        // Cooldown: recharge progress ring
        if (this.divineTimer >= DIVINE_COOLDOWN_MS) {
          this.divineTimer = 0
          this.divinePhase = 'active'
          setDivineShield(true)
        }
        const progress = Math.min(this.divineTimer / DIVINE_COOLDOWN_MS, 1)
        const R = 38
        this.divineGraphic.lineStyle(1.5, 0xaaaaaa, 0.25)
        this.divineGraphic.strokeCircle(playerX, playerY, R)
        if (progress > 0.02) {
          this.divineGraphic.lineStyle(2.5, 0xcccc66, 0.55)
          this.divineGraphic.beginPath()
          this.divineGraphic.arc(playerX, playerY, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false)
          this.divineGraphic.strokePath()
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

  private fireSunBeams(px: number, py: number, gold: boolean) {
    const MOVE_OFFSET = 20
    const spawnX = this.playerMoving ? px + this.facingVx * MOVE_OFFSET : px
    const spawnY = this.playerMoving ? py + this.facingVy * MOVE_OFFSET : py
    const d = DUAL_GUN_SPEED * 0.707
    for (const [vx, vy] of [[d, -d], [d, d], [-d, d], [-d, -d]] as [number, number][]) {
      this.sunBeams.push(new SunBeam(this.scene, spawnX, spawnY, vx, vy, gold))
    }
  }

  private fireBloodNova(playerX: number, playerY: number, damage: number, enemies: AnyEnemy[], coinDropChance: number, lifeDrain: number, vampiric: boolean) {
    // Wipe ALL on-screen enemies — no radius limit, no HP cost
    for (const e of enemies) {
      if (!e.active || !this.isOnScreen(e.x, e.y)) continue
      this.applyHit(e, damage, coinDropChance, lifeDrain, vampiric)
    }

    soundSystem.bloodNova()
    this.effects.shakeCamera()

    // Freeze game logic for the duration of the animation
    const NOVA_PAUSE_MS = 1700
    this.novaPaused = true
    setTimeout(() => { this.novaPaused = false }, NOVA_PAUSE_MS)

    const cam = this.scene.cameras.main
    const screenR = Math.hypot(cam.width, cam.height) / 2 + 80

    // Full-screen dark flash (fixed to camera, not world)
    const flash = this.scene.add.graphics().setDepth(30).setScrollFactor(0)
    flash.fillStyle(0x0d0000, 1)
    flash.fillRect(0, 0, cam.width, cam.height)
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 1400,
      ease: 'Power3In',
      ignoreTimeScale: true,
      onComplete: () => flash.destroy(),
    })

    // Expanding dark ring in world space
    const g = this.scene.add.graphics().setDepth(29)
    const obj = { t: 0 }
    this.scene.tweens.add({
      targets: obj,
      t: 1,
      duration: 1600,
      ease: 'Power2Out',
      ignoreTimeScale: true,
      onUpdate: () => {
        const t = obj.t
        const r = 10 + (screenR - 10) * t
        const alpha = 1 - t * 0.85
        g.clear()
        g.lineStyle(22 * (1 - t) + 4, 0x000000, alpha)
        g.strokeCircle(playerX, playerY, r)
        g.lineStyle(6 * (1 - t) + 2, 0xcc0000, alpha * 0.8)
        g.strokeCircle(playerX, playerY, r - 18)
        g.fillStyle(0x0a0000, alpha * 0.55)
        g.fillCircle(playerX, playerY, r)
      },
      onComplete: () => g.destroy(),
    })

    // "BLOOD NOVA" title text — fades in then out
    const label = this.scene.add.text(cam.width / 2, cam.height / 2, 'BLOOD NOVA', {
      fontSize: '52px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#ff2222',
      stroke: '#000000',
      strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 0, color: '#cc0000', blur: 18, fill: true },
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(31)
      .setAlpha(0)

    this.scene.tweens.add({
      targets: label,
      alpha: 1,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 300,
      ease: 'Power2Out',
      ignoreTimeScale: true,
      onComplete: () => {
        this.scene.tweens.add({
          targets: label,
          alpha: 0,
          scaleX: 0.95,
          scaleY: 0.95,
          duration: 900,
          delay: 500,
          ease: 'Power2In',
          ignoreTimeScale: true,
          onComplete: () => label.destroy(),
        })
      },
    })
  }

  private applyAuraHit(e: AnyEnemy, damage: number, playerX: number, playerY: number, coinDropChance: number, lifeDrain: number, vampiric: boolean) {
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
      net.send({ type: 'auraHit', enemyId: (e as ClientEnemy).serverId, damage: actual })
      e.takeDamage(actual)
    } else {
      e.takeDamage(actual)
      if (e.hp <= 0) {
        this.killEnemy(e, coinDropChance, lifeDrain)
      } else {
        const dx = e.x - playerX
        const dy = e.y - playerY
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        e.x += (dx / dist) * 12
        e.y += (dy / dist) * 12
      }
    }
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
      net.send({ type: 'hit', enemyId: (e as ClientEnemy).serverId, damage: actual })
      e.takeDamage(actual)  // visual flash only
    } else {
      e.takeDamage(actual)
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

  }

  private jitter(dmg: number): number {
    return Math.max(1, dmg + Math.floor(Math.random() * 3) - 1)
  }

  adminSpawnItem(type: 'potion' | 'xporb' | 'coin', x: number, y: number): void {
    if (type === 'potion') this.potions.push(new HealthPotion(this.scene, x, y))
    else if (type === 'xporb') this.orbs.push(new XPOrb(this.scene, x, y, 50))
    else if (type === 'coin') this.coins.push(new CoinOrb(this.scene, x, y))
  }

  spawnDropsAt(x: number, y: number, xpValue: number, isBoss: boolean) {
    const luckRank = useProfileStore.getState().upgrades.luck
    const coinDropChance = 0.02 + luckRank * 0.01

    const xpDropChance = 0.5 + luckRank * 0.05
    const sa = Math.random() * Math.PI * 2
    const sr = Math.random() * 20
    if (isBoss || Math.random() < xpDropChance) {
      this.orbs.push(new XPOrb(this.scene, x + Math.cos(sa) * sr, y + Math.sin(sa) * sr, xpValue))
    }
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
