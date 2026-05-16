import Phaser from 'phaser'
import { type Direction, getDirection, playDir } from './spriteUtils'

const CHAR_SPRITE: Record<string, string> = {
  knight:  'player',
  rogue:   'char_rogue',
  witch:   'char_witch',
  vampire: 'char_vampire',
}

export class RemotePlayer {
  x: number
  y: number
  private sprite: Phaser.GameObjects.Sprite
  private spriteKey: string
  private lastDir: Direction = 'down'
  private nameLabel: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, x: number, y: number, characterType: string, label: string) {
    this.x = x
    this.y = y
    this.spriteKey = CHAR_SPRITE[characterType] ?? 'player'
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

  update(x: number, y: number) {
    const dx = x - this.x
    const dy = y - this.y
    const moving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5
    this.x = x
    this.y = y
    this.sprite.setPosition(x, y)
    this.nameLabel.setPosition(x, y - 28)
    if (moving) {
      const dir = getDirection(dx, dy)
      this.lastDir = playDir(this.sprite, this.spriteKey, dir, this.lastDir, true)
    } else {
      playDir(this.sprite, this.spriteKey, this.lastDir, this.lastDir, false)
    }
  }

  destroy() {
    this.sprite.destroy()
    this.nameLabel.destroy()
  }
}
