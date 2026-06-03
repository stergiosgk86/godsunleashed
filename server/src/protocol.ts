// Mirrors src/net/protocol.ts — keep in sync

export type EnemyKind = 'basic' | 'speeder' | 'tank' | 'ranged' | 'exploder' | 'ghost' | 'charger' | 'necromancer' | 'summoner' | 'boss' | 'finalBoss'
  | 'drifter' | 'scurrier' | 'lurker' | 'mummy' | 'jackal' | 'cultist' | 'golem' | 'knight' | 'archfiend'
  | 'veteran' | 'brute' | 'revenant' | 'warlord' | 'titan'  // client-only fallback types (server never spawns these)

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
  ravens: number
  username: string
}

export type C2SMessage =
  | { type: 'join'; characterType: string; solo?: boolean; stage?: number; viewportW?: number; viewportH?: number; resumeElapsed?: number; resumeLevel?: number; resumeXp?: number }
  | { type: 'input'; x: number; y: number; aura: number; orbital: number }
  | { type: 'hit'; enemyId: number; damage: number }
  | { type: 'auraHit'; enemyId: number; damage: number }
  | { type: 'died' }
  | { type: 'startGame' }
  | { type: 'projectile'; x: number; y: number; vx: number; vy: number }
  | { type: 'chooseUpgrade'; upgradeId: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'adminSpawn'; entity: string }
  | { type: 'adminGiveUpgrade'; upgradeId: string; targetLevel: number }
  | { type: 'adminClearUpgrades' }
  | { type: 'collectXP'; amount: number }

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
  | { type: 'xpGrant'; xp: number; xpToNext: number }
  | { type: 'runSaved'; kills: number; timeSurvived: number; coins: number; won: boolean; newAchievements: string[]; newWeaponUnlocks: string[] }
  | { type: 'surge'; enemyType: string }
  | { type: 'bossInvuln'; bossId: number; invulnerable: boolean }
  | { type: 'exploderExplode'; x: number; y: number }
  | { type: 'adminSpawnItem'; entity: string; x: number; y: number }
  | { type: 'adminGrantUpgrade'; upgradeId: string }
  | { type: 'adminSetUpgrade'; upgradeId: string; level: number }
  | { type: 'adminClearUpgrades' }
  | { type: 'roleChanged'; role: string }
  | { type: 'playerOnline'; username: string; userId: number; silent?: boolean }
  | { type: 'playerOffline'; userId: number }
  | { type: 'playerProfileUpdate'; userId: number; coins: number; upgrades: Record<string, number> | null; last_active: string | null; unlocked_stages: number[] | null; role: string | null }
  | { type: 'adminOnlineSnapshot'; onlineUserIds: number[] }
  | { type: 'profileSync' }
