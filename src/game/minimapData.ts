export interface MinimapEnemy {
  x: number
  y: number
  isBoss: boolean
}

// Plain mutable object — Phaser writes, React canvas reads. No re-renders.
export const minimapData = {
  playerX: 2000,
  playerY: 2000,
  enemies: [] as MinimapEnemy[],
  worldSize: 4000,
}
