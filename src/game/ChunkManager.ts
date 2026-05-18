import Phaser from 'phaser'

const CHUNK_TILES  = 10
const TILE_SIZE    = 64
const CHUNK_PX     = CHUNK_TILES * TILE_SIZE   // 640 px per chunk side
const VIEW_RADIUS  = 3                          // keeps (2R+1)² = 49 chunks active at most

const PROP_KEYS = ['prop_bush_large', 'prop_rock', 'prop_tree', 'prop_mushroom', 'prop_bones'] as const
type PropKey = typeof PROP_KEYS[number]
const PROP_CFG: Record<PropKey, { minScale: number; maxScale: number; depth: number }> = {
  prop_bush_large: { minScale: 0.9, maxScale: 1.8, depth: 1 },
  prop_rock:       { minScale: 0.7, maxScale: 1.6, depth: 1 },
  prop_tree:       { minScale: 1.0, maxScale: 1.8, depth: 2 },
  prop_mushroom:   { minScale: 0.8, maxScale: 1.4, depth: 1 },
  prop_bones:      { minScale: 0.9, maxScale: 1.5, depth: 1 },
}
const PROPS_PER_CHUNK_MIN = 4
const PROPS_PER_CHUNK_MAX = 9
const SPAWN_CLEAR_SQ      = 320 * 320   // no props within 320 px of world origin

type TilemapLayerAny = Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer

interface Chunk {
  map:   Phaser.Tilemaps.Tilemap
  layer: TilemapLayerAny
  props: Phaser.GameObjects.Image[]
}

// Deterministic LCG per chunk so tiles/props don't change on re-entry.
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

    // Spawn missing chunks in view radius
    for (let dy = -VIEW_RADIUS; dy <= VIEW_RADIUS; dy++) {
      for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        const k = this.key(cx + dx, cy + dy)
        if (!this.chunks.has(k)) this.spawn(cx + dx, cy + dy)
      }
    }

    // Destroy chunks outside view radius + 1 (hysteresis prevents thrashing)
    for (const [k, chunk] of this.chunks) {
      const comma = k.indexOf(',')
      const kcx   = parseInt(k.slice(0, comma), 10)
      const kcy   = parseInt(k.slice(comma + 1), 10)
      if (Math.abs(kcx - cx) > VIEW_RADIUS + 1 || Math.abs(kcy - cy) > VIEW_RADIUS + 1) {
        this.destroy(k, chunk)
      }
    }
  }

  private spawn(cx: number, cy: number) {
    const worldX = cx * CHUNK_PX
    const worldY = cy * CHUNK_PX
    const rand   = lcg(cx, cy)

    // Generate tile data
    const data: number[][] = []
    for (let ty = 0; ty < CHUNK_TILES; ty++) {
      const row: number[] = []
      for (let tx = 0; tx < CHUNK_TILES; tx++) {
        const r = rand()
        if (r < 0.60) row.push(1)
        else if (r < 0.82) row.push(2)
        else if (r < 0.93) row.push(3)
        else row.push(4)
      }
      data.push(row)
    }

    const map      = this.scene.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE })
    const tileset  = map.addTilesetImage('ground_tiles', 'ground_tiles', TILE_SIZE, TILE_SIZE, 0, 0)!
    const layer    = map.createLayer(0, tileset, worldX, worldY)!.setDepth(-10)

    // Scatter props
    const props: Phaser.GameObjects.Image[] = []
    const count = PROPS_PER_CHUNK_MIN + Math.floor(rand() * (PROPS_PER_CHUNK_MAX - PROPS_PER_CHUNK_MIN))
    for (let i = 0; i < count; i++) {
      const key = PROP_KEYS[Math.floor(rand() * PROP_KEYS.length)]
      const cfg = PROP_CFG[key]
      const px  = worldX + rand() * CHUNK_PX
      const py  = worldY + rand() * CHUNK_PX
      if (px * px + py * py < SPAWN_CLEAR_SQ) continue
      props.push(
        this.scene.add.image(px, py, key)
          .setDepth(cfg.depth)
          .setScale(cfg.minScale + rand() * (cfg.maxScale - cfg.minScale))
          .setAlpha(0.75 + rand() * 0.25)
      )
    }

    this.chunks.set(this.key(cx, cy), { map, layer, props })
  }

  private destroy(key: string, chunk: Chunk) {
    chunk.layer.destroy()
    chunk.map.destroy()
    for (const p of chunk.props) p.destroy()
    this.chunks.delete(key)
  }

  destroyAll() {
    for (const [k, chunk] of this.chunks) this.destroy(k, chunk)
  }
}
