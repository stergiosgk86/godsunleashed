import Phaser from 'phaser'

const ATTRACT_RADIUS = 150
const ATTRACT_SPEED = 300
const COLLECT_RADIUS = 20

export class XPOrb {
  private graphic: Phaser.GameObjects.Image
  x: number
  y: number
  value: number
  active = true

  constructor(scene: Phaser.Scene, x: number, y: number, value = 1) {
    this.x = x
    this.y = y
    this.value = value
    this.graphic = scene.add.image(x, y, 'xp_orb').setDepth(1)
  }

  update(playerX: number, playerY: number, delta: number): number {
    const dt = delta / 1000
    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < COLLECT_RADIUS) {
      this.destroy()
      return this.value
    }

    if (dist < ATTRACT_RADIUS) {
      this.x += (dx / dist) * ATTRACT_SPEED * dt
      this.y += (dy / dist) * ATTRACT_SPEED * dt
    }

    this.graphic.setPosition(this.x, this.y)
    this.graphic.rotation += 0.04 * (delta / 16)

    return 0
  }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}
