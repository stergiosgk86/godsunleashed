import Phaser from 'phaser'
import { useGameStore } from '../store/gameStore'
import { type Direction, getDirection, playDir } from './spriteUtils'
import { type EffectsSystem } from './EffectsSystem'
import { soundSystem } from './SoundSystem'

const DASH_SPEED = 750     // px/s during dash
const DASH_DURATION = 180  // ms
const TRAIL_INTERVAL = 45  // ms between ghost spawns

const DIR_VECTOR: Record<Direction, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
}

export class Player {
  graphic: Phaser.GameObjects.Sprite
  x: number
  y: number
  private keys: {
    w: Phaser.Input.Keyboard.Key
    a: Phaser.Input.Keyboard.Key
    s: Phaser.Input.Keyboard.Key
    d: Phaser.Input.Keyboard.Key
    up: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
    space: Phaser.Input.Keyboard.Key
  }
  touchVx = 0
  touchVy = 0
  private lastDir: Direction = 'down'
  private isDashing = false
  private dashTimeLeft = 0
  private dashVx = 0
  private dashVy = 0
  private trailTimer = 0

  private bounds: Phaser.Geom.Rectangle
  private spriteKey: string
  private nameLabel: Phaser.GameObjects.Text | null = null

  constructor(scene: Phaser.Scene, x: number, y: number, spriteKey = 'player', username = '') {
    this.x = x
    this.y = y
    this.spriteKey = spriteKey
    this.bounds = scene.physics.world.bounds
    this.graphic = scene.add.sprite(x, y, spriteKey).setDepth(4).setScale(1.5)
    if (username) {
      this.nameLabel = scene.add.text(x, y - 28, username, {
        fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(5)
    }

    const kb = scene.input.keyboard!
    this.keys = {
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    }
  }

  update(delta: number, effects: EffectsSystem) {
    const dt = delta / 1000
    const { moveSpeed, startDash, dashDistance } = useGameStore.getState()

    let vx = this.touchVx
    let vy = this.touchVy
    if (this.keys.a.isDown || this.keys.left.isDown) vx -= 1
    if (this.keys.d.isDown || this.keys.right.isDown) vx += 1
    if (this.keys.w.isDown || this.keys.up.isDown) vy -= 1
    if (this.keys.s.isDown || this.keys.down.isDown) vy += 1
    // Clamp combined input so touch + keyboard doesn't exceed unit vector
    const inputLen = Math.sqrt(vx * vx + vy * vy)
    if (inputLen > 1) { vx /= inputLen; vy /= inputLen }

    const moving = vx !== 0 || vy !== 0

    if (Phaser.Input.Keyboard.JustDown(this.keys.space) && !this.isDashing) {
      if (startDash()) {
        soundSystem.dash()
        this.isDashing = true
        this.dashTimeLeft = DASH_DURATION
        this.trailTimer = 0
        if (moving) {
          this.dashVx = vx
          this.dashVy = vy
        } else {
          const [dx, dy] = DIR_VECTOR[this.lastDir]
          this.dashVx = dx
          this.dashVy = dy
        }
      }
    }

    if (this.isDashing) {
      this.dashTimeLeft -= delta
      this.trailTimer -= delta
      if (this.trailTimer <= 0) {
        effects.showDashGhost(this.x, this.y, this.graphic.frame.name)
        this.trailTimer = TRAIL_INTERVAL
      }
      this.x += this.dashVx * DASH_SPEED * dashDistance * dt
      this.y += this.dashVy * DASH_SPEED * dashDistance * dt
      if (this.dashTimeLeft <= 0) this.isDashing = false
    } else {
      this.x += vx * moveSpeed * dt
      this.y += vy * moveSpeed * dt
    }

    const margin = 64
    this.x = Phaser.Math.Clamp(this.x, this.bounds.x + margin, this.bounds.right - margin)
    this.y = Phaser.Math.Clamp(this.y, this.bounds.y + margin, this.bounds.bottom - margin)
    this.graphic.setPosition(this.x, this.y)
    this.nameLabel?.setPosition(this.x, this.y - 28)

    const dir = moving ? getDirection(vx, vy) : this.lastDir
    this.lastDir = playDir(this.graphic, this.spriteKey, dir, this.lastDir, moving)

    const { damageFlashUntil } = useGameStore.getState()
    const isFlashing = Date.now() < damageFlashUntil
    this.graphic.setAlpha(isFlashing ? (Math.floor(Date.now() / 100) % 2 === 0 ? 0.3 : 1) : 1)
  }

  respawnAt(x: number, y: number) {
    this.x = x
    this.y = y
    this.graphic.setPosition(x, y)
    this.nameLabel?.setPosition(x, y - 28)
  }
}
