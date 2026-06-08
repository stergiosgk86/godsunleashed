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

  // Bifrost Spear (24×6) — glowing cyan lance, tip points right
  g.fillStyle(0x00ccff, 0.3)
  g.fillRect(0, 0, 24, 6)
  g.fillStyle(0x44eeff, 1)
  g.fillRect(1, 1, 20, 4)
  g.fillStyle(0xaaffff, 1)
  g.fillRect(4, 2, 14, 2)
  g.fillStyle(0xffffff, 1)
  g.fillRect(8, 2, 8, 2)
  // pointed tip
  g.fillStyle(0x00eeff, 1)
  g.fillRect(21, 2, 3, 2)
  g.fillRect(22, 1, 2, 4)
  g.fillRect(23, 0, 1, 6)
  g.generateTexture('spear', 24, 6)
  g.clear()

  // Zeus thunderbolt (32×10) — horizontal zigzag drawn with layered lines
  // Tip points right; setRotation() will orient it toward the target at runtime.
  const boltPts: [number, number][] = [[2,5],[8,3],[16,7],[24,3],[30,5]]
  const drawBolt = () => {
    g.beginPath()
    g.moveTo(boltPts[0][0], boltPts[0][1])
    for (let i = 1; i < boltPts.length; i++) g.lineTo(boltPts[i][0], boltPts[i][1])
    g.strokePath()
  }
  g.lineStyle(7, 0x2244ff, 0.2); drawBolt()   // outer blue glow
  g.lineStyle(4, 0x4488ff, 0.75); drawBolt()  // blue body
  g.lineStyle(2, 0x99ccff, 1);   drawBolt()  // bright inner
  g.lineStyle(1, 0xffffff, 0.9); drawBolt()  // white hot core
  g.fillStyle(0xffffff, 0.95)
  g.fillCircle(30, 5, 2.5)                   // bright leading tip
  g.fillStyle(0x88aaff, 0.4)
  g.fillCircle(30, 5, 4)                     // tip glow
  g.generateTexture('zeus_bolt', 32, 10)
  g.clear()

  // Enemy bullet (8x8)
  g.fillStyle(0xff5500, 1)
  g.fillCircle(4, 4, 4)
  g.fillStyle(0xffaa66, 0.6)
  g.fillCircle(3, 3, 2)
  g.generateTexture('enemy_bullet', 8, 8)
  g.clear()

  // XP orb glow halo (36x36) — additive-blend soft green circles
  g.fillStyle(0x00ff88, 0.05)
  g.fillCircle(18, 18, 17)
  g.fillStyle(0x00ff88, 0.1)
  g.fillCircle(18, 18, 13)
  g.fillStyle(0x00ff88, 0.22)
  g.fillCircle(18, 18, 9)
  g.generateTexture('xp_orb_glow', 36, 36)
  g.clear()

  // XP orb blue gem (22x22) — same canvas size as green PNG
  g.fillStyle(0x001a66)
  g.fillTriangle(11, 1, 21, 11, 1, 11)
  g.fillTriangle(1, 11, 21, 11, 11, 21)
  g.fillStyle(0x2255cc)
  g.fillTriangle(11, 1, 20, 11, 2, 11)
  g.fillStyle(0x1133aa)
  g.fillTriangle(2, 11, 20, 11, 11, 21)
  g.fillStyle(0x5588ee)
  g.fillTriangle(11, 2, 18, 11, 4, 11)
  g.fillStyle(0xaaccff, 0.9)
  g.fillCircle(8, 6, 2.5)
  g.generateTexture('xp_orb_blue', 22, 22)
  g.clear()

  // XP orb blue glow (36x36)
  g.fillStyle(0x4488ff, 0.05)
  g.fillCircle(18, 18, 17)
  g.fillStyle(0x4488ff, 0.1)
  g.fillCircle(18, 18, 13)
  g.fillStyle(0x88aaff, 0.22)
  g.fillCircle(18, 18, 9)
  g.generateTexture('xp_orb_blue_glow', 36, 36)
  g.clear()

  // XP orb gold gem (22x22) — same canvas size as green PNG
  g.fillStyle(0x664400)
  g.fillTriangle(11, 1, 21, 11, 1, 11)
  g.fillTriangle(1, 11, 21, 11, 11, 21)
  g.fillStyle(0xcc8800)
  g.fillTriangle(11, 1, 20, 11, 2, 11)
  g.fillStyle(0xaa6600)
  g.fillTriangle(2, 11, 20, 11, 11, 21)
  g.fillStyle(0xffcc00)
  g.fillTriangle(11, 2, 18, 11, 4, 11)
  g.fillStyle(0xffeebb, 0.9)
  g.fillCircle(8, 6, 2.5)
  g.generateTexture('xp_orb_gold', 22, 22)
  g.clear()

  // XP orb gold glow (36x36)
  g.fillStyle(0xffcc00, 0.05)
  g.fillCircle(18, 18, 17)
  g.fillStyle(0xffcc00, 0.11)
  g.fillCircle(18, 18, 13)
  g.fillStyle(0xffdd44, 0.25)
  g.fillCircle(18, 18, 9)
  g.generateTexture('xp_orb_gold_glow', 36, 36)
  g.clear()

  // Coin (12x12) — gold circle with shine
  // Coin glow halo (32x32) — additive-blend soft gold circles
  g.fillStyle(0xffcc00, 0.05)
  g.fillCircle(16, 16, 15)
  g.fillStyle(0xffcc00, 0.11)
  g.fillCircle(16, 16, 11)
  g.fillStyle(0xffdd44, 0.22)
  g.fillCircle(16, 16, 7)
  g.generateTexture('coin_glow', 32, 32)
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

  // Health potion glow halo (40x40) — additive-blend soft red circles
  g.fillStyle(0xff2222, 0.05)
  g.fillCircle(20, 20, 19)
  g.fillStyle(0xff2222, 0.1)
  g.fillCircle(20, 20, 14)
  g.fillStyle(0xff4444, 0.22)
  g.fillCircle(20, 20, 9)
  g.generateTexture('health_potion_glow', 40, 40)
  g.clear()

  // Divine Brazier (28×36) — Greek fire bowl on tripod stand
  g.fillStyle(0x000000, 0.35)
  g.fillEllipse(14, 34, 22, 6)
  g.lineStyle(2, 0x7a5c2a)
  g.beginPath()
  g.moveTo(14, 20); g.lineTo(5, 33)
  g.moveTo(14, 20); g.lineTo(14, 34)
  g.moveTo(14, 20); g.lineTo(23, 33)
  g.strokePath()
  g.lineStyle(0, 0x000000, 0)
  g.fillStyle(0x5c3d15)
  g.fillEllipse(14, 21, 20, 8)
  g.fillStyle(0x7a5220)
  g.fillEllipse(14, 18, 18, 12)
  g.fillStyle(0x9a6a2c)
  g.fillEllipse(14, 15, 16, 5)
  g.fillStyle(0xffdd44, 0.85)
  g.fillEllipse(14, 11, 8, 9)
  g.fillStyle(0xff8822, 0.75)
  g.fillEllipse(13, 8, 6, 7)
  g.fillStyle(0xffee88, 0.9)
  g.fillEllipse(14, 9, 3, 4)
  g.generateTexture('brazier', 28, 36)
  g.clear()

  // Brazier glow halo (44×44) — soft orange additive glow
  g.fillStyle(0xff6600, 0.04)
  g.fillCircle(22, 22, 21)
  g.fillStyle(0xff8800, 0.10)
  g.fillCircle(22, 22, 15)
  g.fillStyle(0xffaa00, 0.22)
  g.fillCircle(22, 22, 9)
  g.generateTexture('brazier_glow', 44, 44)
  g.clear()

  // Flame particle (16x16) — soft white radial for particle emitter tinting
  g.fillStyle(0xffffff, 0.06)
  g.fillCircle(8, 8, 8)
  g.fillStyle(0xffffff, 0.18)
  g.fillCircle(8, 8, 6)
  g.fillStyle(0xffffff, 0.45)
  g.fillCircle(8, 8, 4)
  g.fillStyle(0xffffff, 0.9)
  g.fillCircle(8, 8, 2)
  g.generateTexture('flame_particle', 16, 16)
  g.clear()

  g.destroy()
}

export function generateTartarusTextures(scene: Phaser.Scene) {
  const g = scene.add.graphics()
  const T = 64

  // ── tartarus_tiles (256×64) — 4 dark volcanic tiles ──────────────────────────
  // Tile 0: very dark basalt base
  g.fillStyle(0x0d0807); g.fillRect(0, 0, T, T)
  g.fillStyle(0x0f0909)
  for (let i = 0; i < 20; i++) {
    const tx = (i * 17 + 3) % T, ty = (i * 23 + 7) % T
    g.fillRect(tx, ty, 2, 2)
  }
  g.fillStyle(0x090604)
  for (let i = 0; i < 12; i++) {
    g.fillRect((i * 31 + 5) % T, (i * 19 + 9) % T, 1, 2)
  }

  // Tile 1: dark with faint red lava veins
  g.fillStyle(0x0b0707); g.fillRect(T, 0, T, T)
  g.fillStyle(0x280808)  // dark red vein
  for (let i = 0; i < 6; i++) {
    const vx = T + (i * 41 + 8) % T, vy = (i * 29 + 12) % T
    g.fillRect(vx, vy, 1, (i % 3) + 1)
    g.fillRect(vx + 2, vy + 2, (i % 4) + 2, 1)
  }
  g.fillStyle(0x090505)
  for (let i = 0; i < 15; i++) {
    g.fillRect(T + (i * 13 + 4) % T, (i * 37 + 3) % T, 1, 1)
  }

  // Tile 2: normal dark with subtle orange-red glow patches
  g.fillStyle(0x0e0808); g.fillRect(T * 2, 0, T, T)
  g.fillStyle(0x1e0900)  // orange-tinted spot
  for (let i = 0; i < 5; i++) {
    const gx = T * 2 + (i * 53 + 7) % T, gy = (i * 31 + 5) % T
    g.fillCircle(gx + 2, gy + 2, 3)
  }
  g.fillStyle(0x380e00)  // brighter crack
  for (let i = 0; i < 4; i++) {
    const cx = T * 2 + (i * 47 + 11) % T, cy = (i * 43 + 17) % T
    g.fillRect(cx, cy, (i % 3) + 1, 1)
  }
  g.fillStyle(0x0b0606)
  for (let i = 0; i < 14; i++) {
    g.fillRect(T * 2 + (i * 23 + 2) % T, (i * 41 + 6) % T, 1, 1)
  }

  // Tile 3: irregular cracks with stronger lava glow
  g.fillStyle(0x0c0707); g.fillRect(T * 3, 0, T, T)
  const cracks4: [number, number, number, number][] = [[5,10,18,1],[32,6,16,2],[8,38,22,1],[40,28,14,1],[14,50,20,2]]
  for (const [cx, cy, cw, ch] of cracks4) {
    g.fillStyle(0x440a00); g.fillRect(T * 3 + cx, cy, cw, ch)
    g.fillStyle(0x260600); g.fillRect(T * 3 + cx + 1, cy + 1, cw - 2, ch)
  }
  g.fillStyle(0x180604)
  g.fillRect(T * 3 + 2,  2,  28, 26)
  g.fillRect(T * 3 + 36, 4,  24, 20)
  g.fillRect(T * 3 + 4,  34, 20, 24)
  g.fillRect(T * 3 + 30, 36, 26, 22)

  g.generateTexture('tartarus_tiles', T * 4, T)
  g.clear()

  // ── labyrinth_floor (256×64) — 4 stone-block tiles ────────────────────────────
  // Tile 0: base stone block
  g.fillStyle(0x141218); g.fillRect(0, 0, T, T)
  // horizontal grout lines at y=20 and y=42
  g.fillStyle(0x0c0a10)
  g.fillRect(0, 20, T, 2); g.fillRect(0, 42, T, 2)
  // vertical grout (offset on alternating rows)
  g.fillRect(32, 0, 2, 20); g.fillRect(16, 22, 2, 20); g.fillRect(48, 22, 2, 20); g.fillRect(32, 44, 2, 20)
  // block face highlights
  g.fillStyle(0x201e26)
  g.fillRect(1, 1, 30, 1); g.fillRect(1, 1, 1, 18)
  g.fillRect(1, 22, 14, 1); g.fillRect(1, 22, 1, 19)
  g.fillRect(33, 22, 14, 1); g.fillRect(33, 22, 1, 19)

  // Tile 1: slightly lighter stone
  g.fillStyle(0x181620); g.fillRect(T, 0, T, T)
  g.fillStyle(0x0e0c14)
  g.fillRect(T, 21, T, 2); g.fillRect(T, 44, T, 2)
  g.fillRect(T + 22, 0, 2, 21); g.fillRect(T + 44, 23, 2, 21); g.fillRect(T + 10, 46, 2, 18)
  g.fillStyle(0x24222c)
  g.fillRect(T + 1, 1, 20, 1); g.fillRect(T + 1, 1, 1, 19)

  // Tile 2: darker worn stone
  g.fillStyle(0x100e16); g.fillRect(T * 2, 0, T, T)
  g.fillStyle(0x0a0812)
  g.fillRect(T * 2, 18, T, 2); g.fillRect(T * 2, 40, T, 2)
  g.fillRect(T * 2 + 36, 0, 2, 18); g.fillRect(T * 2 + 18, 20, 2, 20); g.fillRect(T * 2 + 50, 42, 2, 22)
  g.fillStyle(0x1c1a24)
  g.fillRect(T * 2 + 1, 1, 34, 1); g.fillRect(T * 2 + 1, 1, 1, 16)

  // Tile 3: stone with moss-shadow variation
  g.fillStyle(0x121018); g.fillRect(T * 3, 0, T, T)
  g.fillStyle(0x0e0c14)
  g.fillRect(T * 3, 22, T, 2); g.fillRect(T * 3, 46, T, 2)
  g.fillRect(T * 3 + 28, 0, 2, 22); g.fillRect(T * 3 + 14, 24, 2, 22); g.fillRect(T * 3 + 42, 24, 2, 22)
  g.fillStyle(0x1e1c28)
  g.fillRect(T * 3 + 1, 1, 26, 1)
  // shadow corner
  g.fillStyle(0x0a0810)
  g.fillRect(T * 3 + 40, 40, 22, 22)

  g.generateTexture('labyrinth_floor', T * 4, T)
  g.destroy()
}
