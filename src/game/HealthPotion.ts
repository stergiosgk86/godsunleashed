import Phaser from 'phaser'

const ATTRACT_RADIUS = 80
const ATTRACT_SPEED = 260
const COLLECT_RADIUS = 30

export class HealthPotion {
  private graphic: Phaser.GameObjects.Image
  private glow: Phaser.GameObjects.Image
  private bobTimer: number
  x: number
  y: number
  active = true

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x
    this.y = y
    this.bobTimer = Math.random() * Math.PI * 2
    this.glow = scene.add
      .image(x, y, 'health_potion_glow')
      .setDepth(1.4)
      .setAlpha(0.6)
      .setBlendMode(Phaser.BlendModes.ADD)
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

    const attracted = dist < ATTRACT_RADIUS
    if (attracted) {
      this.x += (dx / dist) * ATTRACT_SPEED * dt
      this.y += (dy / dist) * ATTRACT_SPEED * dt
    }

    this.bobTimer += delta * 0.0025
    const bobY = Math.sin(this.bobTimer) * 3
    const glowScale = (attracted ? 1.4 : 1) + 0.25 * Math.sin(this.bobTimer * 1.3)
    const glowAlpha = Phaser.Math.Clamp(
      (attracted ? 0.85 : 0.6) + 0.2 * Math.sin(this.bobTimer * 1.3),
      0,
      1
    )

    this.graphic.setPosition(this.x, this.y + bobY)
    this.glow.setPosition(this.x, this.y + bobY)
    this.glow.setScale(glowScale)
    this.glow.setAlpha(glowAlpha)

    return false
  }

  destroy() {
    this.graphic.destroy()
    this.glow.destroy()
    this.active = false
  }
}
