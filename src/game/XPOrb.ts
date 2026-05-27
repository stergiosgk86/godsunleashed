import Phaser from 'phaser'

const BASE_ATTRACT_RADIUS = 80
const ATTRACT_SPEED = 320
const COLLECT_RADIUS = 40
const UNCOLLECTABLE_MS = 350
const SPAWN_ANIM_MS = 220     // pop-in animation duration
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
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
    this.graphic = scene.add.image(x, y, 'xp_orb').setDepth(1).setScale(0).setAlpha(0)
  }

  // magnetRange 0-3 from run upgrade; each rank multiplies attract radius by 1.5×
  update(playerX: number, playerY: number, delta: number, magnetRange = 0): number {
    const dt = delta / 1000
    this.time += delta
    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const attractRadius = BASE_ATTRACT_RADIUS * Math.pow(1.5, magnetRange)

    const canCollect = this.time >= UNCOLLECTABLE_MS

    if (canCollect && dist < COLLECT_RADIUS) {
      this.spawnCollectEffect()
      this.destroy()
      return this.value
    }

    // No attraction during the uncollectable window — orb stays at spawn position
    // so the pop-in animation is visible before it moves toward the player.
    const wasAttracted = this.attracted
    this.attracted = canCollect && (this.lockOn || dist < attractRadius)

    if (this.attracted && !wasAttracted && !this.hasNudged) {
      this.nudgeTimer = 0
      this.hasNudged = true
    }

    if (this.nudgeTimer >= 0) {
      this.nudgeTimer += delta
      if (this.nudgeTimer < NUDGE_DURATION) {
        this.x -= (dx / dist) * NUDGE_SPEED * dt
        this.y -= (dy / dist) * NUDGE_SPEED * dt
      } else {
        this.nudgeTimer = -1
        this.lockOn = true
        this.attracted = true
      }
    } else if (this.attracted) {
      this.x += (dx / dist) * ATTRACT_SPEED * dt
      this.y += (dy / dist) * ATTRACT_SPEED * dt
    }

    // Spawn pop-in: Back.Out easing from 0→1 over SPAWN_ANIM_MS, computed in update
    // so it isn't overwritten by the setScale call below.
    let spawnScale = 1
    let spawnAlpha = 1
    if (this.time < SPAWN_ANIM_MS) {
      const t = this.time / SPAWN_ANIM_MS
      const c1 = 1.70158, c3 = c1 + 1
      spawnScale = Math.max(0, 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2))
      spawnAlpha = t
    }

    const pulse = 1 + 0.15 * Math.sin(this.time * 0.005)
    const glowScale = (this.attracted ? 1.5 : 1) + 0.3 * Math.sin(this.time * 0.004 + 0.8)
    const glowAlpha = Phaser.Math.Clamp(
      (this.attracted ? 0.85 : 0.55) + 0.2 * Math.sin(this.time * 0.004),
      0,
      1
    )

    this.graphic.setPosition(this.x, this.y)
    this.graphic.setScale((this.attracted ? pulse * 1.15 : pulse) * spawnScale)
    this.graphic.setAlpha(spawnAlpha)
    this.graphic.rotation += 0.035 * (delta / 16)

    this.glow.setPosition(this.x, this.y)
    this.glow.setScale(glowScale * spawnScale)
    this.glow.setAlpha(glowAlpha * spawnAlpha)

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
