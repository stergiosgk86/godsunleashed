import Phaser from 'phaser'
import { SPRITE_URLS } from './assets'
import { createWalkAnims } from './spriteUtils'

const SHEETS: Array<{ key: string; url: string; frameWidth: number; frameHeight: number; frameRate?: number }> = [
  { key: 'player',         url: SPRITE_URLS.player,       frameWidth: 32, frameHeight: 32 },
  { key: 'char_rogue',    url: SPRITE_URLS.charRogue,    frameWidth: 32, frameHeight: 32 },
  { key: 'char_witch',    url: SPRITE_URLS.charWitch,    frameWidth: 32, frameHeight: 32 },
  { key: 'char_vampire',  url: SPRITE_URLS.charVampire,  frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_basic',    url: SPRITE_URLS.enemyBasic,   frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_speeder',  url: SPRITE_URLS.enemySpeeder, frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_tank',     url: SPRITE_URLS.enemyTank,    frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_ranged',    url: SPRITE_URLS.enemyRanged,    frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_exploder',  url: SPRITE_URLS.enemyExploder,  frameWidth: 32, frameHeight: 32 },
  { key: 'boss',            url: SPRITE_URLS.boss,           frameWidth: 96, frameHeight: 96, frameRate: 6 },
]

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload() {
    const { width, height } = this.scale

    this.add.text(width / 2, height / 2 - 40, 'Loading...', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.add.rectangle(width / 2, height / 2, 304, 24)
      .setStrokeStyle(2, 0x444466)
    const bar = this.add.rectangle(width / 2 - 150, height / 2, 0, 18, 0x00cc66)

    this.load.on('progress', (v: number) => {
      bar.width = 300 * v
      bar.x = width / 2 - 150 + bar.width / 2
    })

    for (const { key, url, frameWidth, frameHeight } of SHEETS) {
      this.load.spritesheet(key, url, { frameWidth, frameHeight })
    }
  }

  create() {
    for (const { key, frameRate } of SHEETS) {
      createWalkAnims(this.anims, key, frameRate)
    }
    this.scene.start('MainScene')
  }
}
