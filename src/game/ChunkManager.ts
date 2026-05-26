import Phaser from 'phaser'

const CHUNK_PX          = 640
const VIEW_RADIUS       = 3
const TREES_PER_CHUNK_MIN = 1
const TREES_PER_CHUNK_MAX = 3
const TREE_SCALE_MIN    = 0.07
const TREE_SCALE_MAX    = 0.16
const ROCKS_PER_CHUNK_MIN = 1
const ROCKS_PER_CHUNK_MAX = 2
const ROCK_SCALE_MIN    = 0.10
const ROCK_SCALE_MAX    = 0.22
const ROCK_FRAMES       = 6
const SPAWN_CLEAR_SQ    = 400 * 400   // no trees/rocks within 400 px of world origin

interface Chunk { decos: Phaser.GameObjects.Image[] }

function lcg(cx: number, cy: number) {
  let s = (Math.imul(cx, 1619) ^ Math.imul(cy, 31337)) >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export class ChunkManager {
  private scene:  Phaser.Scene
  private chunks  = new Map<string, Chunk>()

  constructor(scene: Phaser.Scene) { this.scene = scene }

  private key(cx: number, cy: number) { return `${cx},${cy}` }
  private worldChunk(wx: number, wy: number) {
    return { cx: Math.floor(wx / CHUNK_PX), cy: Math.floor(wy / CHUNK_PX) }
  }

  update(playerX: number, playerY: number) {
    const { cx, cy } = this.worldChunk(playerX, playerY)
    for (let dy = -VIEW_RADIUS; dy <= VIEW_RADIUS; dy++)
      for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        const k = this.key(cx + dx, cy + dy)
        if (!this.chunks.has(k)) this.spawn(cx + dx, cy + dy)
      }
    for (const [k, chunk] of this.chunks) {
      const comma = k.indexOf(',')
      const kcx = parseInt(k.slice(0, comma), 10)
      const kcy = parseInt(k.slice(comma + 1), 10)
      if (Math.abs(kcx - cx) > VIEW_RADIUS + 1 || Math.abs(kcy - cy) > VIEW_RADIUS + 1)
        this.destroy(k, chunk)
    }
  }

  private spawn(cx: number, cy: number) {
    const worldX = cx * CHUNK_PX
    const worldY = cy * CHUNK_PX
    const rand   = lcg(cx, cy)
    const decos: Phaser.GameObjects.Image[] = []

    const treeCount = TREES_PER_CHUNK_MIN + Math.floor(rand() * (TREES_PER_CHUNK_MAX - TREES_PER_CHUNK_MIN))
    for (let i = 0; i < treeCount; i++) {
      const px = worldX + rand() * CHUNK_PX
      const py = worldY + rand() * CHUNK_PX
      if (px * px + py * py < SPAWN_CLEAR_SQ) continue
      decos.push(
        this.scene.add.image(px, py, 'tree')
          .setDepth(-9)
          .setScale(TREE_SCALE_MIN + rand() * (TREE_SCALE_MAX - TREE_SCALE_MIN))
      )
    }

    const rockCount = ROCKS_PER_CHUNK_MIN + Math.floor(rand() * (ROCKS_PER_CHUNK_MAX - ROCKS_PER_CHUNK_MIN))
    for (let i = 0; i < rockCount; i++) {
      const px = worldX + rand() * CHUNK_PX
      const py = worldY + rand() * CHUNK_PX
      if (px * px + py * py < SPAWN_CLEAR_SQ) continue
      const frame = Math.floor(rand() * ROCK_FRAMES)
      decos.push(
        this.scene.add.image(px, py, 'rock', frame)
          .setDepth(-9)
          .setScale(ROCK_SCALE_MIN + rand() * (ROCK_SCALE_MAX - ROCK_SCALE_MIN))
      )
    }

    this.chunks.set(this.key(cx, cy), { decos })
  }

  private destroy(key: string, chunk: Chunk) {
    for (const d of chunk.decos) d.destroy()
    this.chunks.delete(key)
  }

  destroyAll() {
    for (const [k, chunk] of this.chunks) this.destroy(k, chunk)
  }
}
