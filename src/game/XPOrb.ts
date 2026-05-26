import Phaser from 'phaser'

const BASE_ATTRACT_RADIUS = 50
const ATTRACT_SPEED = 320
const COLLECT_RADIUS = 20
const UNCOLLECTABLE_MS = 400
const NUDGE_DURATION = 260  // ms the orb spends nudging away
const NUDGE_SPEED = 320     // px/s of the outward nudge

export class XPOrb {
  private scene: Phaser.Scene
  private graphic: Phaser.GameObjects.Image
  private glow: Phaser.GameObjects.Image
  x: number
  y: number
  value: number
  active = true
  private time = 0
  private attracted = false
  private nudgeTimer = -1    // ≥0 while nudging away
  private hasNudged = false  // nudge fires once per orb lifetime
  private lockOn = false     // once true, always pulls regardless of distance

  constructor(scene: Phaser.Scene, x: number, y: number, value = 1) {
    this.scene = scene
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

  // magnetRange 0-3 from run upgrade; each rank adds 50% attract radius
  update(playerX: number, playerY: number, delta: number, magnetRange = 0): number {
    const dt = delta / 1000
    this.time += delta
    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const attractRadius = BASE_ATTRACT_RADIUS * (1 + magnetRange * 0.5)

    if (dist < COLLECT_RADIUS && this.time >= UNCOLLECTABLE_MS) {
      this.spawnCollectEffect()
      this.destroy()
      return this.value
    }

    const wasAttracted = this.attracted
    this.attracted = this.lockOn || dist < attractRadius

    // Fire nudge the first time the player walks into range from outside,
    // but not for orbs that spawned inside the radius (guard with UNCOLLECTABLE_MS).
    if (this.attracted && !wasAttracted && !this.hasNudged && this.time >= UNCOLLECTABLE_MS) {
      this.nudgeTimer = 0
      this.hasNudged = true
    }

    if (this.nudgeTimer >= 0) {
      this.nudgeTimer += delta
      if (this.nudgeTimer < NUDGE_DURATION) {
        // Push away from player
        this.x -= (dx / dist) * NUDGE_SPEED * dt
        this.y -= (dy / dist) * NUDGE_SPEED * dt
      } else {
        // Nudge done — lock on and pull forever
        this.nudgeTimer = -1
        this.lockOn = true
        this.attracted = true
      }
    } else if (this.attracted) {
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

  private spawnCollectEffect() {
    const cx = this.x
    const cy = this.y

    const ring = this.scene.add.graphics().setDepth(5).setPosition(cx, cy)
    ring.lineStyle(1.5, 0x00ff88, 1)
    ring.strokeCircle(0, 0, 6)
    this.scene.tweens.add({
      targets: ring,
      scaleX: 4, scaleY: 4,
      alpha: 0,
      duration: 280,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    })

    const flash = this.scene.add.graphics().setDepth(5).setPosition(cx, cy)
    flash.fillStyle(0xaaffcc, 0.85)
    flash.fillCircle(0, 0, 5)
    this.scene.tweens.add({
      targets: flash,
      scaleX: 1.8, scaleY: 1.8,
      alpha: 0,
      duration: 160,
      ease: 'Power3',
      onComplete: () => flash.destroy(),
    })
  }

  destroy() {
    this.graphic.destroy()
    this.glow.destroy()
    this.active = false
  }
}
