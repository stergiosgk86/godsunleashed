import type Phaser from 'phaser'

export type Direction = 'down' | 'left' | 'right' | 'up'

const IDLE_FRAMES: Record<Direction, number> = { down: 1, left: 4, right: 7, up: 10 }

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

export function playDir(
  sprite: Phaser.GameObjects.Sprite,
  key: string,
  dir: Direction,
  lastDir: Direction,
  moving: boolean
): Direction {
  if (!moving) {
    if (sprite.anims.isPlaying) {
      sprite.anims.stop()
      sprite.setFrame(IDLE_FRAMES[lastDir])
    }
    return lastDir
  }
  const animKey = `${key}_${dir}`
  if (dir !== lastDir || !sprite.anims.isPlaying) sprite.play(animKey)
  return dir
}
