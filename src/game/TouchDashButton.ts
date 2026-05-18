import Phaser from 'phaser'
import { useGameStore } from '../store/gameStore'

const RADIUS = 38
const DEPTH = 102

export class TouchDashButton {
  private scene: Phaser.Scene
  private circle: Phaser.GameObjects.Graphics
  private arc: Phaser.GameObjects.Graphics
  private label: Phaser.GameObjects.Text
  private cx: number
  private cy: number
  private activePointerId: number | null = null
  dashConsumed = false
  private pressed = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.cx = scene.scale.width - RADIUS - 24
    this.cy = scene.scale.height - RADIUS - 24

    this.circle = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH)
    this.arc = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1)
    this.label = scene.add
      .text(this.cx, this.cy, '⚡', {
        fontSize: '22px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 2)

    this.drawIdle(1)

    scene.input.on('pointerdown', this.onDown, this)
    scene.input.on('pointerup', this.onUp, this)
    scene.input.on('pointerupoutside', this.onUp, this)
  }

  private drawIdle(readyFraction: number) {
    const c = this.circle
    const a = this.arc
    c.clear()
    c.fillStyle(0x000000, 0.45)
    c.fillCircle(this.cx, this.cy, RADIUS)
    c.lineStyle(2, 0x8888ff, 0.7)
    c.strokeCircle(this.cx, this.cy, RADIUS)

    a.clear()
    if (readyFraction < 1) {
      // cooldown arc (clockwise from top)
      const startAngle = -Math.PI / 2
      const endAngle = startAngle + Math.PI * 2 * readyFraction
      a.lineStyle(3, 0x4444cc, 0.9)
      a.beginPath()
      a.arc(this.cx, this.cy, RADIUS - 4, startAngle, endAngle, false)
      a.strokePath()
    }
  }

  private drawPressed() {
    const c = this.circle
    c.clear()
    c.fillStyle(0x3333aa, 0.7)
    c.fillCircle(this.cx, this.cy, RADIUS)
    c.lineStyle(2, 0xaaaaff, 1)
    c.strokeCircle(this.cx, this.cy, RADIUS)
    this.arc.clear()
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (this.activePointerId !== null) return
    const dx = pointer.x - this.cx
    const dy = pointer.y - this.cy
    if (dx * dx + dy * dy > RADIUS * RADIUS) return
    this.activePointerId = pointer.id
    this.pressed = true
    this.dashConsumed = false
    this.drawPressed()
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.activePointerId) return
    this.activePointerId = null
    this.pressed = false
  }

  consumePress(): boolean {
    if (this.pressed && !this.dashConsumed) {
      this.dashConsumed = true
      return true
    }
    return false
  }

  update() {
    if (this.pressed) return
    const { dashCooldown, dashCooldownUntil } = useGameStore.getState()
    const remaining = Math.max(0, dashCooldownUntil - Date.now())
    const fraction = remaining === 0 ? 1 : 1 - remaining / dashCooldown
    this.drawIdle(fraction)
    this.label.setAlpha(fraction >= 1 ? 1 : 0.4)
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown, this)
    this.scene.input.off('pointerup', this.onUp, this)
    this.scene.input.off('pointerupoutside', this.onUp, this)
    this.circle.destroy()
    this.arc.destroy()
    this.label.destroy()
  }
}
