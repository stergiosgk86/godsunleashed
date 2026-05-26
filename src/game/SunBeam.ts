import Phaser from 'phaser'

export class SunBeam {
  x: number
  y: number
  vx: number
  vy: number
  active = true
  hitRadius = 10
  hitTargets = new Set<object>()
  private graphic: Phaser.GameObjects.Graphics
  private age = 0
  private static readonly LIFETIME = 5000

  constructor(scene: Phaser.Scene, x: number, y: number, vx: number, vy: number) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.graphic = scene.add.graphics().setDepth(3).setRotation(Math.atan2(vy, vx))
    this.drawBeam()
    this.graphic.setPosition(x, y)
  }

  private drawBeam() {
    const g = this.graphic
    g.clear()
    g.fillStyle(0xffd700, 0.2)
    g.fillRect(-14, -5, 28, 10)
    g.fillStyle(0xffcc00, 0.6)
    g.fillRect(-12, -3, 24, 6)
    g.fillStyle(0xffffff, 0.9)
    g.fillRect(-10, -1.5, 20, 3)
  }

  update(delta: number) {
    this.age += delta
    if (this.age >= SunBeam.LIFETIME) { this.destroy(); return }
    const dt = delta / 1000
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.graphic.setPosition(this.x, this.y)
  }

  destroy() {
    if (!this.active) return
    this.graphic.destroy()
    this.active = false
  }
}
