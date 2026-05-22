// Mirrors src/net/protocol.ts — keep in sync

export type EnemyKind = 'basic' | 'speeder' | 'tank' | 'ranged' | 'exploder' | 'ghost' | 'charger' | 'necromancer' | 'summoner' | 'boss' | 'finalBoss'

export interface EnemySnapshot {
  id: number
  kind: EnemyKind
  x: number
  y: number
  hp: number
  maxHp: number
  isCharging?: boolean
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

export type C2SMessage =
  | { type: 'join'; characterType: string; solo?: boolean; viewportW?: number; viewportH?: number; resumeElapsed?: number; resumeLevel?: number; resumeXp?: number }
  | { type: 'input'; x: number; y: number; aura: number; orbital: number }
  | { type: 'hit'; enemyId: number; damage: number }
  | { type: 'died' }
  | { type: 'startGame' }
  | { type: 'projectile'; x: number; y: number; vx: number; vy: number }
  | { type: 'chooseUpgrade'; upgradeId: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'adminSpawn'; entity: string }

export type S2CMessage =
  | { type: 'waiting'; playerCount: number; isHost: boolean }
  | { type: 'start'; yourId: string; players: PlayerSnapshot[] }
  | { type: 'tick'; enemies: EnemySnapshot[]; players: PlayerSnapshot[]; elapsed: number }
  | { type: 'enemyDied'; enemyId: number; x: number; y: number; xpValue: number }
  | { type: 'bossWarning'; final: boolean }
  | { type: 'bossSpawn'; bossId: number; maxHp: number; final: boolean; kind: string }
  | { type: 'bossHp'; bossId: number; hp: number }
  | { type: 'gameOver'; won: boolean }
  | { type: 'playerLeft' }
  | { type: 'projectile'; playerId: string; x: number; y: number; vx: number; vy: number }
  | { type: 'bossProjectile'; enemyId: number; x: number; y: number; vx: number; vy: number }
  | { type: 'levelUp'; level: number; xp: number; xpToNext: number; choices: string[] }
  | { type: 'runSaved'; kills: number; timeSurvived: number; coins: number; won: boolean; newAchievements: string[] }
  | { type: 'surge'; enemyType: string }
  | { type: 'bossInvuln'; bossId: number; invulnerable: boolean }
  | { type: 'exploderExplode'; x: number; y: number }
  | { type: 'adminSpawnItem'; entity: string; x: number; y: number }
