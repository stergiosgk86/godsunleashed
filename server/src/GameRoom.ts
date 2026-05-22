import type { WebSocket } from 'ws'
import { ServerSpawner } from './ServerSpawner.js'
import type { S2CMessage, PlayerSnapshot } from './protocol.js'
import type { PlayerRunData } from './runSaver.js'

const TICK_MS = 50
const MAX_PLAYERS = 4
const MAX_DAMAGE_FALLBACK = 200  // used before player upgrades are known
const MAX_COORD   = 600_000 // matches ±500 000 physics bounds with some margin
const MAX_VEL     = 2_000   // max projectile velocity component

// All upgrade IDs the server knows about (mirrors client UPGRADE_POOL)
const ALL_UPGRADE_IDS = [
  'dashCooldown', 'dashDistance', 'multiShot', 'piercing',
  'aura', 'auraTick', 'auraRange', 'orbital',
  'boomerang', 'flameTrail', 'bloodNova', 'vampiric',
  'lightning', 'might', 'axe', 'divineShield',
] as const
type UpgradeId = typeof ALL_UPGRADE_IDS[number]
const VALID_UPGRADE_SET = new Set<string>(ALL_UPGRADE_IDS)
const DASH_IDS = new Set<string>(['dashCooldown', 'dashDistance'])

// Mirrors client xpNeeded(level) in gameStore.ts
function xpNeeded(level: number): number {
  return Math.floor(level * (level + 4) * 2)
}

interface PlayerUpgrades {
  piercing: boolean
  multiShot: number   // 0–4
  orbital: number     // 0–3
  boomerang: boolean
  flameTrail: boolean
  bloodNova: boolean
  vampiric: boolean
  lightning: boolean
  mightPicks: number  // 0–5
  axe: boolean
  aura: boolean
  auraTick: number    // 0–3
  auraRange: number   // 0–3
  divineShield: boolean
}

function emptyUpgrades(): PlayerUpgrades {
  return {
    piercing: false, multiShot: 0, orbital: 0,
    boomerang: false, flameTrail: false, bloodNova: false,
    vampiric: false, lightning: false, mightPicks: 0,
    axe: false, aura: false, auraTick: 0, auraRange: 0, divineShield: false,
  }
}

// Characters that start the run with a weapon already unlocked.
// These are pre-set so those weapons are never offered as level-up choices.
function startingUpgrades(characterType: string): Partial<PlayerUpgrades> {
  if (characterType === 'witch')    return { aura: true }
  if (characterType === 'zeus')     return { lightning: true }
  if (characterType === 'poseidon') return { boomerang: true }
  return {}
}

function pickUpgradeChoices(u: PlayerUpgrades, isMelee: boolean): string[] {
  const pool = ALL_UPGRADE_IDS.filter(id => {
    if (isMelee && (id === 'multiShot' || id === 'piercing')) return false
    if (id === 'piercing'    && u.piercing)          return false
    if (id === 'multiShot'   && u.multiShot >= 4)    return false
    if (id === 'orbital'     && u.orbital >= 3)      return false
    if (id === 'boomerang'   && u.boomerang)         return false
    if (id === 'flameTrail'  && u.flameTrail)        return false
    if (id === 'bloodNova'   && u.bloodNova)         return false
    if (id === 'vampiric'    && u.vampiric)          return false
    if (id === 'lightning'   && u.lightning)         return false
    if (id === 'might'       && u.mightPicks >= 5)   return false
    if (id === 'axe'         && u.axe)               return false
    if (id === 'divineShield'&& u.divineShield)      return false
    if (id === 'aura'        && u.aura)              return false
    if (id === 'auraTick'    && !u.aura)             return false
    if (id === 'auraTick'    && u.auraTick >= 3)     return false
    if (id === 'auraRange'   && !u.aura)             return false
    if (id === 'auraRange'   && u.auraRange >= 3)    return false
    return true
  })

  const shuffled: string[] = (pool as string[]).slice().sort(() => Math.random() - 0.5)
  const choices: string[] = shuffled.slice(0, 3)

  // At most one dash upgrade per offer
  const dashCount = choices.filter((id: string) => DASH_IDS.has(id)).length
  if (dashCount > 1) {
    let dupIdx = -1
    for (let i = choices.length - 1; i >= 0; i--) {
      if (DASH_IDS.has(choices[i])) { dupIdx = i; break }
    }
    const replacement = shuffled.find((id: string) => !DASH_IDS.has(id) && !choices.includes(id))
    if (dupIdx >= 0 && replacement) choices[dupIdx] = replacement
  }
  return choices
}

// Per-player coin drop rate (2% per kill, no luck rank knowledge server-side)
const COIN_DROP_CHANCE = 0.02

interface Player {
  id: string
  userId: number
  ws: WebSocket
  x: number
  y: number
  viewW: number
  viewH: number
  characterType: string
  username: string
  dead: boolean
  paused: boolean
  isHost: boolean
  aura: number
  orbital: number
  // Server-authoritative XP/leveling
  xp: number
  level: number
  pendingChoices: string[] | null  // non-null while waiting for chooseUpgrade
  upgrades: PlayerUpgrades
  // Server-tracked run stats
  kills: number
  bossKills: number
  coins: number
  damageDealt: number
}

export class GameRoom {
  private players: Player[] = []
  private spawner = new ServerSpawner()
  private interval: ReturnType<typeof setInterval> | null = null
  private bosses = new Map<number, number>()  // id → maxHp
  private started = false
  private finished = false
  private startMs = 0
  private readonly isSolo: boolean

  // Called once when the game ends (won or all dead). Set by the room creator.
  onGameEnd?: (results: PlayerRunData[]) => void

  constructor(isSolo = false) { this.isSolo = isSolo }

  addPlayer(id: string, userId: number, ws: WebSocket, characterType: string, username: string, x: number, y: number, viewW = 1280, viewH = 720) {
    if (this.started) return
    const isHost = this.players.length === 0
    this.players.push({
      id, userId, ws, x, y, viewW, viewH, characterType, username, dead: false, paused: false, isHost, aura: 0, orbital: 0,
      xp: 0, level: 1, pendingChoices: null, upgrades: { ...emptyUpgrades(), ...startingUpgrades(characterType) },
      kills: 0, bossKills: 0, coins: 0, damageDealt: 0,
    })
    this.broadcastWaiting()
    if (this.players.length >= MAX_PLAYERS || this.isSolo) {
      this.startGame()
    }
  }

  handleStartGame(requesterId: string): boolean {
    const requester = this.players.find(p => p.id === requesterId)
    if (!requester?.isHost || this.players.length < 2 || this.started) return false
    this.startGame()
    return true
  }

  private broadcastWaiting() {
    for (const p of this.players) {
      this.send(p.ws, { type: 'waiting', playerCount: this.players.length, isHost: p.isHost })
    }
  }

  private startGame() {
    if (this.started) return
    const snaps = this.playerSnapshots()
    for (const p of this.players) {
      this.send(p.ws, { type: 'start', yourId: p.id, players: snaps })
    }
    this.startLoop()
  }

  pausePlayer(id: string) {
    const p = this.players.find(p => p.id === id)
    if (!p || p.dead) return
    p.paused = true
    if (this.isSolo && this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  resumePlayer(id: string) {
    const p = this.players.find(p => p.id === id)
    if (!p) return
    p.paused = false
    if (this.isSolo && this.started && !this.finished && !this.interval) {
      this.interval = setInterval(() => this.tick(), TICK_MS)
    }
  }

  updatePlayerPos(id: string, x: number, y: number, aura: number, orbital: number) {
    if (!isFinite(x) || !isFinite(y) || Math.abs(x) > MAX_COORD || Math.abs(y) > MAX_COORD) return
    const p = this.players.find(p => p.id === id)
    if (p && !p.dead) {
      p.x = x; p.y = y
      p.aura    = Math.max(0, Math.min(10, Math.floor(aura)))
      p.orbital = Math.max(0, Math.min(10, Math.floor(orbital)))
    }
  }

  markPlayerDead(id: string) {
    const p = this.players.find(p => p.id === id)
    if (p) p.dead = true
    if (this.isSolo && this.players.every(p => p.dead)) {
      this.finishGame(false)
    }
  }

  relayProjectile(fromId: string, x: number, y: number, vx: number, vy: number) {
    if (!isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy)
        || Math.abs(vx) > MAX_VEL || Math.abs(vy) > MAX_VEL) return
    const data = JSON.stringify({ type: 'projectile', playerId: fromId, x, y, vx, vy })
    for (const p of this.players) {
      if (p.id !== fromId && p.ws.readyState === 1) p.ws.send(data)
    }
  }

  handleHit(playerId: string, enemyId: number, damage: number) {
    if (!Number.isInteger(enemyId) || enemyId < 0 || !isFinite(damage) || damage <= 0) return
    const player = this.players.find(p => p.id === playerId)
    const cap = player ? this.maxHitDamage(player) : MAX_DAMAGE_FALLBACK
    const safeDamage = Math.min(Math.floor(damage), cap)
    const enemy = this.spawner.findById(enemyId)
    if (!enemy || !enemy.active) return

    if (player) player.damageDealt += safeDamage

    const died = enemy.takeDamage(safeDamage)
    if (died) {
      this.broadcast({ type: 'enemyDied', enemyId, x: enemy.x, y: enemy.y, xpValue: enemy.xpValue })
      if (enemy.isBoss) this.broadcast({ type: 'bossHp', bossId: enemyId, hp: 0 })
      if (player) {
        player.kills++
        if (enemy.isBoss) {
          player.bossKills++
          player.coins += 4 + Math.floor(Math.random() * 5)  // bosses always drop coins
        } else if (Math.random() < COIN_DROP_CHANCE) {
          player.coins++
        }
      }
      this.grantXP(enemy.xpValue)
    } else if (enemy.isBoss) {
      this.broadcast({ type: 'bossHp', bossId: enemyId, hp: enemy.hp })
    }
  }

  // Max legitimate per-hit damage based on server-tracked might upgrades.
  // Blood Nova is the highest multiplier (5×); 1.5× safety buffer on top.
  private maxHitDamage(p: Player): number {
    const mightMult = 1.0 + p.upgrades.mightPicks * 0.1
    return Math.ceil(15 * mightMult * 5 * 1.5)
  }

  handleChooseUpgrade(playerId: string, upgradeId: string) {
    if (!VALID_UPGRADE_SET.has(upgradeId)) return
    const p = this.players.find(p => p.id === playerId)
    if (!p || !p.pendingChoices || !p.pendingChoices.includes(upgradeId)) return

    p.pendingChoices = null

    const u = p.upgrades
    switch (upgradeId as UpgradeId) {
      case 'piercing':    u.piercing = true; break
      case 'multiShot':   u.multiShot = Math.min(4, u.multiShot + 1); break
      case 'orbital':     u.orbital = Math.min(3, u.orbital + 1); p.orbital = u.orbital; break
      case 'boomerang':   u.boomerang = true; break
      case 'flameTrail':  u.flameTrail = true; break
      case 'bloodNova':   u.bloodNova = true; break
      case 'vampiric':    u.vampiric = true; break
      case 'lightning':   u.lightning = true; break
      case 'might':       u.mightPicks = Math.min(5, u.mightPicks + 1); break
      case 'axe':         u.axe = true; break
      case 'aura':        u.aura = true; p.aura = 1; break
      case 'auraTick':    u.auraTick = Math.min(3, u.auraTick + 1); break
      case 'auraRange':   u.auraRange = Math.min(3, u.auraRange + 1); break
      case 'divineShield':u.divineShield = true; break
      // dashCooldown, dashDistance: no server-side tracking needed
    }
  }

  private grantXP(xpValue: number) {
    // Scale XP by the same curve used on the frontend (1× at t=0, 2× at t=1)
    const RUN_DURATION = 30 * 60 * 1000
    const xpScale = 1 + Math.min(this.spawner.runElapsed / RUN_DURATION, 1)
    const scaled = Math.round(xpValue * xpScale)
    for (const p of this.players) {
      if (p.dead || p.pendingChoices !== null) continue
      p.xp += scaled
      const needed = xpNeeded(p.level)
      if (p.xp >= needed) {
        p.xp -= needed
        p.level++
        const choices = pickUpgradeChoices(p.upgrades, p.characterType === 'ares')
        p.pendingChoices = choices
        this.send(p.ws, {
          type: 'levelUp',
          level: p.level,
          xp: p.xp,
          xpToNext: xpNeeded(p.level),
          choices,
        })
      }
    }
  }

  adminSpawn(entity: string, requesterId: string) {
    if (!this.started || this.finished) return
    const requester = this.players.find(p => p.id === requesterId)
    if (!requester) return
    const positions = this.players.map(p => ({ x: p.x, y: p.y, viewW: p.viewW, viewH: p.viewH }))
    const ITEM_DIST = 220 + Math.random() * 80
    const angle = Math.random() * Math.PI * 2
    const ix = requester.x + Math.cos(angle) * ITEM_DIST
    const iy = requester.y + Math.sin(angle) * ITEM_DIST

    if (entity === 'potion' || entity === 'xporb' || entity === 'coin') {
      this.send(requester.ws, { type: 'adminSpawnItem', entity, x: ix, y: iy })
    } else {
      const spawned = this.spawner.adminSpawnEnemy(entity, positions)
      if (spawned && spawned.isBoss) {
        this.bosses.set(spawned.id, spawned.maxHp)
        this.broadcast({ type: 'bossSpawn', bossId: spawned.id, maxHp: spawned.maxHp, final: spawned.kind === 'finalBoss', kind: spawned.kind })
      }
    }
  }

  removePlayer(id: string): boolean {
    const leaving = this.players.find(p => p.id === id)
    if (leaving && !leaving.dead) {
      this.broadcast({ type: 'playerLeft' })
      // finishGame reads this.players to build results — call it BEFORE filtering
      // so the quitting player's coins/kills are included in the DB save.
      if (this.isSolo && this.started) this.finishGame(false)
    }
    this.players = this.players.filter(p => p.id !== id)
    if (this.players.length === 0) {
      this.stop()
      return true  // room is empty, discard it
    }
    return false
  }

  get isFull(): boolean { return this.players.length >= MAX_PLAYERS }
  get isEmpty(): boolean { return this.players.length === 0 }
  get isStarted(): boolean { return this.started }
  get waitingUsernames(): string[] { return this.players.map(p => p.username) }

  sendRunSaved(userId: number, msg: { kills: number; timeSurvived: number; coins: number; won: boolean; newAchievements: string[] }) {
    const p = this.players.find(p => p.userId === userId)
    if (p) this.send(p.ws, { type: 'runSaved', ...msg })
  }

  private startLoop() {
    this.started = true
    this.startMs = Date.now()
    this.spawner.onBossWarning = (final) => {
      this.broadcast({ type: 'bossWarning', final }, true)
    }
    this.spawner.onBossSpawn = (e) => {
      this.bosses.set(e.id, e.maxHp)
      this.broadcast({ type: 'bossSpawn', bossId: e.id, maxHp: e.maxHp, final: e.kind === 'finalBoss', kind: e.kind }, true)
    }
    this.spawner.onSurge = (enemyType) => {
      this.broadcast({ type: 'surge', enemyType }, true)
    }
    this.spawner.onExploderExplode = (x, y) => {
      this.broadcast({ type: 'exploderExplode', x, y }, true)
    }
    this.spawner.onBossInvuln = (bossId, invulnerable) => {
      this.broadcast({ type: 'bossInvuln', bossId, invulnerable }, true)
    }
    this.spawner.onFinalBossDefeated = () => {
      this.broadcast({ type: 'gameOver', won: true })
      this.finishGame(true)
    }

    this.interval = setInterval(() => this.tick(), TICK_MS)
  }

  private finishGame(won: boolean) {
    if (this.finished) return
    this.finished = true
    this.stop()
    if (!this.onGameEnd) return
    const timeSurvived = Date.now() - this.startMs
    const results: PlayerRunData[] = this.players.map(p => {
      const u = p.upgrades
      const weaponCount = 1
        + (u.aura ? 1 : 0)
        + (u.orbital > 0 ? 1 : 0)
        + (u.boomerang ? 1 : 0)
        + (u.flameTrail ? 1 : 0)
        + (u.bloodNova ? 1 : 0)
        + (u.lightning ? 1 : 0)
        + (u.axe ? 1 : 0)
      return {
        userId: p.userId,
        username: p.username,
        kills: p.kills,
        coins: p.coins,
        timeSurvived,
        won,
        bossKills: p.bossKills,
        level: p.level,
        weaponCount,
        multiplayer: !this.isSolo,
        damageDealt: p.damageDealt,
      }
    })
    this.onGameEnd(results)
  }

  private tick() {
    try {
      const alivePlayers = this.players.filter(p => !p.dead)
      const src = alivePlayers.length > 0 ? alivePlayers : this.players
      const positions = src.map(p => ({ x: p.x, y: p.y, viewW: p.viewW, viewH: p.viewH }))
      this.spawner.update(positions, TICK_MS)

      for (const e of this.spawner.all) {
        if (e.pendingProjectiles.length > 0) {
          for (const proj of e.pendingProjectiles) {
            this.broadcast({ type: 'bossProjectile', enemyId: e.id, x: proj.x, y: proj.y, vx: proj.vx, vy: proj.vy })
          }
          e.pendingProjectiles = []
        }
      }

      this.broadcast({
        type: 'tick',
        enemies: this.spawner.all.map(e => e.snapshot()),
        players: this.playerSnapshots(),
        elapsed: this.spawner.runElapsed,
      })
    } catch (err) {
      console.error('Tick error:', err)
    }
  }

  private stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null }
  }

  private playerSnapshots(): PlayerSnapshot[] {
    return this.players
      .filter(p => !p.dead)
      .map(p => ({ id: p.id, x: p.x, y: p.y, characterType: p.characterType, username: p.username, aura: p.aura, orbital: p.orbital }))
  }

  private broadcast(msg: S2CMessage, skipPaused = false) {
    const data = JSON.stringify(msg)
    for (const p of this.players) {
      if (skipPaused && p.paused) continue
      if (p.ws.readyState === 1) p.ws.send(data)
    }
  }

  private send(ws: WebSocket, msg: S2CMessage) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg))
  }
}
