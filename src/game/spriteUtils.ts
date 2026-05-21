import type Phaser from 'phaser'

export type Direction = 'down' | 'left' | 'right' | 'up'

const IDLE_FRAMES: Record<Direction, number> = { down: 1, left: 4, right: 7, up: 10 }

// Zeus sheet has LEFT/RIGHT rows swapped vs conventional layout, so idle frames swap too
export const ZEUS_IDLE_FRAMES: Record<Direction, number> = { down: 1, left: 7, right: 4, up: 10 }

export function getDirection(dx: number, dy: number): Direction {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'down' : 'up'
}

export function createWalkAnims(anims: Phaser.Animations.AnimationManager, key: string, frameRate = 8) {
  const rows: { dir: Direction; start: number }[] = [
    { dir: 'down',  start: 0 },
    { dir: 'left',  start: 3 },
    { dir: 'right', start: 6 },
    { dir: 'up',    start: 9 },
  ]
  for (const { dir, start } of rows) {
    anims.create({
      key: `${key}_${dir}`,
      frames: anims.generateFrameNumbers(key, { start, end: start + 2 }),
      frameRate,
      repeat: -1,
    })
  }
}

// Zeus spritesheet: rows 0-3 = walk, rows 4-7 = attack.
// The artist labeled rows 1/2 as LEFT/RIGHT but the sprites face the opposite direction,
// so we swap them: sheet row 1 ("LEFT") → game 'right', sheet row 2 ("RIGHT") → game 'left'.
export function createZeusAnims(anims: Phaser.Animations.AnimationManager) {
  const walk: { dir: Direction; start: number }[] = [
    { dir: 'down',  start: 0  },
    { dir: 'right', start: 3  }, // sheet "LEFT"  row = Zeus walking right
    { dir: 'left',  start: 6  }, // sheet "RIGHT" row = Zeus walking left
    { dir: 'up',    start: 9  },
  ]
  for (const { dir, start } of walk) {
    anims.create({
      key: `char_zeus_${dir}`,
      frames: anims.generateFrameNumbers('char_zeus', { start, end: start + 2 }),
      frameRate: 8,
      repeat: -1,
    })
  }

  const attack: { dir: Direction; start: number }[] = [
    { dir: 'down',  start: 12 },
    { dir: 'right', start: 15 }, // same swap
    { dir: 'left',  start: 18 },
    { dir: 'up',    start: 21 },
  ]
  for (const { dir, start } of attack) {
    anims.create({
      key: `char_zeus_attack_${dir}`,
      frames: anims.generateFrameNumbers('char_zeus', { start, end: start + 2 }),
      frameRate: 6,
      repeat: 0,
    })
  }
}

export function playDir(
  sprite: Phaser.GameObjects.Sprite,
  key: string,
  dir: Direction,
  lastDir: Direction,
  moving: boolean,
  idleFrames: Record<Direction, number> = IDLE_FRAMES
): Direction {
  if (!sprite.active || !sprite.anims) return lastDir
  if (!moving) {
    if (sprite.anims.isPlaying) {
      sprite.anims.stop()
      sprite.setFrame(idleFrames[lastDir])
    }
    return lastDir
  }
  const animKey = `${key}_${dir}`
  if (dir !== lastDir || !sprite.anims.isPlaying) sprite.play(animKey)
  return dir
}
