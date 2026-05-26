import Phaser from 'phaser'
import { Player } from './Player'
import { EnemySpawner } from './EnemySpawner'
import { CombatSystem } from './CombatSystem'
import { EffectsSystem } from './EffectsSystem'
import { ClientEnemy } from './ClientEnemy'
import { RemotePlayer } from './RemotePlayer'
import { RemoteProjectile } from './RemoteProjectile'
import { generateAssets, generatePropTextures } from './AssetGenerator'
import { useGameStore, UPGRADE_POOL, type Upgrade, type AdminSpawnEntity } from '../store/gameStore'
import { useCharacterStore } from '../store/characterStore'
import { useAuthStore } from '../store/authStore'
import { CHARACTER_DEFS } from './characters'
import { minimapData } from './minimapData'
import { runData } from './runData'
import { difficultyScale, computeSpeedScale, computeHpScale, computeDamageScale, computeXpScale } from './difficultyScale'
import { soundSystem } from './SoundSystem'
import { activeNetClient } from '../net/netState'
import type { EnemySnapshot, PlayerSnapshot } from '../net/protocol'
import { saveRun, clearRun } from './runSave'
import { consumePendingRunRestore } from './pendingRunRestore'
import { TouchJoystick } from './TouchJoystick'
import { TouchDashButton } from './TouchDashButton'
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
  private surgeText!: Phaser.GameObjects.Text
  private healPool = 0

  // Multiplayer
  private clientEnemies = new Map<number, ClientEnemy>()
  private remotePlayers = new Map<string, RemotePlayer>()
  private remoteProjectiles: RemoteProjectile[] = []
  private netSendTimer = 0
  // Net wave-label state (mirrors EnemySpawner fields for multiplayer HUD)
  private netBossAlive = false
  private netFinalBossAlive = false
  private netBossIsSummoner = false
  private netSurgeTimer = 0
  private saveTimer = 0
  private readonly SAVE_INTERVAL = 10_000
  private charType = ''
  private joystick!: TouchJoystick
  private dashButton: TouchDashButton | null = null
  private chunkManager!: ChunkManager

  constructor() {
    super({ key: 'MainScene' })
  }

  create() {
    // Effectively infinite physics bounds for the chunk-streamed world
    this.physics.world.setBounds(-500_000, -500_000, 1_000_000, 1_000_000)
    generateAssets(this)
    generatePropTextures(this)

    // Large world-space TileSprite — same coordinate system as trees, no parallax drift
    this.add.tileSprite(0, 0, 1_000_000, 1_000_000, 'ground_tiles')
      .setOrigin(0.5, 0.5)
      .setTileScale(0.1, 0.1)
      .setDepth(-10)

    this.chunkManager = new ChunkManager(this)

    this.effects = new EffectsSystem(this)
    const charType = useCharacterStore.getState().selectedCharacter
    this.charType = charType
    const charDef = CHARACTER_DEFS[charType]
    const username = useAuthStore.getState().username ?? ''
    this.player = new Player(this, SPAWN_X, SPAWN_Y, charDef.spriteKey, username, charDef.scale, charDef.staticSprite ?? false)
    this.joystick = new TouchJoystick(this)
    if (window.innerWidth <= 768) this.dashButton = new TouchDashButton(this)
    this.spawner = new EnemySpawner(this)
    this.combat = new CombatSystem(this, this.effects, charDef.frontArcOnly)
    // Restore mid-run state after a page reload (pre-fetched in App.tsx init)
    const savedRun = consumePendingRunRestore()
    if (savedRun && (!savedRun.character || savedRun.character === charType)) {
      if (!activeNetClient) {
        this.spawner.restore(savedRun)
        this.spawner.restoreEnemies(savedRun.enemies)
        runData.elapsed = savedRun.elapsed
      }
      this.player.respawnAt(savedRun.playerX, savedRun.playerY)
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
        auraTick: savedRun.auraTick ?? 0,
        auraRange: savedRun.auraRange ?? 0,
        orbital: savedRun.orbital,
        wand: savedRun.wand ?? false,
        boomerang: savedRun.boomerang,
        flameTrail: savedRun.flameTrail,
        bloodNova: savedRun.bloodNova,
        bloodNovaCD: savedRun.bloodNovaCD ?? 0,
        vampiric: savedRun.vampiric ?? false,
        lightning: savedRun.lightning ?? false,
        lightningTargets: savedRun.lightningTargets ?? 0,
        lightningCooldown: savedRun.lightningCooldown ?? 0,
        axe: savedRun.axe ?? false,
        divineShield: savedRun.divineShield ?? false,
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

    this.surgeText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 20, '', {
        fontSize: '26px', color: '#ffcc00', fontFamily: 'monospace', fontStyle: 'bold',
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
    this.spawner.onSurge = (type) => { this.showSurgeWarning(type) }
    this.spawner.onFinalBossDefeated = () => {
      soundSystem.bossDie()
      useGameStore.getState().win()
      this.scene.pause()
    }

    this.setupMultiplayer()

    // sceneAlive must be declared before onEsc so the closure can guard against
    // the teardown race where resetRun() clears isDead before Phaser is destroyed.
    let sceneAlive = true

    // Capture-phase listener fires before Phaser processes the event — reliable
    // regardless of canvas focus. Resuming is in PauseMenu (same mechanism).
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (!sceneAlive) return
      const gs = useGameStore.getState()
      if (!gs.isDead && !gs.isWon && !gs.isLevelUpPending) gs.togglePause()
    }
    window.addEventListener('keydown', onEsc, { capture: true })
    this.events.once('shutdown', () => window.removeEventListener('keydown', onEsc, { capture: true }))

    // Only resume here — pausing on level-up is handled in update() to avoid
    // calling scene.pause() from within a zustand subscriber mid-update-loop.
    soundSystem.startMusic()

    const unsubLevelUp = useGameStore.subscribe(
      s => s.isLevelUpPending,
      (pending) => {
        if (pending) {
          soundSystem.levelUp()
          // Reuse the pause machinery: unsubPause handles scene + music + server
          useGameStore.setState({ isPaused: true, invincibleUntil: Infinity })
        } else {
          // 2-second grace period after resuming so enemies that walked
          // onto the player during the pause don't instantly deal damage
          useGameStore.setState({ isPaused: false, invincibleUntil: Date.now() + 2000 })
        }
      }
    )
    const unsubPause = useGameStore.subscribe(
      s => s.isPaused,
      (paused) => {
        if (!sceneAlive) return
        try {
          if (paused) {
            this.scene.pause(); soundSystem.pauseMusic()
            activeNetClient?.send({ type: 'pause' })
          } else {
            this.scene.resume(); soundSystem.resumeMusic()
            activeNetClient?.send({ type: 'resume' })
          }
        } catch { /* scene is being torn down — ignore */ }
      }
    )
    const unsubDamage = useGameStore.subscribe(
      s => s.damageFlashUntil,
      () => {
        if (sceneAlive && useGameStore.getState().hp > 0) {
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
      this.dashButton?.destroy()
      runData.elapsed = 0
      for (const r of this.remotePlayers.values()) r.destroy()
      this.remotePlayers.clear()
      for (const rp of this.remoteProjectiles) rp.destroy()
      this.remoteProjectiles = []
      this.clientEnemies.clear()
    })
  }

  private handleAdminSpawn(entity: AdminSpawnEntity) {
    const net = activeNetClient
    if (net) {
      // Multiplayer: server handles all spawn logic
      net.send({ type: 'adminSpawn', entity })
      return
    }

    // Solo: handle locally
    const px = this.player.x
    const py = this.player.y
    const ITEM_DIST = 220 + Math.random() * 80
    const angle = Math.random() * Math.PI * 2
    const ix = px + Math.cos(angle) * ITEM_DIST
    const iy = py + Math.sin(angle) * ITEM_DIST

    if (entity === 'potion' || entity === 'xporb' || entity === 'coin') {
      this.combat.adminSpawnItem(entity, ix, iy)
    } else if (entity.startsWith('weapon:')) {
      useGameStore.getState().chooseUpgrade(entity.slice(7) as any)
    } else {
      this.spawner.adminSpawnEnemy(entity, px, py)
    }
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

  private showSurgeWarning(type: string) {
    const labels: Record<string, string> = {
      basic:   '⚡  HORDE INCOMING  ⚡',
      speeder: '⚡  SPEEDERS INCOMING  ⚡',
      tank:    '⚡  TANKS INCOMING  ⚡',
      ghost:   '⚡  GHOST TIDE  ⚡',
      ranged:  '⚡  RANGED FLOOD  ⚡',
    }
    this.surgeText.setText(labels[type] ?? '⚡  SURGE  ⚡')
    this.tweens.killTweensOf(this.surgeText)
    this.surgeText.setAlpha(1)
    this.tweens.add({
      targets: this.surgeText,
      alpha: 0.15, duration: 300, yoyo: true, repeat: 5,
      onComplete: () => this.surgeText.setAlpha(0),
    })
  }

  private setupMultiplayer() {
    const net = activeNetClient
    if (!net) return

    // Server drives XP and level-ups in multiplayer
    useGameStore.getState().setServerDrivenLeveling(true)

    // Relay the player's upgrade choice to the server once they pick
    const unsubChosen = useGameStore.subscribe(
      s => s.chosenUpgrade,
      (chosenId) => {
        if (chosenId !== null) net.send({ type: 'chooseUpgrade', upgradeId: chosenId })
      },
    )
    this.events.once('shutdown', () => {
      unsubChosen()
      useGameStore.getState().setServerDrivenLeveling(false)
      net.close()
    })

    net.on('levelUp', (msg) => {
      const choices = msg.choices
        .map(id => UPGRADE_POOL.find(u => u.id === id))
        .filter((u): u is Upgrade => u !== undefined)
      useGameStore.setState({
        level: msg.level,
        xp: msg.xp,
        xpNeeded: msg.xpToNext,
        isLevelUpPending: true,
        upgradeChoices: choices,
        chosenUpgrade: null,
      })
    })

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

    net.on('surge', (msg) => {
      this.netSurgeTimer = 6000
      if (!useGameStore.getState().isPaused) this.showSurgeWarning(msg.enemyType)
    })

    net.on('bossWarning', (msg) => {
      if (useGameStore.getState().isPaused) return
      if (msg.final) this.showFinalWarning(); else this.showWarning()
      soundSystem.bossWarning()
    })

    net.on('bossSpawn', (msg) => {
      this.netBossAlive = true
      this.netBossIsSummoner = msg.kind === 'summoner'
      if (msg.final) this.netFinalBossAlive = true
      if (useGameStore.getState().isPaused) return
      this.cameras.main.shake(msg.final ? 1000 : 600, msg.final ? 0.04 : 0.02)
      useGameStore.getState().setBossHp(msg.maxHp, msg.maxHp)
      useGameStore.getState().setBossInvulnerable(false)
      this.warningText.setAlpha(0)
      this.finalWarningText.setAlpha(0)
    })

    net.on('bossHp', (msg) => {
      if (msg.hp === 0) {
        this.netBossAlive = false
        this.netFinalBossAlive = false
        useGameStore.getState().setBossInvulnerable(false)
      }
      useGameStore.getState().setBossHp(msg.hp === 0 ? null : msg.hp)
    })

    net.on('bossInvuln', (msg) => {
      useGameStore.getState().setBossInvulnerable(msg.invulnerable)
    })

    net.on('adminSpawnItem', (msg) => {
      this.combat.adminSpawnItem(msg.entity as 'potion' | 'xporb' | 'coin', msg.x, msg.y)
    })

    net.on('adminGrantUpgrade', (msg) => {
      useGameStore.getState().chooseUpgrade(msg.upgradeId as any)
    })

    net.on('exploderExplode', (msg) => {
      const dx = msg.x - this.player.x
      const dy = msg.y - this.player.y
      if (dx * dx + dy * dy < 120 * 120) {
        useGameStore.getState().takeDamage(Math.round(30 * difficultyScale.damage))
      }
    })

    net.on('gameOver', (msg) => {
      if (!this.sys.displayList) return
      if (msg.won) { soundSystem.bossDie(); useGameStore.getState().win(); this.scene.pause() }
      else useGameStore.getState().die()  // die() sets isPaused:true → subscriber handles scene.pause()
    })

    net.on('playerLeft', () => {
      if (!this.sys.displayList) return
      useGameStore.getState().die()  // die() sets isPaused:true → subscriber handles scene.pause()
    })

    net.on('projectile', (msg) => {
      this.remoteProjectiles.push(new RemoteProjectile(this, msg.x, msg.y, msg.vx, msg.vy))
    })

    net.on('bossProjectile', (msg) => {
      if (!this.sys.displayList) return
      const ce = this.clientEnemies.get(msg.enemyId)
      if (ce && ce.active) ce.addProjectile(msg.x, msg.y, msg.vx, msg.vy)
    })
  }

  private applyTick(
    enemies: EnemySnapshot[],
    players: PlayerSnapshot[],
    elapsed: number,
  ) {
    if (!this.sys.displayList) return
    const gs = useGameStore.getState()
    if (gs.isPaused || gs.isLevelUpPending) return
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
    if (useGameStore.getState().isPaused) return

    const spawnRequest = useGameStore.getState().adminSpawnRequest
    if (spawnRequest) {
      useGameStore.getState().clearAdminSpawnRequest()
      this.handleAdminSpawn(spawnRequest)
    }

    this.chunkManager.update(this.player.x, this.player.y)
    this.player.touchVx = this.joystick.vx
    this.player.touchVy = this.joystick.vy
    if (this.dashButton) {
      this.dashButton.update()
      if (this.dashButton.consumePress()) this.player.touchDashPressed = true
    }
    const novaPaused = this.combat.novaPaused
    if (!novaPaused) this.player.update(delta, this.effects)
    this.combat.setFacing(this.player.facingVx, this.player.facingVy)
    this.effects.update(delta)

    const net = activeNetClient
    if (net) {
      // Keep difficulty curves in sync with server elapsed so scaling
      // (projectile damage, XP bar fill) matches the singleplayer experience.
      difficultyScale.speed  = computeSpeedScale(runData.elapsed)
      difficultyScale.hp     = computeHpScale(runData.elapsed)
      difficultyScale.damage = computeDamageScale(runData.elapsed)
      difficultyScale.xp     = computeXpScale(runData.elapsed)

      // Multiplayer: server drives enemies and elapsed; we drive position
      this.netSendTimer += delta
      if (this.netSendTimer >= 50) {
        this.netSendTimer = 0
        const { aura, orbital } = useGameStore.getState()
        net.send({ type: 'input', x: this.player.x, y: this.player.y, aura, orbital })
      }
      const allClientEnemies = Array.from(this.clientEnemies.values())
      if (!novaPaused) {
        for (const ce of allClientEnemies) ce.update(0, 0, delta)
        for (const e of this.spawner.all) e.update(this.player.x, this.player.y, delta)
        this.spawner.cleanupDead()
        const allEnemies: import('./Enemy').AnyEnemy[] = [...allClientEnemies, ...this.spawner.all]
        this.combat.update(this.player.x, this.player.y, allEnemies, delta)
      }
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

      this.saveTimer += delta
      if (this.saveTimer >= this.SAVE_INTERVAL) {
        this.saveTimer = 0
        const s = useGameStore.getState()
        saveRun({
          character: this.charType,
          elapsed: runData.elapsed,
          nextBossAt: 0,
          warningFired: false,
          finalBossWarningFired: false,
          bossAlive: false,
          finalBossAlive: false,
          playerX: this.player.x,
          playerY: this.player.y,
          enemies: [],
          kills: s.kills, bossKills: s.bossKills,
          xp: s.xp, xpNeeded: s.xpNeeded, level: s.level,
          hp: s.hp, maxHp: s.maxHp,
          might: s.might, attackInterval: s.attackInterval, moveSpeed: s.moveSpeed,
          dashCooldown: s.dashCooldown, dashDistance: s.dashDistance,
          multiShot: s.multiShot, piercing: s.piercing, aura: s.aura, auraTick: s.auraTick, auraRange: s.auraRange,
          orbital: s.orbital, wand: s.wand, boomerang: s.boomerang, flameTrail: s.flameTrail,
          bloodNova: s.bloodNova, bloodNovaCD: s.bloodNovaCD, vampiric: s.vampiric, lightning: s.lightning,
          lightningTargets: s.lightningTargets, lightningCooldown: s.lightningCooldown,
          axe: s.axe, divineShield: s.divineShield, armor: s.armor, hpRegen: s.hpRegen, lifeDrain: s.lifeDrain,
          sessionCoins: s.sessionCoins,
        })
      }
    } else {
      // Singleplayer
      if (!novaPaused) {
        runData.elapsed += delta
        this.spawner.update(this.player.x, this.player.y, delta)
        this.combat.update(this.player.x, this.player.y, this.spawner.all, delta)
      }

      this.saveTimer += delta
      if (this.saveTimer >= this.SAVE_INTERVAL) {
        this.saveTimer = 0
        const s = useGameStore.getState()
        const sp = this.spawner.getSnapshot()
        saveRun({
          character: this.charType,
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
          multiShot: s.multiShot, piercing: s.piercing, aura: s.aura, auraTick: s.auraTick, auraRange: s.auraRange,
          orbital: s.orbital, wand: s.wand, boomerang: s.boomerang, flameTrail: s.flameTrail,
          bloodNova: s.bloodNova, bloodNovaCD: s.bloodNovaCD, vampiric: s.vampiric, lightning: s.lightning,
          lightningTargets: s.lightningTargets, lightningCooldown: s.lightningCooldown,
          axe: s.axe, divineShield: s.divineShield, armor: s.armor, hpRegen: s.hpRegen, lifeDrain: s.lifeDrain,
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
      return
    }
    if (state.isDead) {
      return
    }

    const enemyCount = net ? this.clientEnemies.size : this.spawner.all.length
    let waveLabel: string
    if (net) {
      this.netSurgeTimer = Math.max(0, this.netSurgeTimer - delta)
      if (this.netFinalBossAlive) waveLabel = '☠ THE DEATH'
      else if (this.netBossAlive) waveLabel = this.netBossIsSummoner ? '⚠ SUMMONER' : '⚠ BOSS FIGHT'
      else if (this.netSurgeTimer > 0) waveLabel = '⚡ SURGE!'
      else waveLabel = this.spawner.waveLabel(runData.elapsed)
    } else {
      waveLabel = this.spawner.waveLabel()
    }
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
