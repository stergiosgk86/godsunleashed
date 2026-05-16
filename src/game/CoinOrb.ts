import Phaser from 'phaser'

const BASE_ATTRACT_RADIUS = 150
const ATTRACT_SPEED = 280
const COLLECT_RADIUS = 20

export class CoinOrb {
  private graphic: Phaser.GameObjects.Image
  private bobTimer: number
  x: number
  y: number
  active = true

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x
    this.y = y
    this.bobTimer = Math.random() * Math.PI * 2
    this.graphic = scene.add.image(x, y, 'coin').setDepth(1)
  }

  // magnetRank 0-5 from meta upgrades; each rank adds 10% attract radius
  update(playerX: number, playerY: number, delta: number, magnetRank = 0): boolean {
    const dt = delta / 1000
    const attractRadius = BASE_ATTRACT_RADIUS * (1 + magnetRank * 0.1)

    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < COLLECT_RADIUS) {
      this.destroy()
      return true
    }

    if (dist < attractRadius) {
      this.x += (dx / dist) * ATTRACT_SPEED * dt
      this.y += (dy / dist) * ATTRACT_SPEED * dt
    }

    this.bobTimer += delta * 0.003
    this.graphic.setPosition(this.x, this.y + Math.sin(this.bobTimer) * 2)

    return false
  }

  destroy() {
    this.graphic.destroy()
    this.active = false
  }
}
