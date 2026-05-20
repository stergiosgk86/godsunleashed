import Phaser from 'phaser'

const MAX_RADIUS = 64

export class TouchJoystick {
  vx = 0
  vy = 0

  private scene: Phaser.Scene
  private base: Phaser.GameObjects.Graphics
  private knob: Phaser.GameObjects.Graphics
  private activePointerId: number | null = null
  private originX = 0
  private originY = 0

  // Converts raw canvas pointer coords to the same space as scrollFactor(0) game objects.
  // Camera zoom scales those objects away from the camera center, so we invert that transform.
  private toGameCoords(sx: number, sy: number): { x: number; y: number } {
    const cam = this.scene.cameras.main
    const halfW = cam.width / 2
    const halfH = cam.height / 2
    const zoom = cam.zoom
    return { x: (sx - halfW) / zoom + halfW, y: (sy - halfH) / zoom + halfH }
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    this.base = scene.add.graphics().setScrollFactor(0).setDepth(100).setAlpha(0)
    this.knob = scene.add.graphics().setScrollFactor(0).setDepth(101).setAlpha(0)

    // Draw shapes centered at (0,0); position is moved via setPosition()
    this.base.lineStyle(2, 0xffffff, 0.6)
    this.base.strokeCircle(0, 0, MAX_RADIUS)
    this.base.fillStyle(0xffffff, 0.08)
    this.base.fillCircle(0, 0, MAX_RADIUS)

    this.knob.fillStyle(0xffffff, 0.55)
    this.knob.fillCircle(0, 0, MAX_RADIUS * 0.38)

    scene.input.on('pointerdown', this.onDown, this)
    scene.input.on('pointermove', this.onMove, this)
    scene.input.on('pointerup', this.onUp, this)
    scene.input.on('pointerupoutside', this.onUp, this)
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (this.activePointerId !== null) return
    this.activePointerId = pointer.id
    const { x, y } = this.toGameCoords(pointer.x, pointer.y)
    this.originX = x
    this.originY = y
    this.base.setPosition(x, y).setAlpha(0.4)
    this.knob.setPosition(x, y).setAlpha(0.75)
    this.vx = 0
    this.vy = 0
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.activePointerId) return
    const { x, y } = this.toGameCoords(pointer.x, pointer.y)
    const dx = x - this.originX
    const dy = y - this.originY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) {
      this.vx = 0; this.vy = 0
      this.knob.setPosition(this.originX, this.originY)
      return
    }
    this.vx = dx / dist
    this.vy = dy / dist
    const clamped = Math.min(dist, MAX_RADIUS)
    this.knob.setPosition(this.originX + this.vx * clamped, this.originY + this.vy * clamped)
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.activePointerId) return
    this.activePointerId = null
    this.vx = 0; this.vy = 0
    this.base.setAlpha(0)
    this.knob.setAlpha(0)
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown, this)
    this.scene.input.off('pointermove', this.onMove, this)
    this.scene.input.off('pointerup', this.onUp, this)
    this.scene.input.off('pointerupoutside', this.onUp, this)
    this.base.destroy()
    this.knob.destroy()
  }
}
