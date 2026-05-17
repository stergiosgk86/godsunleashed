import Phaser from 'phaser'
import { type Direction, getDirection, playDir } from './spriteUtils'

const CHAR_SPRITE: Record<string, string> = {
  knight:  'player',
  rogue:   'char_rogue',
  witch:   'char_witch',
  shade: 'char_shade',
}

export class RemotePlayer {
  x: number
  y: number
  private sprite: Phaser.GameObjects.Sprite
  private spriteKey: string
  private lastDir: Direction = 'down'
  private nameLabel: Phaser.GameObjects.Text
  private auraGraphic: Phaser.GameObjects.Graphics
  private orbGraphic: Phaser.GameObjects.Graphics
  private auraAngle = 0
  private orbAngle = 0
  private _aura = 0
  private _orbital = 0

  constructor(scene: Phaser.Scene, x: number, y: number, characterType: string, label: string) {
    this.x = x
    this.y = y
    this.spriteKey = CHAR_SPRITE[characterType] ?? 'player'
    this.auraGraphic = scene.add.graphics().setDepth(2)
    this.orbGraphic  = scene.add.graphics().setDepth(5)
    this.sprite = scene.add.sprite(x, y, this.spriteKey)
      .setDepth(4)
      .setScale(1.5)
      .setAlpha(0.85)
    this.sprite.play(`${this.spriteKey}_down`)
    this.nameLabel = scene.add.text(x, y - 28, label, {
      fontSize: '10px', color: '#aaffaa', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5)
  }

  update(x: number, y: number, aura = 0, orbital = 0) {
    const dx = x - this.x
    const dy = y - this.y
    const moving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5
    this.x = x
    this.y = y
    this._aura = aura
    this._orbital = orbital
    this.sprite.setPosition(x, y)
    this.nameLabel.setPosition(x, y - 28)
    if (moving) {
      const dir = getDirection(dx, dy)
      this.lastDir = playDir(this.sprite, this.spriteKey, dir, this.lastDir, true)
    } else {
      playDir(this.sprite, this.spriteKey, this.lastDir, this.lastDir, false)
    }
  }

  tick(delta: number) {
    this.auraGraphic.clear()
    this.orbGraphic.clear()

    if (this._aura > 0) {
      const radius = 60 + this._aura * 30
      this.auraAngle += delta * 0.0015
      const numArcs = 3 + this._aura
      const arcLen = (Math.PI * 2 / numArcs) * 0.65

      this.auraGraphic.fillStyle(0x5511cc, 0.07)
      this.auraGraphic.fillCircle(this.x, this.y, radius)

      for (let i = 0; i < numArcs; i++) {
        const start = this.auraAngle + (i / numArcs) * Math.PI * 2
        this.auraGraphic.lineStyle(2, 0xbb66ff, 0.9)
        this.auraGraphic.beginPath()
        this.auraGraphic.arc(this.x, this.y, radius, start, start + arcLen, false)
        this.auraGraphic.strokePath()
      }

      const innerR = radius * 0.55
      for (let i = 0; i < 2; i++) {
        const start = -this.auraAngle * 1.8 + i * Math.PI
        this.auraGraphic.lineStyle(1, 0xdd99ff, 0.35)
        this.auraGraphic.beginPath()
        this.auraGraphic.arc(this.x, this.y, innerR, start, start + Math.PI * 0.6, false)
        this.auraGraphic.strokePath()
      }
    }

    if (this._orbital > 0) {
      const ORBIT_RADIUS = 85
      const ORB_RADIUS = 9
      this.orbAngle += delta * 0.0018

      for (let i = 0; i < this._orbital; i++) {
        const angle = this.orbAngle + (i / this._orbital) * Math.PI * 2
        const ox = this.x + Math.cos(angle) * ORBIT_RADIUS
        const oy = this.y + Math.sin(angle) * ORBIT_RADIUS

        this.orbGraphic.fillStyle(0x8833ff, 0.18)
        this.orbGraphic.fillCircle(ox, oy, ORB_RADIUS + 6)
        this.orbGraphic.fillStyle(0xcc88ff, 1)
        this.orbGraphic.fillCircle(ox, oy, ORB_RADIUS)
        this.orbGraphic.fillStyle(0xeeddff, 1)
        this.orbGraphic.fillCircle(ox, oy, ORB_RADIUS * 0.5)
        this.orbGraphic.fillStyle(0xffffff, 0.85)
        this.orbGraphic.fillCircle(ox - 3, oy - 3, 3)
      }
    }
  }

  destroy() {
    this.sprite.destroy()
    this.nameLabel.destroy()
    this.auraGraphic.destroy()
    this.orbGraphic.destroy()
  }
}
