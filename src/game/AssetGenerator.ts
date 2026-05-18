import Phaser from 'phaser'

const TILE = 64

export function generatePropTextures(scene: Phaser.Scene) {
  const g = scene.add.graphics()

  // Large bush (40x26)
  g.fillStyle(0x0d2e09); g.fillCircle(20, 17, 14)
  g.fillStyle(0x0b2407); g.fillCircle(10, 18, 10); g.fillCircle(30, 18, 10)
  g.fillStyle(0x163d0f); g.fillCircle(15, 10, 9); g.fillCircle(26, 11, 7)
  g.fillStyle(0x1a4a12); g.fillCircle(20, 7, 6)
  g.fillStyle(0x102808); g.fillCircle(8, 21, 5); g.fillCircle(32, 20, 5)
  g.generateTexture('prop_bush_large', 40, 26)
  g.clear()

  // Rock cluster (30x22)
  g.fillStyle(0x1c1c28); g.fillEllipse(15, 14, 28, 16)
  g.fillStyle(0x252535); g.fillEllipse(10, 12, 16, 12); g.fillEllipse(22, 11, 14, 10)
  g.fillStyle(0x2e2e42); g.fillEllipse(10, 10, 10, 7); g.fillEllipse(21, 9, 9, 6)
  g.fillStyle(0x323248); g.fillRect(8, 8, 3, 2); g.fillRect(20, 7, 2, 2)
  g.fillStyle(0x18182a); g.fillEllipse(15, 18, 20, 6)
  g.generateTexture('prop_rock', 30, 22)
  g.clear()

  // Dead tree (20x48)
  g.fillStyle(0x1a1210); g.fillRect(8, 24, 5, 24)
  g.fillStyle(0x221614); g.fillRect(9, 22, 3, 4)
  g.fillStyle(0x1a1210)
  g.fillRect(3, 14, 5, 3); g.fillRect(13, 18, 5, 3)
  g.fillRect(1, 8, 4, 3);  g.fillRect(15, 11, 4, 3)
  g.fillStyle(0x150e0d)
  g.fillRect(3, 13, 2, 2); g.fillRect(14, 17, 2, 2)
  g.fillRect(1, 7, 2, 2);  g.fillRect(16, 10, 2, 2)
  g.generateTexture('prop_tree', 20, 48)
  g.clear()

  // Mushroom cluster (24x20)
  g.fillStyle(0x4a1a22); g.fillEllipse(8, 9, 14, 10)
  g.fillStyle(0x6b2030); g.fillEllipse(8, 8, 12, 8)
  g.fillStyle(0xffffff, 0.3); g.fillCircle(6, 6, 2); g.fillCircle(10, 5, 1)
  g.fillStyle(0x2a1218); g.fillRect(7, 9, 2, 7)
  g.fillStyle(0x3a1820); g.fillEllipse(19, 14, 10, 8)
  g.fillStyle(0x552030); g.fillEllipse(19, 13, 8, 6)
  g.fillStyle(0x2a1218); g.fillRect(18, 14, 2, 5)
  g.generateTexture('prop_mushroom', 24, 20)
  g.clear()

  // Bone pile (28x14)
  g.fillStyle(0x3a3830)
  g.fillEllipse(14, 9, 26, 10)
  g.fillStyle(0x4a4840)
  g.fillEllipse(8, 7, 10, 8); g.fillEllipse(20, 6, 9, 7)
  g.fillStyle(0x555248)
  g.fillRect(4, 9, 8, 2); g.fillRect(14, 10, 10, 2); g.fillRect(6, 4, 3, 6); g.fillRect(19, 3, 3, 5)
  g.fillStyle(0x5e5a50)
  g.fillCircle(8, 6, 3); g.fillCircle(20, 5, 3)
  g.generateTexture('prop_bones', 28, 14)
  g.clear()

  g.destroy()
}

export function generateTilesetTexture(scene: Phaser.Scene) {
  const g = scene.add.graphics()

  // Tile 0 – dark grass base (map index 1, 60%)
  g.fillStyle(0x0c1a0c); g.fillRect(0, 0, TILE, TILE)
  // Subtle grass texture
  g.fillStyle(0x0f2010)
  for (let i = 0; i < 18; i++) {
    const gx = (i * 17 + 3) % TILE, gy = (i * 23 + 7) % TILE
    g.fillRect(gx, gy, 2, 3); g.fillRect(gx + 4, gy + 2, 1, 2)
  }
  g.fillStyle(0x0a1509)
  for (let i = 0; i < 10; i++) {
    const gx = (i * 31 + 11) % TILE, gy = (i * 19 + 5) % TILE
    g.fillRect(gx, gy, 1, 2)
  }

  // Tile 1 – darker grass patch (map index 2, 22%)
  g.fillStyle(0x091508); g.fillRect(TILE, 0, TILE, TILE)
  g.fillStyle(0x0c1c0c)
  for (let i = 0; i < 14; i++) {
    const gx = TILE + (i * 29 + 5) % TILE, gy = (i * 13 + 9) % TILE
    g.fillRect(gx, gy, 3, 2)
  }
  g.fillStyle(0x071007)
  for (let i = 0; i < 20; i++) {
    const gx = TILE + (i * 11 + 7) % TILE, gy = (i * 37 + 3) % TILE
    g.fillRect(gx, gy, 1, 1)
  }

  // Tile 2 – dirt/earth (map index 3, 11%)
  g.fillStyle(0x1a1208); g.fillRect(TILE * 2, 0, TILE, TILE)
  g.fillStyle(0x1e1509)
  for (let i = 0; i < 12; i++) {
    const gx = TILE * 2 + (i * 19 + 4) % TILE, gy = (i * 27 + 6) % TILE
    g.fillRect(gx, gy, 4, 3)
  }
  g.fillStyle(0x150e06)
  for (let i = 0; i < 8; i++) {
    const gx = TILE * 2 + (i * 37 + 13) % TILE, gy = (i * 17 + 11) % TILE
    g.fillRect(gx, gy, 2, 2)
  }
  g.fillStyle(0x211808)
  for (let i = 0; i < 6; i++) {
    const gx = TILE * 2 + (i * 43 + 7) % TILE, gy = (i * 23 + 15) % TILE
    g.fillRect(gx, gy, 3, 1)
  }

  // Tile 3 – cracked stone (map index 4, 7%)
  g.fillStyle(0x141420); g.fillRect(TILE * 3, 0, TILE, TILE)
  const cracks = [[8,12,24,3],[36,8,20,2],[4,36,28,3],[40,38,18,2],[16,52,20,2]]
  for (const [cx, cy, cw, ch] of cracks) {
    g.fillStyle(0x0c0c18); g.fillRect(TILE * 3 + cx, cy, cw, ch)
    g.fillStyle(0x1c1c2e); g.fillRect(TILE * 3 + cx, cy, cw, 1)
  }
  g.fillStyle(0x181826)
  g.fillRect(TILE * 3 + 2,  2,  30, 28)
  g.fillRect(TILE * 3 + 34, 4,  26, 24)
  g.fillRect(TILE * 3 + 4,  34, 24, 26)
  g.fillRect(TILE * 3 + 32, 36, 28, 22)
  g.fillStyle(0x1e1e30)
  g.fillRect(TILE * 3 + 2,  2,  30, 1); g.fillRect(TILE * 3 + 2, 2, 1, 28)
  g.fillRect(TILE * 3 + 34, 4,  26, 1); g.fillRect(TILE * 3 + 34, 4, 1, 24)

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

  // Health Potion (12x20) — red flask
  g.fillStyle(0x5c2a00)          // cork
  g.fillRect(4, 0, 4, 3)
  g.fillStyle(0x660000)          // neck
  g.fillRect(4, 3, 4, 5)
  g.fillStyle(0x880000)          // body shadow
  g.fillCircle(6, 14, 6)
  g.fillStyle(0xdd1111)          // body fill
  g.fillCircle(6, 14, 4)
  g.fillStyle(0xff5555, 0.9)     // bright inner
  g.fillCircle(6, 14, 2)
  g.fillStyle(0xff9999, 0.85)    // left highlight
  g.fillRect(2, 11, 2, 4)
  g.fillStyle(0xffffff, 0.75)    // shine dot
  g.fillRect(2, 11, 1, 2)
  g.generateTexture('health_potion', 12, 20)
  g.clear()

  g.destroy()
}
