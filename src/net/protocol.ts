export type EnemyKind = 'basic' | 'speeder' | 'tank' | 'ranged' | 'exploder' | 'boss' | 'finalBoss'

export interface EnemySnapshot {
  id: number
  kind: EnemyKind
  x: number
  y: number
  hp: number
  maxHp: number
}

export interface PlayerSnapshot {
  id: string
  x: number
  y: number
  characterType: string
  aura: number
  orbital: number
  username: string
}

// Client → Server
export type C2SMessage =
  | { type: 'join'; characterType: string }
  | { type: 'input'; x: number; y: number; aura: number; orbital: number }
  | { type: 'hit'; enemyId: number; damage: number }
  | { type: 'died' }
  | { type: 'startGame' }
  | { type: 'projectile'; x: number; y: number; vx: number; vy: number }

// Server → Client
export type S2CMessage =
  | { type: 'waiting'; playerCount: number; isHost: boolean }
  | { type: 'start'; yourId: string; players: PlayerSnapshot[] }
  | { type: 'tick'; enemies: EnemySnapshot[]; players: PlayerSnapshot[]; elapsed: number }
  | { type: 'enemyDied'; enemyId: number; x: number; y: number; xpValue: number }
  | { type: 'bossWarning'; final: boolean }
  | { type: 'bossSpawn'; bossId: number; maxHp: number; final: boolean }
  | { type: 'bossHp'; bossId: number; hp: number }
  | { type: 'gameOver'; won: boolean }
  | { type: 'playerLeft' }
  | { type: 'projectile'; playerId: string; x: number; y: number; vx: number; vy: number }
