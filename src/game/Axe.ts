import Phaser from 'phaser'

const GRAVITY    = 780  // px/s²
const LAND_BELOW = 400  // px below launch before destroying
const BASE_HIT_R = 20

export class Axe {
  x: number
  y: number
  active = true
  private vx: number
  private vy: number
  private startY: number
  private spinAngle = 0
  private peaked = false
  private image: Phaser.GameObjects.Image
  private _hitRadius: number
  // separate hit sets for ascent vs descent — each enemy can be hit once each way
  hitTargetsUp   = new Set<object>()
  hitTargetsDown = new Set<object>()

  get hitRadius() { return this._hitRadius }

  get currentHitTargets() {
    return this.peaked ? this.hitTargetsDown : this.hitTargetsUp
  }

  constructor(scene: Phaser.Scene, x: number, y: number, launchVx: number, launchVy: number, pierceLevel = 0) {
    this.x = x
    this.y = y
    this.startY = y
    this.vx = launchVx
    this.vy = launchVy
    this._hitRadius = BASE_HIT_R + pierceLevel * 10
    this.image = scene.add.image(x, y, 'axe').setDepth(4).setScale(0.0625 + pierceLevel * 0.03125)
  }

  update(delta: number) {
    const dt = delta / 1000
    this.vy += GRAVITY * dt
    this.x  += this.vx * dt
    this.y  += this.vy * dt
    this.spinAngle += 0.015 * delta * Math.sign(this.vx)

    if (!this.peaked && this.vy > 0) this.peaked = true
    if (this.peaked && this.y > this.startY + LAND_BELOW) { this.destroy(); return }

    this.image.setPosition(this.x, this.y)
    this.image.setRotation(this.spinAngle)
  }

  destroy() {
    this.image.destroy()
    this.active = false
  }
}

// ── Death Spiral: burst of axes one at a time, then cooldown, then next burst ──
const DS_SPEED_PX        = 88            // px/s — slow travel so axes linger on screen
const DS_HIT_R           = 30            // base collision radius per axe (large)
const DS_PIERCE_BONUS    = 8             // extra hitRadius per pierce upgrade level
const DS_LIFETIME        = 5000          // ms before axe despawns (~440 px at full speed)
const DS_AXES_PER_CIRCLE = 9             // axes per burst — matches VS Death Spiral base count
const DS_FIRE_MS         = 50            // ms between axes within a burst (VS uses 0.05s)
const DS_COOLDOWN_MS     = 3500          // ms pause after completing one circle (VS uses 4.0s)
const DS_SELF_SPIN       = 7.0           // rad/s spin on own axis
const DS_ANGLE_STEP      = Math.PI * 2 / 9  // 40° per shot → 9 shots = full circle

class DeathSpiralAxe {
  x: number
  y: number
  active = true
  hitTargets = new Set<object>()   // unlimited pierce: each enemy hit once per axe
  private vx: number
  private vy: number
  private spinAngle = 0
  private timeLeft = DS_LIFETIME
  private image: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene, x: number, y: number, angle: number, pierceLevel: number) {
    this.x = x
    this.y = y
    this.vx = Math.cos(angle) * DS_SPEED_PX
    this.vy = Math.sin(angle) * DS_SPEED_PX
    this.image = scene.add.image(x, y, 'axe')
      .setDepth(4)
      .setScale(0.05625 + pierceLevel * 0.0125)
      .setAlpha(0.92)
  }

  update(delta: number): void {
    const dt = delta / 1000
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.spinAngle += DS_SELF_SPIN * dt
    this.timeLeft -= delta
    if (this.timeLeft <= 0) { this.destroy(); return }
    this.image.setPosition(this.x, this.y).setRotation(this.spinAngle)
  }

  destroy(): void {
    this.image.destroy()
    this.active = false
  }
}

export class BerserkerRing {
  private projectiles: DeathSpiralAxe[] = []
  private fireTimer: number
  private burstCount = 0   // how many axes fired in the current burst
  private angle = 0
  private scene: Phaser.Scene
  private pierceLevel: number

  constructor(scene: Phaser.Scene, pierceLevel = 0) {
    this.scene = scene
    this.pierceLevel = pierceLevel
    // Pre-charge so the first axe fires immediately on pickup
    this.fireTimer = DS_FIRE_MS
  }

  /** Returns true if an axe was fired this frame (for sound cue). */
  update(delta: number, playerX: number, playerY: number): boolean {
    this.fireTimer += delta
    let fired = false

    if (this.burstCount < DS_AXES_PER_CIRCLE) {
      // Burst phase: fire one axe every DS_FIRE_MS
      if (this.fireTimer >= DS_FIRE_MS) {
        this.fireTimer -= DS_FIRE_MS
        this.projectiles.push(new DeathSpiralAxe(this.scene, playerX, playerY, this.angle, this.pierceLevel))
        this.angle += DS_ANGLE_STEP
        this.burstCount++
        fired = true
      }
    } else {
      // Cooldown phase: wait before starting the next circle
      if (this.fireTimer >= DS_COOLDOWN_MS) {
        this.fireTimer = DS_FIRE_MS  // pre-charge so next burst starts immediately
        this.burstCount = 0
      }
    }

    for (const a of this.projectiles) a.update(delta)
    this.projectiles = this.projectiles.filter(a => a.active)
    return fired
  }

  checkHits<T extends { active: boolean; x: number; y: number; hitRadius: number }>(enemies: T[]): T[] {
    const hit: T[] = []
    for (const a of this.projectiles) {
      if (!a.active) continue
      const rSum = DS_HIT_R + this.pierceLevel * DS_PIERCE_BONUS
      for (const e of enemies) {
        if (!e.active || a.hitTargets.has(e)) continue
        const dx = a.x - e.x
        const dy = a.y - e.y
        if (dx * dx + dy * dy < (rSum + e.hitRadius) * (rSum + e.hitRadius)) {
          a.hitTargets.add(e)
          hit.push(e)
        }
      }
    }
    return hit
  }

  destroy(): void {
    for (const a of this.projectiles) a.destroy()
    this.projectiles = []
  }
}
