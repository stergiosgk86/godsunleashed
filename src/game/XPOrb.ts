import Phaser from 'phaser'

export type OrbTier = 'green' | 'blue' | 'gold'

const BASE_ATTRACT_RADIUS = 80
const ATTRACT_SPEED = 320
const COLLECT_RADIUS = 40
const UNCOLLECTABLE_MS = 350
const SPAWN_ANIM_MS = 220
const NUDGE_DURATION = 260
const NUDGE_SPEED = 320

const TIER_ORB_KEY: Record<OrbTier, string> = {
  green: 'xp_orb',
  blue:  'xp_orb_blue',
  gold:  'xp_orb_gold',
}
const TIER_GLOW_KEY: Record<OrbTier, string> = {
  green: 'xp_orb_glow',
  blue:  'xp_orb_blue_glow',
  gold:  'xp_orb_gold_glow',
}
const TIER_BASE_SCALE: Record<OrbTier, number> = {
  green: 1.0,
  blue:  1.15,
  gold:  1.3,
}
const TIER_GLOW_BASE: Record<OrbTier, number> = {
  green: 1.0,
  blue:  1.1,
  gold:  1.25,
}
const TIER_COLLECT_COLOR: Record<OrbTier, number> = {
  green: 0x00ff88,
  blue:  0x44aaff,
  gold:  0xffcc00,
}
const TIER_FLASH_COLOR: Record<OrbTier, number> = {
  green: 0xaaffcc,
  blue:  0xaaccff,
  gold:  0xffeeaa,
}

export function orbTierForValue(xpValue: number): OrbTier {
  if (xpValue <= 4)  return 'green'
  if (xpValue <= 15) return 'blue'
  return 'gold'
}

export class XPOrb {
  private scene: Phaser.Scene
  private graphic: Phaser.GameObjects.Image
  private glow: Phaser.GameObjects.Image
  x: number
  y: number
  value: number
  active = true
  readonly tier: OrbTier
  private _isAccumulator = false
  private time = 0
  private attracted = false
  private nudgeTimer = -1
  private hasNudged = false
  private lockOn = false

  constructor(scene: Phaser.Scene, x: number, y: number, value = 1, tier?: OrbTier) {
    this.scene = scene
    this.x = x
    this.y = y
    this.value = value
    this.tier = tier ?? orbTierForValue(value)

    this.glow = scene.add
      .image(x, y, TIER_GLOW_KEY[this.tier])
      .setDepth(0.9)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
    this.graphic = scene.add.image(x, y, TIER_ORB_KEY[this.tier]).setDepth(1).setScale(0).setAlpha(0)
  }

  makeAccumulator() {
    this._isAccumulator = true
  }

  addValue(amount: number) {
    this.value += amount
  }

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

    // Spawn pop-in animation
    let spawnScale = 1
    let spawnAlpha = 1
    if (this.time < SPAWN_ANIM_MS) {
      const t = this.time / SPAWN_ANIM_MS
      const c1 = 1.70158, c3 = c1 + 1
      spawnScale = Math.max(0, 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2))
      spawnAlpha = t
    }

    const baseScale = TIER_BASE_SCALE[this.tier]
    // Accumulator grows visually as it absorbs more XP
    const accumScale = this._isAccumulator
      ? Math.min(1 + Math.sqrt(this.value / 80) * 0.6, 2.8)
      : 1

    const pulseSpeed = this._isAccumulator ? 0.008 : 0.005
    const pulse = 1 + 0.15 * Math.sin(this.time * pulseSpeed)
    const glowBase = TIER_GLOW_BASE[this.tier]
    const glowScale = (this.attracted ? 1.5 : 1) * glowBase * accumScale + 0.3 * Math.sin(this.time * 0.004 + 0.8)
    const glowAlpha = Phaser.Math.Clamp(
      (this.attracted ? 0.85 : 0.55) + 0.2 * Math.sin(this.time * 0.004),
      0, 1
    )

    this.graphic.setPosition(this.x, this.y)
    this.graphic.setScale((this.attracted ? pulse * 1.15 : pulse) * baseScale * accumScale * spawnScale)
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
    const color = TIER_COLLECT_COLOR[this.tier]
    const flashColor = TIER_FLASH_COLOR[this.tier]
    const big = this._isAccumulator

    const ring = this.scene.add.graphics().setDepth(5).setPosition(cx, cy)
    ring.lineStyle(big ? 2.5 : 1.5, color, 1)
    ring.strokeCircle(0, 0, big ? 12 : 6)
    this.scene.tweens.add({
      targets: ring,
      scaleX: big ? 6 : 4, scaleY: big ? 6 : 4,
      alpha: 0,
      duration: big ? 400 : 280,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    })

    const flash = this.scene.add.graphics().setDepth(5).setPosition(cx, cy)
    flash.fillStyle(flashColor, 0.85)
    flash.fillCircle(0, 0, big ? 10 : 5)
    this.scene.tweens.add({
      targets: flash,
      scaleX: big ? 3 : 1.8, scaleY: big ? 3 : 1.8,
      alpha: 0,
      duration: big ? 250 : 160,
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
