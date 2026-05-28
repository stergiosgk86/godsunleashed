import Phaser from 'phaser'

export class SunBeam {
  x: number
  y: number
  vx: number
  vy: number
  active = true
  hitRadius = 11
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
    this.graphic = scene.add.graphics().setDepth(3)
    this.drawOrb()
    this.graphic.setPosition(x, y)
  }

  private drawOrb() {
    const g = this.graphic
    g.clear()
    if (this.gold) {
      g.fillStyle(0xffaa00, 0.25)
      g.fillCircle(0, 0, 11)
      g.fillStyle(0xffcc00, 0.7)
      g.fillCircle(0, 0, 7)
      g.fillStyle(0xffffff, 0.95)
      g.fillCircle(0, 0, 3)
    } else {
      g.fillStyle(0x0088ff, 0.25)
      g.fillCircle(0, 0, 11)
      g.fillStyle(0x00aaff, 0.7)
      g.fillCircle(0, 0, 7)
      g.fillStyle(0xffffff, 0.95)
      g.fillCircle(0, 0, 3)
    }
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
