import Phaser from 'phaser'
import { SPRITE_URLS } from './assets'
import { createWalkAnims, createZeusAnims, createApolloAnims, createHadesAnims, createChronosAnims } from './spriteUtils'

const SHEETS: Array<{ key: string; url: string; frameWidth: number; frameHeight: number; frameRate?: number }> = [
  { key: 'player',         url: SPRITE_URLS.player,       frameWidth: 32, frameHeight: 32 },
  { key: 'char_rogue',    url: SPRITE_URLS.charRogue,    frameWidth: 32, frameHeight: 32 },
  { key: 'char_witch',    url: SPRITE_URLS.charWitch,    frameWidth: 32, frameHeight: 32 },
  { key: 'char_shade',   url: SPRITE_URLS.charShade,   frameWidth: 32, frameHeight: 32 },
  { key: 'char_zeus',    url: SPRITE_URLS.charZeus,    frameWidth: 96, frameHeight: 96 },
  { key: 'char_ares',    url: SPRITE_URLS.charAres,    frameWidth: 64, frameHeight: 64 },
  { key: 'char_poseidon', url: SPRITE_URLS.charPoseidon, frameWidth: 96, frameHeight: 96 },
  { key: 'char_apollo',   url: SPRITE_URLS.charApollo,   frameWidth: 96, frameHeight: 96 },
  { key: 'char_hades',    url: SPRITE_URLS.charHades,    frameWidth: 96, frameHeight: 96 },
  { key: 'char_chronos',  url: SPRITE_URLS.charChronos,  frameWidth: 96, frameHeight: 96 },
  { key: 'enemy_basic',    url: SPRITE_URLS.enemyBasic,   frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_speeder',  url: SPRITE_URLS.enemySpeeder, frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_tank',     url: SPRITE_URLS.enemyTank,    frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_ranged',      url: SPRITE_URLS.enemyRanged,      frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_exploder',    url: SPRITE_URLS.enemyExploder,    frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_ghost',       url: SPRITE_URLS.enemyGhost,       frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_charger',     url: SPRITE_URLS.enemyCharger,     frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_necromancer', url: SPRITE_URLS.enemyNecromancer, frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_veteran',     url: SPRITE_URLS.enemyVeteran,    frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_brute',       url: SPRITE_URLS.enemyBrute,      frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_revenant',    url: SPRITE_URLS.enemyRevenant,   frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_warlord',     url: SPRITE_URLS.enemyWarlord,    frameWidth: 32, frameHeight: 32 },
  { key: 'enemy_titan',       url: SPRITE_URLS.enemyTitan,      frameWidth: 32, frameHeight: 32 },
  { key: 'boss',              url: SPRITE_URLS.boss,             frameWidth: 96, frameHeight: 96, frameRate: 6 },
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
      .setStrokeStyle(2, 0x666688)
    const bar = this.add.rectangle(width / 2 - 150, height / 2, 0, 18, 0x00cc66)
    bar.setOrigin(0, 0.5)

    this.load.on('progress', (v: number) => {
      bar.width = 300 * v
    })

    for (const { key, url, frameWidth, frameHeight } of SHEETS) {
      this.load.spritesheet(key, url, { frameWidth, frameHeight })
    }
    this.load.image('xp_orb', SPRITE_URLS.xpOrbSprite)
    this.load.image('health_potion', SPRITE_URLS.healthPotionSprite)
    this.load.image('coin', SPRITE_URLS.coinSprite)
    this.load.image('boomerang', SPRITE_URLS.boomerangSprite)
    this.load.image('axe', SPRITE_URLS.axeSprite)
    this.load.image('ground_tiles', SPRITE_URLS.grassTileset)
    this.load.image('tree', SPRITE_URLS.treeSprite)
    this.load.spritesheet('rock', SPRITE_URLS.rockSprite, { frameWidth: 512, frameHeight: 512 })
    this.load.image('floor_stage2', SPRITE_URLS.floorStage2)
    this.load.image('wall_stage2', SPRITE_URLS.wallStage2)
  }

  create() {
    for (const { key, frameRate } of SHEETS) {
      if (key !== 'char_zeus' && key !== 'char_apollo' && key !== 'char_hades' && key !== 'char_chronos') createWalkAnims(this.anims, key, frameRate)
    }
    createZeusAnims(this.anims)
    createApolloAnims(this.anims)
    createHadesAnims(this.anims)
    createChronosAnims(this.anims)
    this.scene.start('MainScene')
  }
}
