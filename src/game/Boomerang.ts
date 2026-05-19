import Phaser from 'phaser'

const SPEED = 360
const MAX_RANGE = 400

export class Boomerang {
  x: number
  y: number
  active = true
  returning = false
  private vx: number
  private vy: number
  private distTravelled = 0
  private spinAngle = 0
  private image: Phaser.GameObjects.Image
  hitTargetsOut = new Set<object>()
  hitTargetsBack = new Set<object>()

  constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number) {
    this.x = x
    this.y = y
    const dx = targetX - x
    const dy = targetY - y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    this.vx = (dx / dist) * SPEED
    this.vy = (dy / dist) * SPEED
    this.image = scene.add.image(x, y, 'boomerang').setDepth(4).setScale(0.5)
  }

  update(delta: number, playerX: number, playerY: number) {
    const dt = delta / 1000
    this.spinAngle += delta * 0.013

    if (!this.returning) {
      this.x += this.vx * dt
      this.y += this.vy * dt
      this.distTravelled += SPEED * dt
      if (this.distTravelled >= MAX_RANGE) this.returning = true
    } else {
      const dx = playerX - this.x
      const dy = playerY - this.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      if (dist < 35) { this.destroy(); return }
      this.vx = (dx / dist) * SPEED
      this.vy = (dy / dist) * SPEED
      this.x += this.vx * dt
      this.y += this.vy * dt
    }

    this.image.setPosition(this.x, this.y)
    this.image.setRotation(this.spinAngle)
  }

  destroy() {
    this.image.destroy()
    this.active = false
  }
}
