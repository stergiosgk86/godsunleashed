import Phaser from 'phaser'

const GRAVITY   = 780  // px/s²
const LAUNCH_VY = -580 // upward
const SPEED_X   = 160  // horizontal
const LAND_BELOW = 280 // px below launch before destroying
const HIT_R     = 20

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
  // separate hit sets for ascent vs descent — each enemy can be hit once each way
  hitTargetsUp   = new Set<object>()
  hitTargetsDown = new Set<object>()

  get hitRadius() { return HIT_R }

  get currentHitTargets() {
    return this.peaked ? this.hitTargetsDown : this.hitTargetsUp
  }

  constructor(scene: Phaser.Scene, x: number, y: number, dirX: number) {
    this.x = x
    this.y = y
    this.startY = y
    this.vx = dirX * SPEED_X
    this.vy = LAUNCH_VY
    this.image = scene.add.image(x, y, 'axe').setDepth(4).setScale(0.5)
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
