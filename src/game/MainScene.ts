import Phaser from 'phaser'
import { Player } from './Player'
import { EnemySpawner } from './EnemySpawner'
import { CombatSystem } from './CombatSystem'
import { EffectsSystem } from './EffectsSystem'
import { ClientEnemy } from './ClientEnemy'
import { RemotePlayer } from './RemotePlayer'
import { RemoteProjectile } from './RemoteProjectile'
import { generateAssets, generateTilesetTexture, generatePropTextures } from './AssetGenerator'
import { useGameStore } from '../store/gameStore'
import { useCharacterStore } from '../store/characterStore'
import { useAuthStore } from '../store/authStore'
import { CHARACTER_DEFS } from './characters'
import { minimapData } from './minimapData'
import { runData } from './runData'
import { soundSystem } from './SoundSystem'
import { activeNetClient } from '../net/netState'
import type { EnemySnapshot, PlayerSnapshot } from '../net/protocol'
import { saveRun, loadRun, clearRun } from './runSave'
import { TouchJoystick } from './TouchJoystick'
import { ChunkManager } from './ChunkManager'

const SPAWN_X = 0
const SPAWN_Y = 0

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
  private remoteProjectiles: RemoteProjectile[] = []
  private netSendTimer = 0
  private saveTimer = 0
  private readonly SAVE_INTERVAL = 1000
  private joystick!: TouchJoystick
  private chunkManager!: ChunkManager

  constructor() {
    super({ key: 'MainScene' })
  }

  create() {
    // Effectively infinite physics bounds for the chunk-streamed world
    this.physics.world.setBounds(-500_000, -500_000, 1_000_000, 1_000_000)
    generateAssets(this)
    generateTilesetTexture(this)
    generatePropTextures(this)
    this.chunkManager = new ChunkManager(this)

    this.effects = new EffectsSystem(this)
    const charType = useCharacterStore.getState().selectedCharacter
    const spriteKey = CHARACTER_DEFS[charType].spriteKey
    const username = useAuthStore.getState().username ?? ''
    this.player = new Player(this, SPAWN_X, SPAWN_Y, spriteKey, username)
    this.joystick = new TouchJoystick(this)
    this.spawner = new EnemySpawner(this)
    this.combat = new CombatSystem(this, this.effects)
    // Restore mid-run state after a page reload
    const savedRun = loadRun()
    if (savedRun && !activeNetClient) {
      this.spawner.restore(savedRun)
      this.spawner.restoreEnemies(savedRun.enemies)
      this.player.respawnAt(savedRun.playerX, savedRun.playerY)
      runData.elapsed = savedRun.elapsed
      useGameStore.setState({
        xp: savedRun.xp,
        xpNeeded: savedRun.xpNeeded,
        level: savedRun.level,
        hp: savedRun.hp,
        maxHp: savedRun.maxHp,
        might: savedRun.might,
        attackInterval: savedRun.attackInterval,
        moveSpeed: savedRun.moveSpeed,
        dashCooldown: savedRun.dashCooldown,
        dashDistance: savedRun.dashDistance,
        multiShot: savedRun.multiShot,
        piercing: savedRun.piercing,
        aura: savedRun.aura,
        orbital: savedRun.orbital,
        boomerang: savedRun.boomerang,
        flameTrail: savedRun.flameTrail,
        bloodNova: savedRun.bloodNova,
        vampiric: savedRun.vampiric ?? false,
        lightning: savedRun.lightning ?? false,
        armor: savedRun.armor ?? 0,
        hpRegen: savedRun.hpRegen,
        lifeDrain: savedRun.lifeDrain,
        sessionCoins: savedRun.sessionCoins,
        kills: savedRun.kills ?? 0,
        bossKills: savedRun.bossKills ?? 0,
      })
    }

    this.cameras.main.startFollow(this.player.graphic, true, 0.1, 0.1)
    if (window.innerWidth <= 768) this.cameras.main.setZoom(0.7)

    // Seed initial chunks around wherever the player actually starts
    this.chunkManager.update(this.player.x, this.player.y)

    this.fpsText = this.add
      .text(110, 14, '', { fontSize: '12px', color: '#ffffff', fontFamily: 'monospace' })
      .setScrollFactor(0)
      .setDepth(100)

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
    soundSystem.startMusic()

    let sceneAlive = true
    const unsubLevelUp = useGameStore.subscribe(
      s => s.isLevelUpPending,
      (pending) => {
        if (pending) {
          soundSystem.levelUp()
          soundSystem.pauseMusic()
          // Stay invulnerable for the entire level-up screen
          useGameStore.setState({ invincibleUntil: Infinity })
        } else {
          // 2-second grace period after resuming so enemies that walked
          // onto the player during the pause don't instantly deal damage
          useGameStore.setState({ invincibleUntil: Date.now() + 2000 })
          soundSystem.resumeMusic()
          if (sceneAlive) this.scene.resume()
        }
      }
    )
    const unsubPause = useGameStore.subscribe(
      s => s.isPaused,
      (paused) => {
        if (!sceneAlive) return
        if (paused) { this.scene.pause(); soundSystem.pauseMusic() }
        else { this.scene.resume(); soundSystem.resumeMusic() }
      }
    )
    const unsubDamage = useGameStore.subscribe(
      s => s.damageFlashUntil,
      () => {
        if (sceneAlive && useGameStore.getState().hp > 0) {
          this.effects.shakeCamera()
          soundSystem.playerHit()
        }
      }
    )
    const unsubDead = useGameStore.subscribe(s => s.isDead, isDead => { if (isDead) clearRun() })
    const unsubWon  = useGameStore.subscribe(s => s.isWon,  isWon  => { if (isWon)  clearRun() })
    this.events.once('shutdown', () => {
      sceneAlive = false
      soundSystem.stopMusic()
      unsubLevelUp(); unsubPause(); unsubDamage(); unsubDead(); unsubWon()
      this.chunkManager.destroyAll()
      this.joystick.destroy()
      runData.elapsed = 0
      for (const r of this.remotePlayers.values()) r.destroy()
      this.remotePlayers.clear()
      for (const rp of this.remoteProjectiles) rp.destroy()
      this.remoteProjectiles = []
      this.clientEnemies.clear()
    })
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
      const isBoss = ce?.isBoss ?? false
      if (ce) { this.effects.showDeathBurst(msg.x, msg.y); ce.destroy(); this.clientEnemies.delete(msg.enemyId) }
      this.combat.spawnDropsAt(msg.x, msg.y, msg.xpValue, isBoss)
      const gs = useGameStore.getState()
      gs.addKill()
      if (isBoss) { gs.addBossKill(); soundSystem.bossDie() }
      else soundSystem.enemyDie()
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

    net.on('projectile', (msg) => {
      this.remoteProjectiles.push(new RemoteProjectile(this, msg.x, msg.y, msg.vx, msg.vy))
    })

    net.on('bossProjectile', (msg) => {
      const ce = this.clientEnemies.get(msg.enemyId)
      if (ce) ce.addProjectile(msg.x, msg.y, msg.vx, msg.vy)
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
        existing.update(snap.x, snap.y, snap.aura, snap.orbital)
      } else {
        this.remotePlayers.set(snap.id, new RemotePlayer(this, snap.x, snap.y, snap.characterType, snap.username))
      }
    }
  }

  update(_time: number, delta: number) {
    this.chunkManager.update(this.player.x, this.player.y)
    this.player.touchVx = this.joystick.vx
    this.player.touchVy = this.joystick.vy
    this.player.update(delta, this.effects)
    this.effects.update(delta)

    const net = activeNetClient
    if (net) {
      // Multiplayer: server drives enemies and elapsed; we drive position
      this.netSendTimer += delta
      if (this.netSendTimer >= 50) {
        this.netSendTimer = 0
        const { aura, orbital } = useGameStore.getState()
        net.send({ type: 'input', x: this.player.x, y: this.player.y, aura, orbital })
      }
      const allClientEnemies = Array.from(this.clientEnemies.values())
      for (const ce of allClientEnemies) ce.update(0, 0, delta)
      this.combat.update(this.player.x, this.player.y, allClientEnemies, delta)
      for (const rp of this.remotePlayers.values()) rp.tick(delta)
      const REMOTE_HIT_R = 25 * 25
      for (const rp of this.remoteProjectiles) {
        rp.update(delta)
        if (!rp.active) continue
        for (const ce of allClientEnemies) {
          if (!ce.active) continue
          const dx = rp.x - ce.x, dy = rp.y - ce.y
          if (dx * dx + dy * dy < REMOTE_HIT_R) { rp.destroy(); break }
        }
      }
      this.remoteProjectiles = this.remoteProjectiles.filter(rp => rp.active)
    } else {
      // Singleplayer
      runData.elapsed += delta
      this.spawner.update(this.player.x, this.player.y, delta)
      this.combat.update(this.player.x, this.player.y, this.spawner.all, delta)

      this.saveTimer += delta
      if (this.saveTimer >= this.SAVE_INTERVAL) {
        this.saveTimer = 0
        const s = useGameStore.getState()
        const sp = this.spawner.getSnapshot()
        saveRun({
          elapsed: runData.elapsed,
          nextBossAt: sp.nextBossAt,
          warningFired: sp.warningFired,
          finalBossWarningFired: sp.finalBossWarningFired,
          bossAlive: sp.bossAlive,
          finalBossAlive: sp.finalBossAlive,
          playerX: this.player.x,
          playerY: this.player.y,
          enemies: this.spawner.getSaveableEnemies(),
          kills: s.kills, bossKills: s.bossKills,
          xp: s.xp, xpNeeded: s.xpNeeded, level: s.level,
          hp: s.hp, maxHp: s.maxHp,
          might: s.might, attackInterval: s.attackInterval, moveSpeed: s.moveSpeed,
          dashCooldown: s.dashCooldown, dashDistance: s.dashDistance,
          multiShot: s.multiShot, piercing: s.piercing, aura: s.aura,
          orbital: s.orbital, boomerang: s.boomerang, flameTrail: s.flameTrail,
          bloodNova: s.bloodNova, vampiric: s.vampiric, lightning: s.lightning, armor: s.armor, hpRegen: s.hpRegen, lifeDrain: s.lifeDrain,
          sessionCoins: s.sessionCoins,
        })
      }
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
      if (net) net.send({ type: 'died' })
      this.scene.pause()
      return
    }

    if (state.isLevelUpPending && !this.prevLevelUpPending) {
      this.prevLevelUpPending = true
      this.scene.pause()
      return
    }
    if (!state.isLevelUpPending) this.prevLevelUpPending = false

    const enemyCount = net ? this.clientEnemies.size : this.spawner.all.length
    const waveLabel  = net ? this.spawner.waveLabel(runData.elapsed) : this.spawner.waveLabel()
    this.fpsText.setText(
      `FPS: ${Math.round(this.game.loop.actualFps)}  |  ${waveLabel}  |  Enemies: ${enemyCount}`
    )

    // Feed minimap
    minimapData.playerX = this.player.x
    minimapData.playerY = this.player.y
    minimapData.remotePlayers = Array.from(this.remotePlayers.values())
      .map(r => ({ x: r.x, y: r.y }))
    const allEnemies = net
      ? Array.from(this.clientEnemies.values())
      : this.spawner.all
    minimapData.enemies = allEnemies
      .filter(e => e.active)
      .map(e => ({ x: e.x, y: e.y, isBoss: !!e.isBoss }))
  }
}
