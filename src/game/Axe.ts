import Phaser from 'phaser'

const GRAVITY    = 780  // px/s²
const LAUNCH_VY  = -580 // upward
const SPEED_X    = 80   // horizontal
const LAND_BELOW = 650  // px below launch before destroying
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

  constructor(scene: Phaser.Scene, x: number, y: number, dirX: number, pierceLevel = 0) {
    this.x = x
    this.y = y
    this.startY = y
    this.vx = dirX * SPEED_X
    this.vy = LAUNCH_VY
    this._hitRadius = BASE_HIT_R + pierceLevel * 10
    this.image = scene.add.image(x, y, 'axe').setDepth(4).setScale(0.5 + pierceLevel * 0.25)
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

// ── Berserker's Ring: orbiting ring of axes ──────────────────────────────────
const DS_COUNT        = 6
const DS_RADIUS       = 125   // px from player centre
const DS_SPEED        = 4.5   // rad/s — orbit speed
const DS_SELF_SPIN    = 10.0  // rad/s — each axe spins on its own centre
const DS_HIT_R        = 22    // collision radius per axe
const DS_HIT_COOLDOWN = 500   // ms before the same enemy can be hit again

export class BerserkerRing {
  private images: Phaser.GameObjects.Image[] = []
  private angle = 0
  private spinAngle = 0
  private hitCooldowns = new Map<object, number>()

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < DS_COUNT; i++) {
      this.images.push(scene.add.image(0, 0, 'axe').setDepth(4).setScale(0.6).setAlpha(0.92))
    }
  }

  update(delta: number, playerX: number, playerY: number): void {
    this.angle     += DS_SPEED     * delta / 1000
    this.spinAngle += DS_SELF_SPIN * delta / 1000
    for (let i = 0; i < DS_COUNT; i++) {
      const a = this.angle + (i * Math.PI * 2 / DS_COUNT)
      const ix = playerX + Math.cos(a) * DS_RADIUS
      const iy = playerY + Math.sin(a) * DS_RADIUS
      this.images[i].setPosition(ix, iy).setRotation(this.spinAngle)
    }
    // tick down per-enemy hit cooldowns
    for (const [e, remaining] of this.hitCooldowns) {
      const next = remaining - delta
      if (next <= 0) this.hitCooldowns.delete(e)
      else this.hitCooldowns.set(e, next)
    }
  }

  checkHits<T extends { active: boolean; x: number; y: number; hitRadius: number }>(enemies: T[], playerX: number, playerY: number): T[] {
    const hit: T[] = []
    const alreadyHitThisFrame = new Set<object>()
    for (let i = 0; i < DS_COUNT; i++) {
      const a = this.angle + (i * Math.PI * 2 / DS_COUNT)
      const ix = playerX + Math.cos(a) * DS_RADIUS
      const iy = playerY + Math.sin(a) * DS_RADIUS
      for (const e of enemies) {
        if (!e.active || this.hitCooldowns.has(e) || alreadyHitThisFrame.has(e)) continue
        const dx = ix - e.x
        const dy = iy - e.y
        if (dx * dx + dy * dy < (DS_HIT_R + e.hitRadius) * (DS_HIT_R + e.hitRadius)) {
          this.hitCooldowns.set(e, DS_HIT_COOLDOWN)
          alreadyHitThisFrame.add(e)
          hit.push(e)
        }
      }
    }
    return hit
  }

  destroy(): void {
    for (const img of this.images) img.destroy()
    this.images = []
  }
}
