import Phaser from 'phaser'
import type { AnyEnemy } from './Enemy'
import type { ClientEnemy } from './ClientEnemy'
import { Projectile } from './Projectile'
import { SunBeam } from './SunBeam'
import { Boomerang } from './Boomerang'
import { Axe, BerserkerRing } from './Axe'
import { XPOrb, orbTierForValue } from './XPOrb'
import { CoinOrb } from './CoinOrb'
import { HealthPotion } from './HealthPotion'
import { EffectsSystem } from './EffectsSystem'
import { useGameStore, weaponBaseDamage, getValidatedCombatState } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'
import { soundSystem } from './SoundSystem'
import { difficultyScale } from './difficultyScale'
import { activeNetClient } from '../net/netState'
import { minimapData } from './minimapData'

const MAX_ORBS = 300

function compact<T extends { active: boolean }>(arr: T[]): void {
  let i = 0
  while (i < arr.length) {
    if (arr[i].active) { i++; continue }
    arr[i] = arr[arr.length - 1]
    arr.pop()
  }
}

const CONTACT_RADIUS = 28
const CONTACT_ENEMY_COOLDOWN = 240   // ms — matches VS post-hit immunity window
const BULLET_HIT_RADIUS = 15
const BOOMERANG_INTERVAL = 3000
const SPEAR_BASE_CD = 700         // ms base cooldown between volleys
const SPEAR_STORM_INTERVAL = 60   // ms per spear in Thousand Spears mode
const WEAPON_STAGGER = 65         // ms between adjacent projectiles in a staggered volley
const AXE_STAGGER      = 200           // ms between axes in a throw — matches VS (0.2s interval)
const AXE_SPEED_MAG    = 628           // px/s launch speed (≈ sqrt(240²+580²), same total energy)
const AXE_BASE_ANGLE   = 10 * Math.PI / 180  // first axe: 10° from straight up
const AXE_ANGLE_STEP   = 20 * Math.PI / 180  // each extra axe fans 20° further toward facing
const AXE_ANGLE_MAX    = 75 * Math.PI / 180  // cap so even the widest axe still arcs upward
const SPEAR_PERP_GAP = 15         // px perpendicular spacing between spears
const SPEAR_SPEED = 680
const SPEAR_HIT_R = 12
const AXE_INTERVAL = 4000
const AXE_DAMAGE_MULT = 2.5
const BOOMERANG_HIT_R = 28
const BRAZIER_HIT_R   = 56
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

const RAVENS_ZONE_ORBIT_R = 210   // zone circle orbits player at this radius
const RAVENS_ZONE_VIS_R = 60      // visual radius of the zone circle indicator
const RAVENS_ROT_SPEED = 0.00095  // radians/ms counterclockwise
const RAVENS_BASE_CD = 3500       // ms base cooldown between bursts
const RAVENS_CD_STEP = 500        // ms reduction per ravensCD level
const RAVENS_BURST_SETS = 4       // sets per burst
const RAVENS_SET_DELAY = 220      // ms between each set in a burst
const RAVENS_BOMB_SPEED = 390     // px/s — bird shoots toward zone
const RAVENS_BOMB_MAX_AGE = 500   // ms  (zone is ~160px away, travels well past it)
const RAVENS_BOMB_HIT_R = 14      // hit radius
const RAVENS_BOMB_SPREAD = 0.26   // total fan spread in radians across a set

interface RavenBomb {
  x: number; y: number
  vx: number; vy: number
  angle: number
  curveRate: number   // rad/ms — positive = CCW, negative = CW
  age: number
  maxAge: number
  hitEnemies: Set<AnyEnemy>
}

interface FlamePool {
  x: number; y: number
  timer: number; tickTimer: number
  emitter: Phaser.GameObjects.Particles.ParticleEmitter
}

export const VAMPIRIC_PERCENT = 0.0025  // 0.25% lifesteal per hit

export class CombatSystem {
  private scene: Phaser.Scene
  private effects: EffectsSystem
  private projectiles: Projectile[] = []
  private orbs: XPOrb[] = []
  private accumulatorOrb: XPOrb | null = null
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
  private boomerangQueue: Array<{ delay: number; perpOff: number; toAngle: number; tx: number; ty: number }> = []
  // Bifrost Spear
  private spearCooldownTimer = 0
  private spearQueue: Array<{ delay: number; perpOffset: number }> = []
  private spearProjectiles: Projectile[] = []
  // Dual guns (Chronos / Equinox + Solstice)
  private sunBeams: SunBeam[] = []
  private dualGunTimer = 0
  private dualGunQueue: Array<{ timeLeft: number; gold: boolean; maxPierces: number }> = []
  // Axe
  private axes: Axe[] = []
  private axeTimer = 0
  private axeDir = 1
  private axeQueue: Array<{ delay: number; vx: number; vy: number }> = []
  private berserkerRing: BerserkerRing | null = null
  // Flame Trail
  private flamePools: FlamePool[] = []
  private lastFlameX = NaN
  private lastFlameY = NaN
  // Blood Nova
  private bloodNovaTimer = 0
  public novaPaused = false
  private frameDamage = 0   // accumulates damage dealt this frame; flushed once via addDamage
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
  // Odin's Ravens
  private ravensZoneAngle = 0
  private ravensBirdAngle = 0
  private ravensCooldownTimer = 0
  private ravensBurstActive = false
  private ravensBurstAge = 0
  private ravensBurstSetsLeft = 0
  private ravensBurstSetTimer = 0
  private ravensBombs: RavenBomb[] = []
  private ravensWingPhase = 0
  private ravensGraphic: Phaser.GameObjects.Graphics
  private ravenSpriteA: Phaser.GameObjects.Image
  private ravenSpriteB: Phaser.GameObjects.Image
  private brazierTargets: Map<number, { x: number; y: number }> = new Map()
  private brazierAuraCooldowns: Map<number, number> = new Map()
  private orbMagnetTimer = 0

  constructor(scene: Phaser.Scene, effects: EffectsSystem, frontArcOnly = false) {
    this.frontArcOnly = frontArcOnly
    this.arcGraphic = scene.add.graphics().setDepth(3)
    this.scene = scene
    this.effects = effects
    this.auraGraphic = scene.add.graphics().setDepth(2)
    this.orbGraphic = scene.add.graphics().setDepth(5)
    this.divineGraphic = scene.add.graphics().setDepth(7)
    this.ravensGraphic = scene.add.graphics().setDepth(4.5)
    this.ravenSpriteA = scene.add.image(0, 0, 'raven').setDepth(4.6).setScale(0.15).setTint(0x66ffbb).setVisible(false)
    this.ravenSpriteB = scene.add.image(0, 0, 'raven').setFlipX(true).setDepth(4.6).setScale(0.15).setTint(0x66ffbb).setVisible(false)
  }

  updateBraziers(braziers: Map<number, { x: number; y: number }>) {
    this.brazierTargets = braziers
    for (const id of this.brazierAuraCooldowns.keys()) {
      if (!braziers.has(id)) this.brazierAuraCooldowns.delete(id)
    }
  }

  setFacing(vx: number, vy: number) {
    const mag = Math.sqrt(vx * vx + vy * vy)
    if (mag > 0) { this.facingVx = vx / mag; this.facingVy = vy / mag }
  }

  setMoving(moving: boolean) {
    this.playerMoving = moving
  }

  private static readonly SLASH_RANGE = 140

  // True for Ares by default; also activates for any character that has at least one melee upgrade (admin testing)
  private get isMeleeActive(): boolean {
    if (this.frontArcOnly) return true
    const s = useGameStore.getState()
    return s.isMeleeChar || (s.meleeRange ?? 0) > 0 || (s.meleeArc ?? 0) > 0 || (s.meleeSpeed ?? 0) > 0 || (s.meleeDamage ?? 0) > 0
  }

  // Strike a cone in the given direction (fx, fy must be unit vector)
  private fireSwordSwingDir(px: number, py: number, damage: number, fx: number, fy: number, slashRange: number, halfspan: number, enemies: AnyEnemy[], coinDropChance: number, lifeDrain: number, vampiric: boolean) {
    let hit = false
    for (const e of enemies) {
      if (!e.active) continue
      const dx = e.x - px, dy = e.y - py
      const dist2 = dx * dx + dy * dy
      const effectiveRange = slashRange + e.hitRadius
      if (dist2 > effectiveRange * effectiveRange) continue
      const dist = Math.sqrt(dist2) || 1
      const cosH = Math.cos(halfspan + Math.asin(Math.min(1, e.hitRadius / dist)))
      if ((dx / dist) * fx + (dy / dist) * fy <= cosH) continue
      this.applyHit(e, damage, coinDropChance, lifeDrain, vampiric)
      hit = true
    }
    // Melee also hits braziers
    for (const [bId, b] of this.brazierTargets) {
      const dx = b.x - px, dy = b.y - py
      const dist2 = dx * dx + dy * dy
      if (dist2 > (slashRange + BRAZIER_HIT_R) ** 2) continue
      const dist = Math.sqrt(dist2) || 1
      const cosH = Math.cos(halfspan)
      if ((dx / dist) * fx + (dy / dist) * fy <= cosH) continue
      activeNetClient?.send({ type: 'hitBrazier', brazierId: bId, damage: Math.round(damage) })
    }
    soundSystem.shootMelee()
    if (hit) soundSystem.enemyHit()
    this.showSlashEffect(px, py, slashRange, halfspan, fx, fy)
  }

  private fireSwordSwing(px: number, py: number, damage: number, enemies: AnyEnemy[], coinDropChance: number, lifeDrain: number, vampiric: boolean) {
    const { meleeRange, meleeArc, meleeDamage, meleeArcWidth } = getValidatedCombatState()
    const slashRange = CombatSystem.SLASH_RANGE * (1 + meleeRange * 0.10)
    const halfspan = (37.5 * Math.PI / 180) + meleeArcWidth * (7.5 * Math.PI / 180)  // 75° base, +15° total arc per level
    const meleeDmg = Math.floor(damage * (1 + meleeDamage * 0.2))
    const fx = this.facingVx, fy = this.facingVy

    this.fireSwordSwingDir(px, py, meleeDmg, fx, fy, slashRange, halfspan, enemies, coinDropChance, lifeDrain, vampiric)

    // Rear strike (VS Whip Amount-style): fires 100ms after front, opposite direction
    if (meleeArc >= 1) {
      this.scene.time.delayedCall(100, () => {
        this.fireSwordSwingDir(px, py, meleeDmg, -fx, -fy, slashRange, halfspan, enemies, coinDropChance, lifeDrain, vampiric)
      })
    }
  }

  private showSlashEffect(px: number, py: number, R: number, halfSpan: number, fx: number, fy: number) {
    const g = this.scene.add.graphics().setDepth(6)
    const baseAngle = Math.atan2(fy, fx)
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
    if (!this.isMeleeActive) return
    const { meleeRange, meleeArc, meleeArcWidth } = getValidatedCombatState()
    const R = CombatSystem.SLASH_RANGE * (1 + meleeRange * 0.10)
    const halfSpan = (37.5 * Math.PI / 180) + meleeArcWidth * (7.5 * Math.PI / 180)
    const innerR = R * 0.18
    const steps = 24

    const drawArcBand = (centerAngle: number, alpha: number) => {
      this.arcGraphic.lineStyle(1, 0xff6622, alpha)
      this.arcGraphic.beginPath()
      for (let i = 0; i <= steps; i++) {
        const a = centerAngle - halfSpan + (i / steps) * halfSpan * 2
        if (i === 0) this.arcGraphic.moveTo(px + Math.cos(a) * R, py + Math.sin(a) * R)
        else this.arcGraphic.lineTo(px + Math.cos(a) * R, py + Math.sin(a) * R)
      }
      this.arcGraphic.strokePath()
      this.arcGraphic.lineStyle(1, 0xff6622, alpha * 0.5)
      this.arcGraphic.beginPath()
      for (let i = 0; i <= steps; i++) {
        const a = centerAngle - halfSpan + (i / steps) * halfSpan * 2
        if (i === 0) this.arcGraphic.moveTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
        else this.arcGraphic.lineTo(px + Math.cos(a) * innerR, py + Math.sin(a) * innerR)
      }
      this.arcGraphic.strokePath()
    }

    const fwdAngle = Math.atan2(this.facingVy, this.facingVx)
    drawArcBand(fwdAngle, 0.18)
    if (meleeArc >= 1) drawArcBand(fwdAngle + Math.PI, 0.10)  // rear indicator dimmer
  }

  update(playerX: number, playerY: number, enemies: AnyEnemy[], delta: number) {
    this.playerX = playerX
    this.playerY = playerY
    const { might, level, attackInterval, wandAttackInterval, addXP, takeDamage, takeContactDamage, addSessionCoins, aura, auraTick, auraRange, orbital, orbSpeed, orbPower, orbRange, lifeDrain, wand, boomerang, spear, flameTrail, bloodNova, bloodNovaCD, vampiric, lightning, lightningTargets, lightningCooldown, axe, axeAmount, axeDamage, axePierce, axeEvolution, divineShield, setDivineShield, multiShot, piercing: isPiercing, magnetRange, equinox, solstice, dualGunDamage, dualGunAttackInterval, dualGunExtra, echo, ravens, ravensCD, ravensPower, ravensCount, spearCount, spearInterval, spearPierce, spearSpeed, spearStorm } = getValidatedCombatState()
    const damage = Math.floor(weaponBaseDamage(level) * might)
    const now = Date.now()

    const { upgrades } = useProfileStore.getState()
    const luckRank = upgrades.luck
    const magnetRank = upgrades.magnet
    const growthRank = upgrades.growth
    const coinDropChance = 0.02 + luckRank * 0.01

    this.drawSwordIndicator(playerX, playerY)

    // Ares primary weapon: melee arc sweep; also activates via admin for any character
    if (this.isMeleeActive) {
      this.fireTimer += delta
      if (this.fireTimer >= attackInterval) {
        this.fireTimer = 0
        this.fireSwordSwing(playerX, playerY, damage, enemies, coinDropChance, lifeDrain, vampiric)
      }
    }

    // Arcane Wand: fires magic bolts, each targeting a different enemy
    if (wand) {
      this.wandTimer += delta
      if (this.wandTimer >= wandAttackInterval) {
        this.wandTimer = 0
        const boltCount = 1 + multiShot + echo
        const targets = this.findNNearest(playerX, playerY, enemies, boltCount, 700)
        if (targets.length > 0) {
          for (let i = 0; i < boltCount; i++) {
            const t = targets[i % targets.length]
            const angle = Math.atan2(t.y - playerY, t.x - playerX)
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
    // Base pierce: 2 enemies. Each dualGunDamage level adds +1 pierce.
    const sunBeamMaxPierces = 2 + dualGunDamage
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
        this.fireSunBeams(playerX, playerY, shots[0], sunBeamMaxPierces)
        for (let i = 1; i < shots.length; i++) {
          this.dualGunQueue.push({ timeLeft: i * DUAL_GUN_BURST_DELAY, gold: shots[i], maxPierces: sunBeamMaxPierces })
        }
      }
    }

    // Process queued sequential bursts
    for (let i = this.dualGunQueue.length - 1; i >= 0; i--) {
      this.dualGunQueue[i].timeLeft -= delta
      if (this.dualGunQueue[i].timeLeft <= 0) {
        const q = this.dualGunQueue.splice(i, 1)[0]
        this.fireSunBeams(playerX, playerY, q.gold, q.maxPierces)
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
        const hitDist = b.hitRadius + e.hitRadius
        if (dx * dx + dy * dy < hitDist * hitDist) {
          this.applyHit(e, gunDmgActive, coinDropChance, lifeDrain, vampiric)
          b.hitTargets.add(e)
          b.pierceCount++
          if (b.pierceCount >= b.maxPierces) { b.destroy(); break }
        }
      }
      for (const [bId, bz] of this.brazierTargets) {
        if (b.hitTargets.has(bId as any)) continue
        const dx = b.x - bz.x, dy = b.y - bz.y
        if (dx * dx + dy * dy < (b.hitRadius + BRAZIER_HIT_R) ** 2) {
          b.hitTargets.add(bId as any)
          activeNetClient?.send({ type: 'hitBrazier', brazierId: bId, damage: Math.round(gunDmgActive) })
        }
      }
    }
    compact(this.sunBeams)

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
      // Destroy projectiles at the visual corridor wall edges (stage 2 only)
      const halfY = (this.scene as any).corridorHalfY as number | null
      if (halfY !== null && (p.y < -halfY || p.y > halfY)) {
        p.destroy()
        continue
      }

      for (const e of enemies) {
        if (!e.active || p.hitTargets.has(e)) continue
        const dx = p.x - e.x
        const dy = p.y - e.y
        const hitDist = p.hitRadius + e.hitRadius
        if (dx * dx + dy * dy < hitDist * hitDist) {
          this.applyHit(e, damage, coinDropChance, lifeDrain, vampiric)
          if (p.piercing) {
            p.hitTargets.add(e)
          } else {
            p.destroy()
            break
          }
        }
      }
      // Braziers — projectiles pass through (no deactivation)
      if (p.active) {
        for (const [bId, b] of this.brazierTargets) {
          if (p.hitTargets.has(bId as any)) continue
          const dx = p.x - b.x, dy = p.y - b.y
          if (dx * dx + dy * dy < (p.hitRadius + BRAZIER_HIT_R) ** 2) {
            p.hitTargets.add(bId as any)
            activeNetClient?.send({ type: 'hitBrazier', brazierId: bId, damage: Math.round(damage) })
          }
        }
      }
    }

    // Collect XP orbs
    if (this.orbMagnetTimer > 0) this.orbMagnetTimer -= delta
    const effectiveMagnetRange = this.orbMagnetTimer > 0 ? 100_000 : magnetRange
    let xpGained = 0
    for (const orb of this.orbs) {
      if (!orb.active) continue
      const collected = orb.update(playerX, playerY, delta, effectiveMagnetRange)
      if (collected > 0) {
        this.effects.showXPCollect(orb.x, orb.y)
        soundSystem.xpCollect()
        xpGained += collected
      }
    }
    // Accumulator orb (gold heap that fills when cap is reached)
    if (this.accumulatorOrb) {
      if (this.accumulatorOrb.active) {
        const collected = this.accumulatorOrb.update(playerX, playerY, delta, effectiveMagnetRange)
        if (collected > 0) {
          this.effects.showXPCollect(this.accumulatorOrb.x, this.accumulatorOrb.y)
          soundSystem.xpCollect()
          xpGained += collected
          this.accumulatorOrb = null
        }
      } else {
        this.accumulatorOrb = null
      }
    }
    if (xpGained > 0) {
      const net = activeNetClient
      if (net) {
        net.send({ type: 'collectXP', amount: xpGained })
      } else {
        addXP(Math.round(xpGained * (1 + growthRank * 0.03) * difficultyScale.xp))
      }
    }

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
    compact(this.potions)

    // Enemy contact damage — per-enemy cooldown so hordes deal proportional damage
    {
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

    compact(this.projectiles)
    compact(this.orbs)
    compact(this.coins)

    // Aura (Garlic-style: always-visible field + knockback on damage pulse)
    this.auraGraphic.clear()
    if (aura > 0) {
      const radius = 60 + auraRange * 30
      this.auraAngle += delta * 0.0015

      // VS Garlic-style: per-enemy cooldown — immediate hit on first contact, re-hit only after interval
      const auraDmg = damage * aura
      const tickInterval = 700 - auraTick * 80
      for (const e of enemies) {
        if (!e.active || !this.isOnScreen(e.x, e.y)) continue
        const dx = e.x - playerX
        const dy = e.y - playerY
        if (dx * dx + dy * dy >= radius * radius) continue
        const lastHit = this.auraHitCooldowns.get(e) ?? 0
        if (now - lastHit >= tickInterval) {
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if ('knockbackDx' in e) {
            (e as any).knockbackDx = dx / dist
            ;(e as any).knockbackDy = dy / dist
          }
          this.applyAuraHit(e, auraDmg, playerX, playerY, coinDropChance, lifeDrain, vampiric)
          this.auraHitCooldowns.set(e, now)
          this.auraFlashTimer = 0
        }
      }
      // Prune dead enemies from cooldown map
      for (const [e] of this.auraHitCooldowns) {
        if (!e.active) this.auraHitCooldowns.delete(e)
      }

      // Aura hits braziers
      for (const [bId, b] of this.brazierTargets) {
        const dx = b.x - playerX, dy = b.y - playerY
        if (dx * dx + dy * dy < radius * radius) {
          const lastHit = this.brazierAuraCooldowns.get(bId) ?? 0
          if (now - lastHit >= tickInterval) {
            this.brazierAuraCooldowns.set(bId, now)
            activeNetClient?.send({ type: 'hitBrazier', brazierId: bId, damage: Math.round(auraDmg) })
          }
        }
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
      const ORBIT_RADIUS = 100 + orbRange * 30
      const ORB_RADIUS = 13 + orbRange * 2
      const ORB_HIT_RADIUS = 20 + orbRange * 3
      const HIT_COOLDOWN = 500
      const orbDamage = Math.max(1, Math.floor(weaponBaseDamage(level) * might * 0.65 * (1 + orbPower * 0.2)))

      this.orbAngle += delta * 0.0024 * (1 + orbSpeed * 0.35)

      // Smooth the orbit center so fast player movement doesn't distort apparent rotation speed
      if (!this.orbCenterInit) { this.orbCenterX = playerX; this.orbCenterY = playerY; this.orbCenterInit = true }
      const lag = 1 - Math.exp(-delta / 90)
      this.orbCenterX += (playerX - this.orbCenterX) * lag
      this.orbCenterY += (playerY - this.orbCenterY) * lag

      const orbCount = orbital + echo
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
        for (const [bId, bz] of this.brazierTargets) {
          const dx = bz.x - ox, dy = bz.y - oy
          if (dx * dx + dy * dy < (ORB_HIT_RADIUS + BRAZIER_HIT_R) ** 2) {
            const lastHit = this.orbHitCooldowns.get(bId as any) ?? 0
            if (now - lastHit >= HIT_COOLDOWN) {
              this.orbHitCooldowns.set(bId as any, now)
              activeNetClient?.send({ type: 'hitBrazier', brazierId: bId, damage: Math.round(orbDamage) })
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
          const toAngle = Math.atan2(target.y - playerY, target.x - playerX)
          const offsets: number[] = []
          for (let ei = 0; ei <= echo; ei++) offsets.push((ei - echo / 2) * 24)
          for (let i = offsets.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[offsets[i], offsets[j]] = [offsets[j], offsets[i]]
          }
          offsets.forEach((perpOff, s) =>
            this.boomerangQueue.push({ delay: s * WEAPON_STAGGER, perpOff, toAngle, tx: target.x, ty: target.y })
          )
        }
      }
      for (let q = this.boomerangQueue.length - 1; q >= 0; q--) {
        this.boomerangQueue[q].delay -= delta
        if (this.boomerangQueue[q].delay <= 0) {
          const { perpOff, toAngle, tx, ty } = this.boomerangQueue[q]
          const perpX = -Math.sin(toAngle), perpY = Math.cos(toAngle)
          this.boomerangs.push(new Boomerang(this.scene, playerX + perpX * perpOff, playerY + perpY * perpOff, tx, ty))
          soundSystem.shootBoomerang()
          this.boomerangQueue.splice(q, 1)
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
          if (dx * dx + dy * dy < (BOOMERANG_HIT_R + e.hitRadius) * (BOOMERANG_HIT_R + e.hitRadius)) {
            hitTargets.add(e)
            this.applyHit(e, Math.floor(damage * 1.5), coinDropChance, lifeDrain, vampiric)
          }
        }
        for (const [bId, bz] of this.brazierTargets) {
          if (hitTargets.has(bId as any)) continue
          const dx = b.x - bz.x, dy = b.y - bz.y
          if (dx * dx + dy * dy < (BOOMERANG_HIT_R + BRAZIER_HIT_R) ** 2) {
            hitTargets.add(bId as any)
            activeNetClient?.send({ type: 'hitBrazier', brazierId: bId, damage: Math.round(damage * 1.5) })
          }
        }
      }
      compact(this.boomerangs)
    }

    // === Bifrost Spear ===
    if (spear) {
      const burstCount  = 1 + spearCount
      const cooldown    = Math.max(400, SPEAR_BASE_CD - spearInterval * 100)   // 700/600/500/400 ms
      const pierceMax   = 3 + spearPierce                                       // 3/4/5 enemies
      const speed       = SPEAR_SPEED * (1 + spearSpeed * 0.1)
      const echoCount   = 1 + echo

      const fireSingle = (perpOffset: number) => {
        const fx = this.facingVx, fy = this.facingVy
        const perpX = -fy, perpY = fx
        for (let i = 0; i < echoCount; i++) {
          const echoOff = (i - (echoCount - 1) / 2) * 16
          const sx = playerX + perpX * (perpOffset + echoOff)
          const sy = playerY + perpY * (perpOffset + echoOff)
          const proj = new Projectile(this.scene, sx, sy, sx + fx * 100, sy + fy * 100, 'spear_sprite', speed, 0.07, Math.PI / 2)
          proj.maxHits   = pierceMax
          proj.hitRadius = SPEAR_HIT_R
          this.spearProjectiles.push(proj)
        }
        soundSystem.shootWand()
      }

      const enqueueVolley = () => {
        const offsets: number[] = []
        for (let s = 0; s < burstCount; s++)
          offsets.push((s - (burstCount - 1) / 2) * SPEAR_PERP_GAP)
        // shuffle so spears don't fire in neat bottom-to-top order
        for (let i = offsets.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[offsets[i], offsets[j]] = [offsets[j], offsets[i]]
        }
        offsets.forEach((perpOffset, s) =>
          this.spearQueue.push({ delay: s * WEAPON_STAGGER, perpOffset })
        )
      }

      if (spearStorm) {
        // Thousand Spears: fire the full parallel set very rapidly
        this.spearCooldownTimer += delta
        if (this.spearCooldownTimer >= SPEAR_STORM_INTERVAL) {
          this.spearCooldownTimer -= SPEAR_STORM_INTERVAL
          enqueueVolley()
        }
      } else {
        this.spearCooldownTimer += delta
        if (this.spearCooldownTimer >= cooldown) {
          this.spearCooldownTimer = 0
          enqueueVolley()
        }
      }
      for (let q = this.spearQueue.length - 1; q >= 0; q--) {
        this.spearQueue[q].delay -= delta
        if (this.spearQueue[q].delay <= 0) {
          fireSingle(this.spearQueue[q].perpOffset)
          this.spearQueue.splice(q, 1)
        }
      }

      for (const p of this.spearProjectiles) {
        if (!p.active) continue
        p.update(delta)
        if (!p.active) continue
        const camWVS = this.scene.cameras.main.worldView
        if (p.x < camWVS.left - 200 || p.x > camWVS.right + 200 ||
            p.y < camWVS.top  - 200 || p.y > camWVS.bottom + 200) {
          p.destroy(); continue
        }
        for (const e of enemies) {
          if (!e.active || p.hitTargets.has(e)) continue
          const dx = p.x - e.x, dy = p.y - e.y
          const hitDist = p.hitRadius + e.hitRadius
          if (dx * dx + dy * dy < hitDist * hitDist) {
            this.applyHit(e, damage, coinDropChance, lifeDrain, vampiric)
            p.hitTargets.add(e)
            if (p.maxHits > 0 && p.hitTargets.size >= p.maxHits) { p.destroy(); break }
          }
        }
        for (const [bId, bz] of this.brazierTargets) {
          if (p.hitTargets.has(bId as any)) continue
          const dx = p.x - bz.x, dy = p.y - bz.y
          if (dx * dx + dy * dy < (p.hitRadius + BRAZIER_HIT_R) ** 2) {
            p.hitTargets.add(bId as any)
            activeNetClient?.send({ type: 'hitBrazier', brazierId: bId, damage: Math.round(damage) })
          }
        }
      }
      compact(this.spearProjectiles)
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
      const flameDmg = Math.max(1, Math.floor(weaponBaseDamage(level) * might * 0.4))
      for (const f of this.flamePools) {
        f.timer -= delta
        f.tickTimer -= delta
        if (f.tickTimer <= 0) {
          f.tickTimer += FLAME_TICK
          for (const e of enemies) {
            if (!e.active || !this.isOnScreen(e.x, e.y)) continue
            const dx = e.x - f.x
            const dy = e.y - f.y
            if (dx * dx + dy * dy < (FLAME_RADIUS + e.hitRadius) * (FLAME_RADIUS + e.hitRadius)) {
              this.applyHit(e, flameDmg, coinDropChance, lifeDrain, vampiric)
            }
          }
        }
        if (f.timer <= 0) f.emitter.destroy()
      }
      let _fi = 0; while (_fi < this.flamePools.length) {
        if (this.flamePools[_fi].timer > 0) { _fi++; continue }
        this.flamePools[_fi] = this.flamePools[this.flamePools.length - 1]; this.flamePools.pop()
      }
    }

    // === Blood Nova ===
    if (bloodNova) {
      this.bloodNovaTimer += delta
      const novaInterval = Math.max(10000, NOVA_INTERVAL - bloodNovaCD * 10000)
      if (this.bloodNovaTimer >= novaInterval) {
        this.bloodNovaTimer = 0
        const novaDmg = Math.floor(weaponBaseDamage(level) * might * 30)
        this.fireBloodNova(playerX, playerY, novaDmg, enemies, coinDropChance, lifeDrain, vampiric)
      }
    }

    // === War Axe ===
    if (axeEvolution) {
      // Death Spiral: slow piercing axes carpet the arena as you move
      if (!this.berserkerRing) {
        this.berserkerRing = new BerserkerRing(this.scene, axePierce)
        for (const a of this.axes) a.destroy()
        this.axes = []
        this.axeQueue = []
      }
      if (this.berserkerRing.update(delta, playerX, playerY)) soundSystem.shootAxe()
      const spiralDamage = Math.floor(weaponBaseDamage(level) * might * AXE_DAMAGE_MULT * (1 + axeDamage * 0.5))
      const spiralHits = this.berserkerRing.checkHits(enemies)
      for (const e of spiralHits) {
        this.applyHit(e, spiralDamage, coinDropChance, lifeDrain, vampiric)
      }
    } else if (axe) {
      if (this.berserkerRing) {
        this.berserkerRing.destroy()
        this.berserkerRing = null
      }
      this.axeTimer += delta
      if (this.axeTimer >= AXE_INTERVAL) {
        this.axeTimer = 0
        // Use player facing direction — update stored dir only when there is horizontal movement
        if (this.facingVx !== 0) this.axeDir = this.facingVx > 0 ? 1 : -1
        const dirX = this.axeDir
        const axeCount = 1 + axeAmount + echo
        for (let i = 0; i < axeCount; i++) {
          const angle = Math.min(AXE_BASE_ANGLE + i * AXE_ANGLE_STEP, AXE_ANGLE_MAX)
          const vx = Math.sin(angle) * dirX * AXE_SPEED_MAG
          const vy = -Math.cos(angle) * AXE_SPEED_MAG
          this.axeQueue.push({ delay: i * AXE_STAGGER, vx, vy })
        }
      }
      for (let q = this.axeQueue.length - 1; q >= 0; q--) {
        this.axeQueue[q].delay -= delta
        if (this.axeQueue[q].delay <= 0) {
          const { vx, vy } = this.axeQueue[q]
          this.axes.push(new Axe(this.scene, playerX, playerY, vx, vy, axePierce))
          soundSystem.shootAxe()
          this.axeQueue.splice(q, 1)
        }
      }
      const throwDamage = Math.floor(weaponBaseDamage(level) * might * AXE_DAMAGE_MULT * (1 + axeDamage * 0.5))
      for (const a of this.axes) {
        if (!a.active) continue
        a.update(delta)
        if (!a.active) continue
        for (const e of enemies) {
          if (!e.active || a.currentHitTargets.has(e)) continue
          const dx = a.x - e.x
          const dy = a.y - e.y
          if (dx * dx + dy * dy < (a.hitRadius + e.hitRadius) * (a.hitRadius + e.hitRadius)) {
            a.currentHitTargets.add(e)
            this.applyHit(e, throwDamage, coinDropChance, lifeDrain, vampiric)
          }
        }
        for (const [bId, bz] of this.brazierTargets) {
          if (a.currentHitTargets.has(bId as any)) continue
          const dx = a.x - bz.x, dy = a.y - bz.y
          if (dx * dx + dy * dy < (a.hitRadius + BRAZIER_HIT_R) ** 2) {
            a.currentHitTargets.add(bId as any)
            activeNetClient?.send({ type: 'hitBrazier', brazierId: bId, damage: Math.round(throwDamage) })
          }
        }
      }
      compact(this.axes)
    } else {
      if (this.berserkerRing) {
        this.berserkerRing.destroy()
        this.berserkerRing = null
      }
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
        const targetCount = LIGHTNING_TARGETS + lightningTargets + echo
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

    // === Odin's Ravens ===
    // The raven companion follows/trails the player. A zone circle orbits the player at
    // RAVENS_ZONE_ORBIT_R. The raven fires bursts of projectiles FROM its position (near player)
    // TOWARD the zone — exactly like VS Peachone/Ebony Wings.
    this.ravensGraphic.clear()
    if (ravens) {
      const cooldown = Math.max(2000, RAVENS_BASE_CD - ravensCD * RAVENS_CD_STEP)
      const BOMBS_PER_SET = 4 + ravensCount * 2
      const BURST_TOTAL = RAVENS_BURST_SETS * RAVENS_SET_DELAY
      const ravensDmg = Math.max(1, Math.floor(weaponBaseDamage(level) * might * 0.5 * (1 + ravensPower * 0.2)))

      // Zone circles orbit directly around player at fixed radius (A and B at 180° apart)
      this.ravensZoneAngle -= delta * RAVENS_ROT_SPEED

      // VS-style: birds orbit a tilted ellipse — tilt follows zone angle so the sweep
      // direction slowly rotates, giving the Peachone/Ebony-Wings diagonal feel
      const BIRD_RX = 60, BIRD_RY = 26
      this.ravensBirdAngle += delta * 0.0022

      const cosT = Math.cos(this.ravensZoneAngle), sinT = Math.sin(this.ravensZoneAngle)
      const eaX = BIRD_RX * Math.cos(this.ravensBirdAngle)
      const eaY = BIRD_RY * Math.sin(this.ravensBirdAngle)
      const bx = playerX + eaX * cosT - eaY * sinT
      const by = playerY + eaX * sinT + eaY * cosT

      const ebX = BIRD_RX * Math.cos(this.ravensBirdAngle + Math.PI)
      const ebY = BIRD_RY * Math.sin(this.ravensBirdAngle + Math.PI)
      const bx2 = playerX + ebX * cosT - ebY * sinT
      const by2 = playerY + ebX * sinT + ebY * cosT

      const zx = playerX + Math.cos(this.ravensZoneAngle) * RAVENS_ZONE_ORBIT_R
      const zy = playerY + Math.sin(this.ravensZoneAngle) * RAVENS_ZONE_ORBIT_R
      const zx2 = playerX + Math.cos(this.ravensZoneAngle + Math.PI) * RAVENS_ZONE_ORBIT_R
      const zy2 = playerY + Math.sin(this.ravensZoneAngle + Math.PI) * RAVENS_ZONE_ORBIT_R

      // Burst timing
      if (!this.ravensBurstActive) {
        this.ravensCooldownTimer += delta
        if (this.ravensCooldownTimer >= cooldown) {
          this.ravensCooldownTimer = 0
          this.ravensBurstActive = true
          this.ravensBurstAge = 0
          this.ravensBurstSetsLeft = RAVENS_BURST_SETS
          this.ravensBurstSetTimer = 0
        }
      } else {
        this.ravensBurstAge += delta
        this.ravensBurstSetTimer -= delta
        if (this.ravensBurstSetsLeft > 0 && this.ravensBurstSetTimer <= 0) {
          this.ravensBurstSetTimer += RAVENS_SET_DELAY
          this.ravensBurstSetsLeft--
          if (this.ravensBurstSetsLeft === RAVENS_BURST_SETS - 1) soundSystem.shootBoomerang()
          // Fire from both ravens simultaneously — A toward zone A, B toward zone B
          const curveSign = this.ravensBurstSetsLeft % 2 === 0 ? 1 : -1
          const baseAngleA = Math.atan2(zy - by, zx - bx)
          const baseAngleB = Math.atan2(zy2 - by2, zx2 - bx2)
          for (let bi = 0; bi < BOMBS_PER_SET; bi++) {
            const t = BOMBS_PER_SET > 1 ? bi / (BOMBS_PER_SET - 1) : 0.5
            const spreadOffset = (t - 0.5) * RAVENS_BOMB_SPREAD
            const angleA = baseAngleA + spreadOffset
            this.ravensBombs.push({
              x: bx, y: by,
              vx: Math.cos(angleA) * RAVENS_BOMB_SPEED,
              vy: Math.sin(angleA) * RAVENS_BOMB_SPEED,
              angle: angleA,
              curveRate: curveSign * 0.0028,
              age: 0, maxAge: RAVENS_BOMB_MAX_AGE,
              hitEnemies: new Set(),
            })
            const angleB = baseAngleB + spreadOffset
            this.ravensBombs.push({
              x: bx2, y: by2,
              vx: Math.cos(angleB) * RAVENS_BOMB_SPEED,
              vy: Math.sin(angleB) * RAVENS_BOMB_SPEED,
              angle: angleB,
              curveRate: -curveSign * 0.0028,
              age: 0, maxAge: RAVENS_BOMB_MAX_AGE,
              hitEnemies: new Set(),
            })
          }
        }
        if (this.ravensBurstAge >= BURST_TOTAL + RAVENS_SET_DELAY) {
          this.ravensBurstActive = false
        }
      }

      // Move bombs + infinite-pierce collision
      for (const b of this.ravensBombs) {
        // Rotate velocity vector for curved Ebony Wings-style arc
        const cr = b.curveRate * delta
        const cosR = Math.cos(cr), sinR = Math.sin(cr)
        const nvx = b.vx * cosR - b.vy * sinR
        b.vy = b.vx * sinR + b.vy * cosR
        b.vx = nvx
        b.x += b.vx * (delta / 1000)
        b.y += b.vy * (delta / 1000)
        b.age += delta
        for (const e of enemies) {
          if (!e.active || b.hitEnemies.has(e)) continue
          const bdx = b.x - e.x, bdy = b.y - e.y
          if (bdx * bdx + bdy * bdy < (RAVENS_BOMB_HIT_R + e.hitRadius) * (RAVENS_BOMB_HIT_R + e.hitRadius)) {
            b.hitEnemies.add(e)
            this.applyHit(e, ravensDmg, coinDropChance, lifeDrain, vampiric)
          }
        }
        for (const [bId, bz] of this.brazierTargets) {
          if (b.hitEnemies.has(bId as any)) continue
          const bdx = b.x - bz.x, bdy = b.y - bz.y
          if (bdx * bdx + bdy * bdy < (RAVENS_BOMB_HIT_R + BRAZIER_HIT_R) ** 2) {
            b.hitEnemies.add(bId as any)
            activeNetClient?.send({ type: 'hitBrazier', brazierId: bId, damage: Math.round(ravensDmg) })
          }
        }
      }
      let _ri = 0; while (_ri < this.ravensBombs.length) {
        if (this.ravensBombs[_ri].age < this.ravensBombs[_ri].maxAge) { _ri++; continue }
        this.ravensBombs[_ri] = this.ravensBombs[this.ravensBombs.length - 1]; this.ravensBombs.pop()
      }

      // --- Zone circle visual ---
      const chargeFrac = !this.ravensBurstActive
        ? Math.max(0, (this.ravensCooldownTimer - (cooldown - 600)) / 600)
        : 0
      const burstFade = this.ravensBurstActive
        ? Math.max(0, 1 - this.ravensBurstAge / (BURST_TOTAL + RAVENS_SET_DELAY))
        : 0

      const drawZone = (cx: number, cy: number) => {
        if (this.ravensBurstActive && burstFade > 0.05) {
          const pulse = 0.72 + 0.28 * Math.sin(this.ravensBurstAge * 0.028)
          this.ravensGraphic.fillStyle(0x00cc44, 0.13 * pulse * burstFade)
          this.ravensGraphic.fillCircle(cx, cy, RAVENS_ZONE_VIS_R * 1.75)
          this.ravensGraphic.fillStyle(0x33ff66, 0.23 * pulse * burstFade)
          this.ravensGraphic.fillCircle(cx, cy, RAVENS_ZONE_VIS_R * 1.1)
          this.ravensGraphic.fillStyle(0x88ffaa, 0.30 * pulse * burstFade)
          this.ravensGraphic.fillCircle(cx, cy, RAVENS_ZONE_VIS_R)
          this.ravensGraphic.lineStyle(3, 0x44ff88, 0.92 * burstFade)
          this.ravensGraphic.strokeCircle(cx, cy, RAVENS_ZONE_VIS_R)
          this.ravensGraphic.lineStyle(1.5, 0xffffff, 0.50 * burstFade)
          this.ravensGraphic.strokeCircle(cx, cy, RAVENS_ZONE_VIS_R * 0.52)
          for (let i = 0; i < 4; i++) {
            const a = this.ravensZoneAngle * 2 + (i / 4) * Math.PI * 2
            this.ravensGraphic.lineStyle(2, 0x44ff88, 0.78 * burstFade)
            this.ravensGraphic.beginPath()
            this.ravensGraphic.arc(cx, cy, RAVENS_ZONE_VIS_R * 0.78, a, a + 0.62, false)
            this.ravensGraphic.strokePath()
            const tipA = a + 0.62
            this.ravensGraphic.fillStyle(0xffffff, 0.82 * burstFade)
            this.ravensGraphic.fillCircle(cx + Math.cos(tipA) * RAVENS_ZONE_VIS_R * 0.78, cy + Math.sin(tipA) * RAVENS_ZONE_VIS_R * 0.78, 2)
          }
        } else if (chargeFrac > 0.05) {
          this.ravensGraphic.fillStyle(0x007722, 0.09 * chargeFrac)
          this.ravensGraphic.fillCircle(cx, cy, RAVENS_ZONE_VIS_R * 1.4)
          this.ravensGraphic.lineStyle(2.5, 0x00aa44, 0.62 * chargeFrac)
          this.ravensGraphic.strokeCircle(cx, cy, RAVENS_ZONE_VIS_R)
          this.ravensGraphic.lineStyle(1, 0x44ff88, 0.28 * chargeFrac)
          this.ravensGraphic.strokeCircle(cx, cy, RAVENS_ZONE_VIS_R * 0.52)
        } else {
          this.ravensGraphic.lineStyle(1.5, 0x003311, 0.24)
          this.ravensGraphic.strokeCircle(cx, cy, RAVENS_ZONE_VIS_R)
        }
      }
      drawZone(zx, zy)
      drawZone(zx2, zy2)

      // --- Bomb projectiles: curved green feather orbs ---
      for (const b of this.ravensBombs) {
        const ageFrac = b.age / b.maxAge
        const alpha = ageFrac < 0.12 ? ageFrac / 0.12 : 1 - (ageFrac - 0.12) / 0.88
        this.ravensGraphic.fillStyle(0x00cc44, alpha * 0.22)
        this.ravensGraphic.fillCircle(b.x, b.y, 12)
        this.ravensGraphic.fillStyle(0x001408, alpha * 0.96)
        this.ravensGraphic.fillCircle(b.x, b.y, 5.5)
        this.ravensGraphic.lineStyle(1.5, 0x44ff88, alpha * 0.85)
        this.ravensGraphic.strokeCircle(b.x, b.y, 5.5)
        this.ravensGraphic.fillStyle(0xaaffd0, alpha * 0.55)
        this.ravensGraphic.fillCircle(b.x - 1.8, b.y - 1.8, 1.8)
      }

      // --- Raven sprites (Huginn & Muninn) ---
      this.ravensWingPhase += delta * 0.009
      const RAVEN_SCALE = 0.15
      const scaleY = RAVEN_SCALE * (0.5 + 0.5 * Math.abs(Math.sin(this.ravensWingPhase)))

      // Attack glow under each sprite when burst is active
      if (this.ravensBurstActive) {
        const ag = 0.5 + 0.5 * Math.sin(this.ravensBurstAge * 0.02)
        this.ravensGraphic.fillStyle(0x00cc44, 0.18 * ag)
        this.ravensGraphic.fillCircle(bx, by, 30)
        this.ravensGraphic.fillStyle(0x00cc44, 0.18 * ag)
        this.ravensGraphic.fillCircle(bx2, by2, 30)
      }

      // Velocity direction from ellipse derivative — used for facing/tilt, never full rotation
      const vxA = -BIRD_RX * Math.sin(this.ravensBirdAngle) * cosT - BIRD_RY * Math.cos(this.ravensBirdAngle) * sinT
      const vyA = -BIRD_RX * Math.sin(this.ravensBirdAngle) * sinT + BIRD_RY * Math.cos(this.ravensBirdAngle) * cosT
      const facingRightA = vxA > 0
      const tiltRawA = Math.atan2(vyA, Math.abs(vxA))
      const tiltA = Math.max(-0.38, Math.min(0.38, facingRightA ? -tiltRawA : tiltRawA))

      this.ravenSpriteA
        .setPosition(bx, by)
        .setFlipX(facingRightA)
        .setRotation(tiltA)
        .setScale(RAVEN_SCALE, scaleY)
        .setVisible(true)

      // Bird B velocity is exactly opposite to A
      const facingRightB = !facingRightA
      const tiltRawB = Math.atan2(-vyA, Math.abs(vxA))
      const tiltB = Math.max(-0.38, Math.min(0.38, facingRightB ? -tiltRawB : tiltRawB))

      this.ravenSpriteB
        .setPosition(bx2, by2)
        .setFlipX(facingRightB)
        .setRotation(tiltB)
        .setScale(RAVEN_SCALE, scaleY)
        .setVisible(true)
    } else {
      this.ravenSpriteA.setVisible(false)
      this.ravenSpriteB.setVisible(false)
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

    if (this.frameDamage > 0) {
      useGameStore.getState().addDamage(this.frameDamage)
      this.frameDamage = 0
    }
  }

  private spawnFlame(x: number, y: number) {
    const emitter = this.scene.add.particles(x, y, 'flame_particle', {
      color: [0xff8844, 0xff4500, 0xcc2200, 0x881100],
      colorEase: 'quad.in',
      lifespan: { min: 320, max: 580 },
      speedX: { min: -10, max: 10 },
      speedY: { min: -120, max: -65 },
      scaleX: { start: 0.65, end: 0.05 },
      scaleY: { start: 1.5, end: 0 },
      alpha: { start: 0.92, end: 0 },
      quantity: 6,
      frequency: 38,
      blendMode: 'ADD',
      duration: FLAME_DURATION,
      emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 46, 14) } as any,
    })
    emitter.setDepth(1.5)
    this.flamePools.push({ x, y, timer: FLAME_DURATION + 650, tickTimer: 0, emitter })
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

  private fireSunBeams(px: number, py: number, gold: boolean, maxPierces: number) {
    const MOVE_OFFSET = 20
    const spawnX = this.playerMoving ? px + this.facingVx * MOVE_OFFSET : px
    const spawnY = this.playerMoving ? py + this.facingVy * MOVE_OFFSET : py
    // Aim toward 16:9 screen corners: angle = arctan(9/16) ≈ 29.4° from horizontal
    const cosA = DUAL_GUN_SPEED * (16 / Math.sqrt(16 * 16 + 9 * 9))
    const sinA = DUAL_GUN_SPEED * (9  / Math.sqrt(16 * 16 + 9 * 9))
    for (const [vx, vy] of [[cosA, -sinA], [cosA, sinA], [-cosA, sinA], [-cosA, -sinA]] as [number, number][]) {
      this.sunBeams.push(new SunBeam(this.scene, spawnX, spawnY, vx, vy, gold, maxPierces))
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
    this.frameDamage += actual
    this.effects.showDamageNumber(e.x, e.y, actual)
    soundSystem.enemyHit()
    if (vampiric) {
      this.vampiricPool += actual * VAMPIRIC_PERCENT
      if (this.vampiricPool >= 1) {
        const heal = Math.floor(this.vampiricPool)
        this.vampiricPool -= heal
        useGameStore.setState(s => s.isDead ? {} : { hp: Math.min(s.maxHp, s.hp + heal) })
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
    this.frameDamage += actual
    this.effects.showDamageNumber(e.x, e.y, actual)
    soundSystem.enemyHit()
    if (vampiric) {
      this.vampiricPool += actual * VAMPIRIC_PERCENT
      if (this.vampiricPool >= 1) {
        const heal = Math.floor(this.vampiricPool)
        this.vampiricPool -= heal
        useGameStore.setState(s => s.isDead ? {} : { hp: Math.min(s.maxHp, s.hp + heal) })
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
      useGameStore.setState(s => s.isDead ? {} : { hp: Math.min(s.maxHp, s.hp + lifeDrain) })
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

  spawnBrazierDrop(drop: 'coin' | 'coinBag' | 'hp' | 'xp' | 'magnet' | 'freeze' | 'divineWrath' | 'rerollDie', x: number, y: number) {
    switch (drop) {
      case 'coin':
        this.coins.push(new CoinOrb(this.scene, x, y))
        this.effects.showItemCollect(x, y - 20, '◈ +1', 0xffcc44, 18)
        break
      case 'coinBag':
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2
          this.coins.push(new CoinOrb(this.scene, x + Math.cos(a) * 16, y + Math.sin(a) * 16))
        }
        this.effects.showItemCollect(x, y - 20, '◈ +3', 0xffcc44, 18)
        break
      case 'hp':
        this.potions.push(new HealthPotion(this.scene, x, y))
        this.effects.showItemCollect(x, y - 20, '+ HP POTION', 0x44ff88, 18)
        break
      case 'xp':
        for (let i = 0; i < 4; i++) {
          if (this.orbs.length >= MAX_ORBS) break
          const a = (i / 4) * Math.PI * 2
          this.orbs.push(new XPOrb(this.scene, x + Math.cos(a) * 20, y + Math.sin(a) * 20, 25))
        }
        this.effects.showItemCollect(x, y - 20, '+ XP BURST', 0xaaddff, 18)
        break
      case 'magnet':
        this.orbMagnetTimer = 3000
        this.effects.showItemCollect(x, y - 20, 'MAGNET!', 0xcc88ff, 18)
        break
      case 'freeze':
        this.effects.showItemCollect(x, y - 20, 'FROZEN!', 0x88ccff, 22)
        break
      case 'divineWrath':
        this.effects.showItemCollect(x, y - 20, 'DIVINE WRATH!', 0xffdd44, 22)
        break
      case 'rerollDie':
        this.effects.showItemCollect(x, y - 20, 'REROLL +1', 0xcc88ff, 20)
        break
    }
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
      const ox = x + Math.cos(sa) * sr
      const oy = y + Math.sin(sa) * sr
      if (this.orbs.length < MAX_ORBS) {
        this.orbs.push(new XPOrb(this.scene, ox, oy, xpValue, orbTierForValue(xpValue)))
      } else if (!this.accumulatorOrb || !this.accumulatorOrb.active) {
        this.accumulatorOrb = new XPOrb(this.scene, ox, oy, xpValue, 'gold')
        this.accumulatorOrb.makeAccumulator()
      } else {
        this.accumulatorOrb.addValue(xpValue)
      }
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

  private findNNearest(px: number, py: number, enemies: AnyEnemy[], n: number, maxRange = Infinity): AnyEnemy[] {
    const TEAMMATE_CLEAR_R = 60 * 60
    const maxRange2 = maxRange * maxRange
    const remotes = minimapData.remotePlayers
    const preferred: { e: AnyEnemy; dist: number }[] = []
    const fallback:  { e: AnyEnemy; dist: number }[] = []
    for (const e of enemies) {
      if (!e.active || !this.isOnScreen(e.x, e.y)) continue
      const dx = e.x - px
      const dy = e.y - py
      const dist = dx * dx + dy * dy
      if (dist > maxRange2) continue
      const nearTeammate = remotes.some(rp => {
        const rdx = e.x - rp.x, rdy = e.y - rp.y
        return rdx * rdx + rdy * rdy < TEAMMATE_CLEAR_R
      })
      ;(nearTeammate ? fallback : preferred).push({ e, dist })
    }
    const sorted = [...preferred.sort((a, b) => a.dist - b.dist), ...fallback.sort((a, b) => a.dist - b.dist)]
    return sorted.slice(0, n).map(o => o.e)
  }
}
