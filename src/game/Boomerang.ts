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
  private graphic: Phaser.GameObjects.Graphics
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
    this.graphic = scene.add.graphics().setDepth(4)
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

    const g = this.graphic
    g.clear()
    g.setPosition(this.x, this.y)
    g.setRotation(this.spinAngle)
    // Two wings
    g.fillStyle(0xffaa00, 0.95)
    g.fillEllipse(-8, 0, 22, 9)
    g.fillStyle(0xffcc44, 0.95)
    g.fillEllipse(8, 0, 22, 9)
    // Centre hub
    g.fillStyle(0xffffff, 0.9)
    g.fillCircle(0, 0, 4)
    g.lineStyle(1, 0xff8800, 0.6)
    g.strokeCircle(0, 0, 4)
  }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}
