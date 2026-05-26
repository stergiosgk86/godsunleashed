import Phaser from 'phaser'

export class SunBeam {
  x: number
  y: number
  vx: number
  vy: number
  active = true
  hitRadius = 20
  hitTargets = new Set<object>()
  private graphic: Phaser.GameObjects.Graphics
  private age = 0
  private static readonly LIFETIME = 5000

  private gold: boolean

  constructor(scene: Phaser.Scene, x: number, y: number, vx: number, vy: number, gold = true) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.gold = gold
    this.graphic = scene.add.graphics().setDepth(3).setRotation(Math.atan2(vy, vx))
    this.drawBeam()
    this.graphic.setPosition(x, y)
  }

  private drawBeam() {
    const g = this.graphic
    g.clear()
    if (this.gold) {
      g.fillStyle(0xffd700, 0.2)
      g.fillRect(-24, -12, 48, 24)
      g.fillStyle(0xffcc00, 0.6)
      g.fillRect(-21, -8, 42, 16)
    } else {
      g.fillStyle(0x00eeff, 0.2)
      g.fillRect(-24, -12, 48, 24)
      g.fillStyle(0x00aaff, 0.6)
      g.fillRect(-21, -8, 42, 16)
    }
    g.fillStyle(0xffffff, 0.9)
    g.fillRect(-18, -4, 36, 8)
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
