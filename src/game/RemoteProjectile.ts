import Phaser from 'phaser'

const LIFETIME = 1500

export class RemoteProjectile {
  private graphic: Phaser.GameObjects.Image
  active = true
  x: number
  y: number
  private vx: number
  private vy: number
  private age = 0

  constructor(scene: Phaser.Scene, x: number, y: number, vx: number, vy: number) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.graphic = scene.add
      .image(x, y, 'projectile')
      .setRotation(Math.atan2(vy, vx))
      .setDepth(3)
      .setTint(0x88aaff)
  }

  update(delta: number) {
    this.age += delta
    if (this.age >= LIFETIME) { this.destroy(); return }
    const dt = delta / 1000
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.graphic.setPosition(this.x, this.y)
  }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}
