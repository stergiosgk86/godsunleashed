import Phaser from 'phaser'

const SPEED = 500
const LIFETIME = 5000  // safety-net; actual pruning is camera-bounds-based in CombatSystem

export class Projectile {
  private graphic: Phaser.GameObjects.Image
  x: number
  y: number
  vx: number
  vy: number
  active = true
  damage = 1
  piercing = false
  hitTargets = new Set<object>()
  private age = 0

  constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number) {
    this.x = x
    this.y = y
    const dx = targetX - x
    const dy = targetY - y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    this.vx = (dx / dist) * SPEED
    this.vy = (dy / dist) * SPEED
    this.graphic = scene.add.image(x, y, 'projectile')
      .setRotation(Math.atan2(dy, dx))
      .setDepth(3)
  }

  update(delta: number) {
    const dt = delta / 1000
    this.age += delta
    if (this.age >= LIFETIME) { this.destroy(); return }
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.graphic.setPosition(this.x, this.y)
  }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}
