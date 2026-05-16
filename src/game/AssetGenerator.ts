import Phaser from 'phaser'

const TILE = 64

export function generateBushTexture(scene: Phaser.Scene) {
  const g = scene.add.graphics()

  // Bush (32x20): overlapping dark-green circles with a lighter top cluster
  g.fillStyle(0x0e2a08)
  g.fillCircle(16, 13, 11)
  g.fillStyle(0x0c2006)
  g.fillCircle(9,  14, 8)
  g.fillStyle(0x0c2006)
  g.fillCircle(23, 14, 8)
  g.fillStyle(0x183d10)
  g.fillCircle(13, 8,  7)
  g.fillStyle(0x162d0e)
  g.fillCircle(21, 9,  5)

  g.generateTexture('bush', 32, 20)
  g.destroy()
}

export function generateTilesetTexture(scene: Phaser.Scene) {
  const g = scene.add.graphics()

  // Tile 0 – dark base ground (map index 1)
  g.fillStyle(0x0d0d20)
  g.fillRect(0, 0, TILE, TILE)
  g.fillStyle(0x111128)
  for (let y = 0; y < TILE; y += 16) g.fillRect(0, y, TILE, 1)
  for (let x = 0; x < TILE; x += 16) g.fillRect(x, 0, 1, TILE)
  g.fillStyle(0x141430)
  g.fillRect(0, 0, 3, 3)
  g.fillRect(TILE - 3, 0, 3, 3)
  g.fillRect(0, TILE - 3, 3, 3)
  g.fillRect(TILE - 3, TILE - 3, 3, 3)

  // Tile 1 – darker variant (map index 2)
  g.fillStyle(0x0b0b1c)
  g.fillRect(TILE, 0, TILE, TILE)
  g.fillStyle(0x10102a)
  for (let y = 8; y < TILE; y += 16)
    for (let x = 8; x < TILE; x += 16)
      g.fillRect(TILE + x, y, 2, 2)
  for (let y = 16; y < TILE; y += 16)
    for (let x = 0; x < TILE; x += 16)
      g.fillRect(TILE + x, y, 1, 1)

  // Tile 2 – stone floor (map index 3)
  g.fillStyle(0x0f0f22)
  g.fillRect(TILE * 2, 0, TILE, TILE)
  const blocks: [number, number, number, number][] = [
    [2, 2, 28, 28], [34, 2, 28, 28], [2, 34, 28, 28], [34, 34, 28, 28],
  ]
  const stoneColors = [0x1a1a30, 0x181828, 0x181828, 0x1c1c32]
  blocks.forEach(([bx, by, bw, bh], i) => {
    g.fillStyle(stoneColors[i])
    g.fillRect(TILE * 2 + bx, by, bw, bh)
    g.fillStyle(0x20203a)
    g.fillRect(TILE * 2 + bx, by, bw, 1)
    g.fillRect(TILE * 2 + bx, by, 1, bh)
  })

  // Tile 3 – moss ground (map index 4)
  g.fillStyle(0x0c160c)
  g.fillRect(TILE * 3, 0, TILE, TILE)
  const moss = [[12,10,5],[28,18,4],[50,12,6],[10,38,4],[36,42,5],[52,50,4],[20,55,5],[44,28,3]]
  for (const [mx, my, mr] of moss) {
    g.fillStyle(0x122012)
    g.fillCircle(TILE * 3 + mx, my, mr)
    g.fillStyle(0x0a2a0a)
    g.fillCircle(TILE * 3 + mx + 2, my - 1, Math.max(1, mr - 2))
  }

  g.generateTexture('ground_tiles', TILE * 4, TILE)
  g.destroy()
}

// Generates textures for non-character game objects (projectiles, orbs)
export function generateAssets(scene: Phaser.Scene) {
  const g = scene.add.graphics()

  // Player projectile (14x8)
  g.fillStyle(0xffee00, 1)
  g.fillCircle(4, 4, 4)
  g.fillStyle(0xffffff, 0.9)
  g.fillCircle(10, 4, 3)
  g.generateTexture('projectile', 14, 8)
  g.clear()

  // Enemy bullet (8x8)
  g.fillStyle(0xff5500, 1)
  g.fillCircle(4, 4, 4)
  g.fillStyle(0xffaa66, 0.6)
  g.fillCircle(3, 3, 2)
  g.generateTexture('enemy_bullet', 8, 8)
  g.clear()

  // XP orb (12x12)
  g.fillStyle(0x00dd66, 1)
  g.fillTriangle(6, 0, 12, 6, 6, 12)
  g.fillTriangle(6, 0, 0, 6, 6, 12)
  g.fillStyle(0x88ffcc, 0.7)
  g.fillTriangle(4, 2, 8, 2, 6, 6)
  g.generateTexture('xp_orb', 12, 12)
  g.clear()

  // Coin (12x12) — gold circle with shine
  g.fillStyle(0xcc9900, 1)
  g.fillCircle(6, 6, 6)
  g.fillStyle(0xffdd33, 1)
  g.fillCircle(6, 6, 4)
  g.fillStyle(0xffee88, 0.9)
  g.fillCircle(4, 4, 2)
  g.fillStyle(0xaa7700, 0.5)
  g.fillCircle(7, 8, 2)
  g.generateTexture('coin', 12, 12)
  g.clear()

  // Blood Tome (16x16) — crimson diamond
  g.fillStyle(0x660011)
  g.fillTriangle(8, 0, 16, 8, 8, 16)
  g.fillTriangle(8, 0, 0, 8, 8, 16)
  g.fillStyle(0xcc1122)
  g.fillTriangle(8, 2, 14, 8, 8, 14)
  g.fillTriangle(8, 2, 2, 8, 8, 14)
  g.fillStyle(0xff4455, 0.9)
  g.fillTriangle(8, 4, 12, 8, 8, 12)
  g.fillTriangle(8, 4, 4, 8, 8, 12)
  g.fillStyle(0xff9999, 0.8)
  g.fillRect(7, 5, 2, 2)
  g.generateTexture('item_blood_tome', 16, 16)
  g.clear()

  // Eldritch Eye (16x16) — purple eye circle
  g.fillStyle(0x440066)
  g.fillCircle(8, 8, 8)
  g.fillStyle(0x8822cc)
  g.fillCircle(8, 8, 6)
  g.fillStyle(0xcc44ff)
  g.fillCircle(8, 8, 4)
  g.fillStyle(0x220033)
  g.fillCircle(8, 8, 2)
  g.fillStyle(0xffffff, 0.9)
  g.fillRect(6, 6, 1, 1)
  g.generateTexture('item_eldritch_eye', 16, 16)
  g.clear()

  // Shadow Cloak (16x16) — teal crystal shard
  g.fillStyle(0x003344)
  g.fillTriangle(8, 0, 14, 10, 2, 10)
  g.fillRect(3, 10, 10, 4)
  g.fillStyle(0x0099aa)
  g.fillTriangle(8, 2, 12, 9, 4, 9)
  g.fillRect(4, 9, 8, 3)
  g.fillStyle(0x44ddff, 0.9)
  g.fillTriangle(8, 4, 10, 8, 6, 8)
  g.fillStyle(0xffffff, 0.7)
  g.fillRect(7, 3, 1, 3)
  g.generateTexture('item_shadow_cloak', 16, 16)
  g.clear()

  g.destroy()
}
