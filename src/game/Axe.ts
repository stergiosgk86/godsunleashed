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
  private graphic: Phaser.GameObjects.Graphics
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
    this.graphic = scene.add.graphics().setDepth(4)
    this.draw()
  }

  private draw() {
    const g = this.graphic
    g.clear()
    // Handle
    g.fillStyle(0x5a2a08, 1)
    g.fillRect(-22, -4, 6, 8)
    g.fillStyle(0x8b4513, 1)
    g.fillRect(-18, -2, 14, 4)
    // Blade body (dark metal)
    g.fillStyle(0x778899, 1)
    g.fillTriangle(-3, -13, 15, 0, -3, 13)
    // Blade mid (lighter)
    g.fillStyle(0xaabbcc, 0.85)
    g.fillTriangle(-1, -9, 13, 0, -1, 9)
    // Blade edge (bright silver)
    g.fillStyle(0xddeeff, 0.9)
    g.fillTriangle(9, -7, 16, 0, 9, 7)
  }

  update(delta: number) {
    const dt = delta / 1000
    this.vy += GRAVITY * dt
    this.x  += this.vx * dt
    this.y  += this.vy * dt
    this.spinAngle += 0.015 * delta * Math.sign(this.vx)

    if (!this.peaked && this.vy > 0) this.peaked = true
    if (this.peaked && this.y > this.startY + LAND_BELOW) { this.destroy(); return }

    this.graphic.setPosition(this.x, this.y)
    this.graphic.setRotation(this.spinAngle)
  }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}
