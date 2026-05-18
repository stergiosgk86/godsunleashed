import Phaser from 'phaser'

const ATTRACT_RADIUS = 80
const ATTRACT_SPEED = 260
const COLLECT_RADIUS = 22

export class HealthPotion {
  private graphic: Phaser.GameObjects.Image
  private bobTimer: number
  x: number
  y: number
  active = true

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x
    this.y = y
    this.bobTimer = Math.random() * Math.PI * 2
    this.graphic = scene.add.image(x, y, 'health_potion').setDepth(1.5)
  }

  update(playerX: number, playerY: number, delta: number): boolean {
    const dt = delta / 1000
    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < COLLECT_RADIUS) {
      this.destroy()
      return true
    }

    if (dist < ATTRACT_RADIUS) {
      this.x += (dx / dist) * ATTRACT_SPEED * dt
      this.y += (dy / dist) * ATTRACT_SPEED * dt
    }

    this.bobTimer += delta * 0.0025
    this.graphic.setPosition(this.x, this.y + Math.sin(this.bobTimer) * 3)

    return false
  }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}
