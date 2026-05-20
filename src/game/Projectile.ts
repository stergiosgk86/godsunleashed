import Phaser from 'phaser'

const SPEED = 500
const LIFETIME = 5000  // safety-net; actual pruning is camera-bounds-based in CombatSystem

export class Projectile {
  protected graphic: Phaser.GameObjects.Image
  x: number
  y: number
  vx: number
  vy: number
  active = true
  damage = 1
  piercing = false
  hitTargets = new Set<object>()
  hitRadius = 20
  private age = 0

  constructor(
    scene: Phaser.Scene, x: number, y: number,
    targetX: number, targetY: number,
    textureKey = 'projectile', speed = SPEED, scale = 1
  ) {
    this.x = x
    this.y = y
    const dx = targetX - x
    const dy = targetY - y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    this.vx = (dx / dist) * speed
    this.vy = (dy / dist) * speed
    this.graphic = scene.add.image(x, y, textureKey)
      .setRotation(Math.atan2(dy, dx))
      .setScale(scale)
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
