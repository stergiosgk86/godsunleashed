import Phaser from 'phaser'
import { Player } from './Player'
import { EnemySpawner } from './EnemySpawner'
import { CombatSystem } from './CombatSystem'
import { EffectsSystem } from './EffectsSystem'
import { ClientEnemy } from './ClientEnemy'
import { RemotePlayer } from './RemotePlayer'
import { generateAssets, generateTilesetTexture, generateBushTexture } from './AssetGenerator'
import { useGameStore } from '../store/gameStore'
import { useCharacterStore } from '../store/characterStore'
import { CHARACTER_DEFS } from './characters'
import { minimapData } from './minimapData'
import { runData } from './runData'
import { soundSystem } from './SoundSystem'
import { activeNetClient } from '../net/netState'
import type { EnemySnapshot, PlayerSnapshot } from '../net/protocol'

const WORLD_SIZE = 4000
const SPAWN_X = WORLD_SIZE / 2
const SPAWN_Y = WORLD_SIZE / 2

export class MainScene extends Phaser.Scene {
  private player!: Player
  private spawner!: EnemySpawner
  private combat!: CombatSystem
  private effects!: EffectsSystem
  private fpsText!: Phaser.GameObjects.Text
  private warningText!: Phaser.GameObjects.Text
  private finalWarningText!: Phaser.GameObjects.Text
  private prevLevelUpPending = false
  private healPool = 0

  // Multiplayer
  private clientEnemies = new Map<number, ClientEnemy>()
  private remotePlayers = new Map<string, RemotePlayer>()
  private netSendTimer = 0

  constructor() {
    super({ key: 'MainScene' })
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE)
    generateAssets(this)
    generateTilesetTexture(this)

    const TILE_SIZE = 64
    const MAP_TILES = Math.ceil(WORLD_SIZE / TILE_SIZE)
    const mapData: number[][] = []
    for (let ty = 0; ty < MAP_TILES; ty++) {
      const row: number[] = []
      for (let tx = 0; tx < MAP_TILES; tx++) {
        const r = Math.random()
        if (r < 0.60) row.push(1)
        else if (r < 0.82) row.push(2)
        else if (r < 0.93) row.push(3)
        else row.push(4)
      }
      mapData.push(row)
    }
    const map = this.make.tilemap({ data: mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE })
    const tileset = map.addTilesetImage('ground_tiles', 'ground_tiles', TILE_SIZE, TILE_SIZE, 0, 0)!
    map.createLayer(0, tileset, 0, 0)!.setDepth(-10)

    this.drawBorderWalls()

    generateBushTexture(this)
    this.spawnBushes()

    this.effects = new EffectsSystem(this)
    const charType = useCharacterStore.getState().selectedCharacter
    const spriteKey = CHARACTER_DEFS[charType].spriteKey
    this.player = new Player(this, SPAWN_X, SPAWN_Y, spriteKey)
    this.spawner = new EnemySpawner(this)
    this.combat = new CombatSystem(this, this.effects)

    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE)
    this.cameras.main.startFollow(this.player.graphic, true, 0.1, 0.1)

    this.fpsText = this.add
      .text(110, 14, '', { fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace', alpha: 0.7 })
      .setScrollFactor(0)

    // Boss warning text (hidden until triggered)
    this.warningText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 80, '⚠  BOSS APPROACHING  ⚠', {
        fontSize: '28px', color: '#ff4400', fontFamily: 'monospace', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(20)

    this.finalWarningText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 80, '☠  THE DEATH APPROACHES  ☠', {
        fontSize: '28px', color: '#cc00ff', fontFamily: 'monospace', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 6,
      })
      .setOrigin(0.5).setScrollFactor(0).setAlpha(0).setDepth(20)

    this.spawner.onBossWarning = () => { this.showWarning(); soundSystem.bossWarning() }
    this.spawner.onBossSpawn = () => {
      this.cameras.main.shake(600, 0.02)
      this.warningText.setAlpha(0)
    }
    this.spawner.onFinalBossWarning = () => { this.showFinalWarning(); soundSystem.bossWarning() }
    this.spawner.onFinalBossSpawn = () => {
      this.cameras.main.shake(1000, 0.04)
      this.finalWarningText.setAlpha(0)
    }
    this.spawner.onFinalBossDefeated = () => {
      soundSystem.bossDie()
      useGameStore.getState().win()
      this.scene.pause()
    }

    this.setupMultiplayer()

    // Only resume here — pausing on level-up is handled in update() to avoid
    // calling scene.pause() from within a zustand subscriber mid-update-loop.
    const unsubLevelUp = useGameStore.subscribe(
      s => s.isLevelUpPending,
      (pending) => {
        if (pending) soundSystem.levelUp()
        else this.scene.resume()
      }
    )
    const unsubPause = useGameStore.subscribe(
      s => s.isPaused,
      (paused) => { if (paused) this.scene.pause(); else this.scene.resume() }
    )
    const unsubDamage = useGameStore.subscribe(
      s => s.invincibleUntil,
      () => {
        if (useGameStore.getState().hp > 0) {
          this.effects.shakeCamera()
          soundSystem.playerHit()
        }
      }
    )
    this.events.once('shutdown', () => {
      unsubLevelUp(); unsubPause(); unsubDamage()
      runData.elapsed = 0
      for (const r of this.remotePlayers.values()) r.destroy()
      this.remotePlayers.clear()
      this.clientEnemies.clear()
    })
  }

  private spawnBushes() {
    const MARGIN = 80
    const SPAWN_CLEAR = 300
    for (let i = 0; i < 75; i++) {
      const x = MARGIN + Math.random() * (WORLD_SIZE - MARGIN * 2)
      const y = MARGIN + Math.random() * (WORLD_SIZE - MARGIN * 2)
      const dx = x - SPAWN_X, dy = y - SPAWN_Y
      if (dx * dx + dy * dy < SPAWN_CLEAR * SPAWN_CLEAR) continue
      this.add.image(x, y, 'bush')
        .setDepth(0)
        .setScale(1.8 + Math.random() * 0.8)
    }
  }

  private drawBorderWalls() {
    const W = 64
    const S = WORLD_SIZE
    const g = this.add.graphics().setDepth(1)

    const bW = 28, bH = 13, m = 2
    const numRows = 4
    const pad = Math.floor((W - numRows * bH - (numRows - 1) * m) / 2)

    // Mortar base
    g.fillStyle(0x06060c)
    g.fillRect(0, 0, S, W)
    g.fillRect(0, S - W, S, W)
    g.fillRect(0, W, W, S - W * 2)
    g.fillRect(S - W, W, W, S - W * 2)

    const hBrick = (x: number, y: number, w: number) => {
      g.fillStyle(0x1f1f3e); g.fillRect(x, y, w, bH)
      g.fillStyle(0x32325a); g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, bH)
      g.fillStyle(0x0c0c18); g.fillRect(x, y + bH - 1, w, 1)
    }
    const vBrick = (x: number, y: number, h: number) => {
      g.fillStyle(0x1f1f3e); g.fillRect(x, y, bH, h)
      g.fillStyle(0x32325a); g.fillRect(x, y, bH, 1); g.fillRect(x, y, 1, h)
      g.fillStyle(0x0c0c18); g.fillRect(x + bH - 1, y, 1, h)
    }

    // Top & bottom horizontal bricks (4 rows)
    for (let row = 0; row < numRows; row++) {
      const ry = pad + row * (bH + m)
      const offset = row % 2 === 0 ? 0 : (bW + m) / 2
      for (let x = -offset; x < S; x += bW + m) {
        const bx = Math.max(0, x)
        const bw = Math.min(x + bW, S) - bx
        if (bw > 0) { hBrick(bx, ry, bw); hBrick(bx, S - W + ry, bw) }
      }
    }

    // Left & right vertical bricks (4 columns)
    for (let col = 0; col < numRows; col++) {
      const cx = pad + col * (bH + m)
      const offset = col % 2 === 0 ? 0 : (bW + m) / 2
      for (let y = W - offset; y < S - W; y += bW + m) {
        const by = Math.max(W, y)
        const bh = Math.min(y + bW, S - W) - by
        if (bh > 0) { vBrick(cx, by, bh); vBrick(S - W + cx, by, bh) }
      }
    }

    // Corner pillars (overdraws bricks in the W×W corner areas)
    const drawCorner = (cx: number, cy: number) => {
      // Pillar base
      g.fillStyle(0x0d0d1e)
      g.fillRect(cx, cy, W, W)

      // Inset raised block
      const ins = 6
      g.fillStyle(0x1c1c38)
      g.fillRect(cx + ins, cy + ins, W - ins * 2, W - ins * 2)
      g.fillStyle(0x2e2e56)
      g.fillRect(cx + ins, cy + ins, W - ins * 2, 1)
      g.fillRect(cx + ins, cy + ins, 1, W - ins * 2)
      g.fillStyle(0x09090f)
      g.fillRect(cx + ins, cy + W - ins - 1, W - ins * 2, 1)
      g.fillRect(cx + W - ins - 1, cy + ins, 1, W - ins * 2)

      // Centre diamond
      const mx = cx + W / 2, my = cy + W / 2, ds = 11
      g.fillStyle(0x22224a)
      g.fillTriangle(mx, my - ds, mx + ds, my, mx - ds, my)
      g.fillTriangle(mx - ds, my, mx + ds, my, mx, my + ds)
      g.fillStyle(0x30305e)
      g.fillTriangle(mx, my - ds + 3, mx + ds - 3, my, mx - ds + 3, my)

    }

    drawCorner(0,     0)
    drawCorner(S - W, 0)
    drawCorner(0,     S - W)
    drawCorner(S - W, S - W)

    // Straight wall glow lines (corners handled above)
    g.fillStyle(0x4455cc)
    g.fillRect(W, W - 2, S - W * 2, 2)
    g.fillRect(W, S - W, S - W * 2, 2)
    g.fillRect(W - 2, W, 2, S - W * 2)
    g.fillRect(S - W, W, 2, S - W * 2)
  }

  private showWarning() {
    this.warningText.setAlpha(1)
    // Pulse the warning text
    this.tweens.add({
      targets: this.warningText,
      alpha: 0.2,
      duration: 400,
      yoyo: true,
      repeat: 10,
      onComplete: () => this.warningText.setAlpha(0),
    })
  }

  private showFinalWarning() {
    this.finalWarningText.setAlpha(1)
    this.tweens.add({
      targets: this.finalWarningText,
      alpha: 0.2, duration: 400, yoyo: true, repeat: 10,
      onComplete: () => this.finalWarningText.setAlpha(0),
    })
  }

  private setupMultiplayer() {
    const net = activeNetClient
    if (!net) return

    net.on('tick', (msg) => this.applyTick(msg.enemies, msg.players, msg.elapsed))

    net.on('enemyDied', (msg) => {
      const ce = this.clientEnemies.get(msg.enemyId)
      if (ce) { this.effects.showDeathBurst(msg.x, msg.y); ce.destroy(); this.clientEnemies.delete(msg.enemyId) }
      useGameStore.getState().addXP(msg.xpValue)
      soundSystem.enemyDie()
    })

    net.on('bossWarning', (msg) => {
      if (msg.final) this.showFinalWarning(); else this.showWarning()
      soundSystem.bossWarning()
    })

    net.on('bossSpawn', (msg) => {
      this.cameras.main.shake(msg.final ? 1000 : 600, msg.final ? 0.04 : 0.02)
      useGameStore.getState().setBossHp(msg.maxHp, msg.maxHp)
      this.warningText.setAlpha(0)
      this.finalWarningText.setAlpha(0)
    })

    net.on('bossHp', (msg) => {
      useGameStore.getState().setBossHp(msg.hp === 0 ? null : msg.hp)
      if (msg.hp === 0) soundSystem.bossDie()
    })

    net.on('gameOver', (msg) => {
      if (msg.won) { soundSystem.bossDie(); useGameStore.getState().win() }
      else useGameStore.getState().die()
      this.scene.pause()
    })

    net.on('playerLeft', () => {
      useGameStore.getState().die()
      this.scene.pause()
    })
  }

  private applyTick(
    enemies: EnemySnapshot[],
    players: PlayerSnapshot[],
    elapsed: number,
  ) {
    runData.elapsed = elapsed

    // Reconcile enemy map
    const incoming = new Set(enemies.map(e => e.id))
    for (const [id, ce] of this.clientEnemies) {
      if (!incoming.has(id)) { ce.destroy(); this.clientEnemies.delete(id) }
    }
    for (const snap of enemies) {
      const existing = this.clientEnemies.get(snap.id)
      if (existing) {
        existing.applySnapshot(snap)
      } else {
        this.clientEnemies.set(snap.id, new ClientEnemy(this, snap))
      }
    }

    // Reconcile remote players
    const myId = activeNetClient?.playerId ?? ''
    const incomingPlayers = new Set(players.map(p => p.id))
    for (const [id, rp] of this.remotePlayers) {
      if (!incomingPlayers.has(id)) { rp.destroy(); this.remotePlayers.delete(id) }
    }
    for (const snap of players) {
      if (snap.id === myId) continue
      const existing = this.remotePlayers.get(snap.id)
      if (existing) {
        existing.update(snap.x, snap.y)
      } else {
        this.remotePlayers.set(snap.id, new RemotePlayer(this, snap.x, snap.y, snap.characterType, 'P2'))
      }
    }
  }

  update(_time: number, delta: number) {
    this.player.update(delta, this.effects)
    this.effects.update(delta)

    const net = activeNetClient
    if (net) {
      // Multiplayer: server drives enemies and elapsed; we drive position
      this.netSendTimer += delta
      if (this.netSendTimer >= 50) {
        this.netSendTimer = 0
        net.send({ type: 'input', x: this.player.x, y: this.player.y })
      }
      const allClientEnemies = Array.from(this.clientEnemies.values())
      this.combat.update(this.player.x, this.player.y, allClientEnemies, delta)
    } else {
      // Singleplayer
      runData.elapsed += delta
      this.spawner.update(this.player.x, this.player.y, delta)
      this.combat.update(this.player.x, this.player.y, this.spawner.all, delta)
    }

    const state = useGameStore.getState()

    if (state.hpRegen > 0 && state.hp < state.maxHp && !state.isDead) {
      this.healPool += state.hpRegen * (delta / 1000)
      if (this.healPool >= 1) {
        const amount = Math.floor(this.healPool)
        this.healPool -= amount
        useGameStore.setState(s => ({ hp: Math.min(s.maxHp, s.hp + amount) }))
      }
    }

    if (state.hp <= 0 && !state.isDead) {
      state.die()
      this.scene.pause()
      return
    }

    if (state.isLevelUpPending && !this.prevLevelUpPending) {
      this.prevLevelUpPending = true
      this.scene.pause()
      return
    }
    if (!state.isLevelUpPending) this.prevLevelUpPending = false

    this.fpsText.setText(
      `FPS: ${Math.round(this.game.loop.actualFps)}  |  ${this.spawner.waveLabel()}  |  Enemies: ${this.spawner.all.length}`
    )

    // Feed minimap
    minimapData.playerX = this.player.x
    minimapData.playerY = this.player.y
    const allEnemies = net
      ? Array.from(this.clientEnemies.values())
      : this.spawner.all
    minimapData.enemies = allEnemies
      .filter(e => e.active)
      .map(e => ({ x: e.x, y: e.y, isBoss: !!e.isBoss }))
  }
}
