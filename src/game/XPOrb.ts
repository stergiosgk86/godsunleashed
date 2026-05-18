import Phaser from 'phaser'

const ATTRACT_RADIUS = 150
const ATTRACT_SPEED = 300
const COLLECT_RADIUS = 20

export class XPOrb {
  private graphic: Phaser.GameObjects.Image
  private glow: Phaser.GameObjects.Image
  x: number
  y: number
  value: number
  active = true
  private time = 0
  private attracted = false

  constructor(scene: Phaser.Scene, x: number, y: number, value = 1) {
    this.x = x
    this.y = y
    this.value = value
    this.glow = scene.add
      .image(x, y, 'xp_orb_glow')
      .setDepth(0.9)
      .setAlpha(0.55)
      .setBlendMode(Phaser.BlendModes.ADD)
    this.graphic = scene.add.image(x, y, 'xp_orb').setDepth(1)
  }

  update(playerX: number, playerY: number, delta: number): number {
    const dt = delta / 1000
    this.time += delta
    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < COLLECT_RADIUS) {
      this.destroy()
      return this.value
    }

    this.attracted = dist < ATTRACT_RADIUS
    if (this.attracted) {
      this.x += (dx / dist) * ATTRACT_SPEED * dt
      this.y += (dy / dist) * ATTRACT_SPEED * dt
    }

    const pulse = 1 + 0.15 * Math.sin(this.time * 0.005)
    const glowScale = (this.attracted ? 1.5 : 1) + 0.3 * Math.sin(this.time * 0.004 + 0.8)
    const glowAlpha = Phaser.Math.Clamp(
      (this.attracted ? 0.85 : 0.55) + 0.2 * Math.sin(this.time * 0.004),
      0,
      1
    )

    this.graphic.setPosition(this.x, this.y)
    this.graphic.setScale(this.attracted ? pulse * 1.15 : pulse)
    this.graphic.rotation += 0.035 * (delta / 16)

    this.glow.setPosition(this.x, this.y)
    this.glow.setScale(glowScale)
    this.glow.setAlpha(glowAlpha)

    return 0
  }

  destroy() {
    this.graphic.destroy()
    this.glow.destroy()
    this.active = false
  }
}
