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
import { useProfileStore } from '../store/profileStore'
import { useAuthStore } from '../store/authStore'
import { CHARACTER_DEFS } from './characters'
import { minimapData } from './minimapData'
import { runData, RUN_DURATION } from './runData'
import { difficultyScale, computeSpeedScale, computeHpScale, computeDamageScale, computeXpScale } from './difficultyScale'
import { soundSystem } from './SoundSystem'
import { activeNetClient } from '../net/netState'
import type { EnemySnapshot, PlayerSnapshot } from '../net/protocol'
import { saveRun, clearRun, type RunSnapshot } from './runSave'
import { consumePendingRunRestore } from './pendingRunRestore'
import { TouchJoystick } from './TouchJoystick'
import { TouchDashButton } from './TouchDashButton'
import { ChunkManager } from './ChunkManager'
import { useStageStore } from '../store/stageStore'

const SPAWN_X = 0
const SPAWN_Y = 0

function stage2WaveLabel(elapsed: number): string {
  const t = elapsed
  if (t < 30_000)  return 'Wave 1 — Drifters & Scurriers'
  if (t < 60_000)  return 'Wave 2 — + Lurkers'
  if (t < 90_000)  return 'Wave 3 — + Mummies'
  if (t < 150_000) return 'Wave 4 — + Jackals'
  if (t < 240_000) return 'Wave 5 — + Cultists'
  if (t < 360_000) return 'Wave 6 — + Golems'
  if (t < 480_000) return 'Wave 7 — + Knights'
  return 'Wave 8 — + Archfiends'
}

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
  private beforeUnloadHandler: (() => void) | null = null
  private charType = ''
  private joystick!: TouchJoystick
  private dashButton: TouchDashButton | null = null
  private chunkManager: ChunkManager | null = null
  private selectedStage = 1
  corridorHalfY: number | null = null
  private wallTop: Phaser.GameObjects.TileSprite | null = null
  private wallBot: Phaser.GameObjects.TileSprite | null = null
  private floorSprite: Phaser.GameObjects.TileSprite | null = null

  constructor() {
    super({ key: 'MainScene' })
  }

  create() {
    this.selectedStage = useStageStore.getState().selectedStage

    generateAssets(this)
    generatePropTextures(this)

    if (this.selectedStage === 2) {
      // Stage 2 background set up after zoom is established (later in create)
    } else {
      // Stage 1: open world
      this.physics.world.setBounds(-500_000, -500_000, 1_000_000, 1_000_000)

      this.add.tileSprite(0, 0, 1_000_000, 1_000_000, 'ground_tiles')
        .setOrigin(0.5, 0.5)
        .setTileScale(0.1, 0.1)
        .setDepth(-10)

      this.chunkManager = new ChunkManager(this)
    }

    this.effects = new EffectsSystem(this)
    const charType = useCharacterStore.getState().selectedCharacter
    this.charType = charType
    useGameStore.setState({ isMeleeChar: charType === 'ares' })
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
        mightPicks: savedRun.mightPicks ?? (() => {
          const metaMight = useProfileStore.getState().upgrades.might ?? 0
          const baseMight = (1.0 + metaMight * 0.05) * charDef.mightMult
          return Math.min(5, Math.max(0, Math.round((savedRun.might - baseMight) / 0.1)))
        })(),
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
        axeAmount: savedRun.axeAmount ?? 0,
        axeDamage: savedRun.axeDamage ?? 0,
        axePierce: savedRun.axePierce ?? 0,
        axeEvolution: savedRun.axeEvolution ?? false,
        divineShield: savedRun.divineShield ?? false,
        armor: savedRun.armor ?? 0,
        hpRegen: savedRun.hpRegen,
        lifeDrain: savedRun.lifeDrain,
        sessionCoins: savedRun.sessionCoins,
        kills: savedRun.kills ?? 0,
        bossKills: savedRun.bossKills ?? 0,
        xpGain: savedRun.xpGain ?? 0,
        magnetRange: savedRun.magnetRange ?? 0,
        orbSpeed: savedRun.orbSpeed ?? 0,
        orbPower: savedRun.orbPower ?? 0,
        orbRange: savedRun.orbRange ?? 0,
        equinox: savedRun.equinox ?? false,
        solstice: savedRun.solstice ?? false,
        dualGunDamage: savedRun.dualGunDamage ?? 0,
        dualGunSpeed: savedRun.dualGunSpeed ?? 0,
        dualGunExtra: savedRun.dualGunExtra ?? 0,
        dualGunAttackInterval: savedRun.dualGunAttackInterval ?? 1400,
        echo: savedRun.echo ?? 0,
        ravens: savedRun.ravens ?? false,
        ravensCD: savedRun.ravensCD ?? 0,
        ravensPower: savedRun.ravensPower ?? 0,
        ravensCount: savedRun.ravensCount ?? 0,
        spear: savedRun.spear ?? false,
        spearCount: savedRun.spearCount ?? 0,
        spearInterval: savedRun.spearInterval ?? 0,
        spearPierce: savedRun.spearPierce ?? 0,
        spearSpeed: savedRun.spearSpeed ?? 0,
        spearStorm: savedRun.spearStorm ?? false,
        meleeRange: savedRun.meleeRange ?? 0,
        meleeArc: savedRun.meleeArc ?? 0,
        meleeSpeed: savedRun.meleeSpeed ?? 0,
        meleeDamage: savedRun.meleeDamage ?? 0,
      })
    }

    const camZoom = window.innerWidth <= 768 ? 0.7 : 1.2
    this.cameras.main.setZoom(camZoom)

    if (this.selectedStage === 2) {
      // Corridor stage — world-space walls above and below the playable strip (VS Inlaid Library style)
      // CORRIDOR_HALF > viewport half-height so walls are off-screen at spawn (player must walk to find them)
      const CORRIDOR_HALF = 380  // world units from Y=0 to wall edge
      const WALL_H = 2000        // thick enough to fill any viewport

      // Same pre-scale fix as the wall: original tile 1254×0.1=125.4px (non-integer).
      // 130 is the nearest multiple-of-10 → 130×1.4=182 and 130×0.7=91 (both integers).
      const FLOOR_TILE_PX = 130
      const floorSrc = this.textures.get('floor_stage2').source[0].image as HTMLImageElement
      const floorCanvas = document.createElement('canvas')
      floorCanvas.width = FLOOR_TILE_PX
      floorCanvas.height = FLOOR_TILE_PX
      const floorCtx = floorCanvas.getContext('2d')!
      floorCtx.imageSmoothingEnabled = true
      floorCtx.imageSmoothingQuality = 'high'
      floorCtx.drawImage(floorSrc, 0, 0, FLOOR_TILE_PX, FLOOR_TILE_PX)
      this.textures.addCanvas('floor_tile_scaled', floorCanvas)
      this.floorSprite = this.add.tileSprite(0, 0, 8000, 4000, 'floor_tile_scaled')
        .setOrigin(0.5, 0.5).setTileScale(1, 1).setDepth(-10)

      // Pre-scale the wall texture to exactly 380×380 px using the 2D canvas API.
      // At zoom 1.4: 380×1.4=532 screen px (integer). At zoom 0.7: 380×0.7=266 (integer).
      // Tiling a pre-scaled texture at tileScale 1.0 means no downsampling in the GPU
      // shader — eliminating the column-edge aliasing that caused the flickering.
      // The baked 2D canvas drawImage uses bilinear downscaling, so the result is
      // already anti-aliased before it ever reaches the GPU tiler.
      const WALL_TILE_PX = 380
      const wallSrc = this.textures.get('wall_stage2').source[0].image as HTMLImageElement
      const tileCanvas = document.createElement('canvas')
      tileCanvas.width = WALL_TILE_PX
      tileCanvas.height = WALL_TILE_PX
      const tileCtx = tileCanvas.getContext('2d')!
      tileCtx.imageSmoothingEnabled = true
      tileCtx.imageSmoothingQuality = 'high'
      tileCtx.drawImage(wallSrc, 0, 0, WALL_TILE_PX, WALL_TILE_PX)
      this.textures.addCanvas('wall_tile_scaled', tileCanvas)
      // tilePositionY: aligns decorated edge to the corridor boundary.
      // Equivalent of original 857/1254 at new scale: 380 - (WALL_H % 380) = 380-100 = 280
      const TILE_POS_Y = WALL_TILE_PX - (WALL_H % WALL_TILE_PX)  // 280
      const WALL_W = 3000
      // Top wall: depth 3.5 — renders UNDER player (4) so the player sprite stays
      // visible when walking toward the north wall.
      this.wallTop = this.add.tileSprite(0, -(CORRIDOR_HALF + WALL_H / 2), WALL_W, WALL_H, 'wall_tile_scaled')
        .setOrigin(0.5, 0.5).setTileScale(1, 1).setDepth(3.5).setTilePosition(0, TILE_POS_Y)
      // Bottom wall: flipped Y so the decorated edge faces the corridor.
      this.wallBot = this.add.tileSprite(0, (CORRIDOR_HALF + WALL_H / 2), WALL_W, WALL_H, 'wall_tile_scaled')
        .setOrigin(0.5, 0.5).setTileScale(1, 1).setDepth(4.5).setFlipY(true).setTilePosition(0, TILE_POS_Y)

      // Asymmetric Y bounds: top extended so feet (y+24) reach -CORRIDOR_HALF,
      // bottom lets feet reach +CORRIDOR_HALF for small sprites (wall covers larger ones).
      // Player.ts margin=64: top center_min = -(CORRIDOR_HALF+88)+64 = -(CORRIDOR_HALF+24), feet = -CORRIDOR_HALF ✓
      const TOP_BOUND    = CORRIDOR_HALF + 88  // 468
      const BOTTOM_BOUND = CORRIDOR_HALF + 40  // 420
      this.physics.world.setBounds(-500_000, -TOP_BOUND, 1_000_000, TOP_BOUND + BOTTOM_BOUND)
      this.corridorHalfY = CORRIDOR_HALF  // used by CombatSystem to cull projectiles at visual wall

      this.spawner.disabled = true
      this.spawner.corridorHalfHeight = CORRIDOR_HALF
    }

    this.cameras.main.startFollow(this.player.graphic, true, 0.1, 0.1)
    // Snap camera to whole pixels so tileSprite seams don't flicker as the lerp
    // produces fractional positions (tile scale 0.3 × 1254px = 376.2px non-integer tiles).
    this.cameras.main.setRoundPixels(true)

    // Position fpsText at screen pixel (8, 8) — scrollFactor(0) objects are still
    // transformed by the zoom matrix, so we must invert it to get screen coords.
    const W = this.scale.width, H = this.scale.height
    const fpsX = W / 2 + (8 - W / 2) / camZoom
    const fpsY = H / 2 + (46 - H / 2) / camZoom
    this.fpsText = this.add
      .text(fpsX, fpsY, '', { fontSize: '12px', color: '#ffffff', fontFamily: 'monospace' })
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

    // ESC is handled in GameView (App.tsx) so it works before Phaser finishes loading.
    let sceneAlive = true

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

    // Save immediately so a refresh within the first 10s can still restore.
    const initSnap = this.buildSnapshot()
    if (initSnap) saveRun(initSnap)

    // Also save on beforeunload so a refresh between periodic saves restores correctly.
    this.beforeUnloadHandler = () => {
      const snap = this.buildSnapshot()
      if (snap) saveRun(snap)
    }
    window.addEventListener('beforeunload', this.beforeUnloadHandler)

    this.events.once('shutdown', () => {
      sceneAlive = false
      soundSystem.stopMusic()
      unsubLevelUp(); unsubPause(); unsubDamage(); unsubDead(); unsubWon()
      if (this.beforeUnloadHandler) {
        window.removeEventListener('beforeunload', this.beforeUnloadHandler)
        this.beforeUnloadHandler = null
      }
      this.chunkManager?.destroyAll()
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

  private buildSnapshot(): RunSnapshot | null {
    const gs = useGameStore.getState()
    if (gs.isDead || gs.isWon) return null
    const base = {
      character: this.charType,
      stage: this.selectedStage as 1 | 2,
      elapsed: runData.elapsed,
      playerX: this.player.x,
      playerY: this.player.y,
      kills: gs.kills, bossKills: gs.bossKills,
      xp: gs.xp, xpNeeded: gs.xpNeeded, level: gs.level,
      hp: gs.hp, maxHp: gs.maxHp,
      might: gs.might, mightPicks: gs.mightPicks, attackInterval: gs.attackInterval, moveSpeed: gs.moveSpeed,
      dashCooldown: gs.dashCooldown, dashDistance: gs.dashDistance,
      multiShot: gs.multiShot, piercing: gs.piercing, aura: gs.aura, auraTick: gs.auraTick, auraRange: gs.auraRange,
      orbital: gs.orbital, wand: gs.wand, boomerang: gs.boomerang, flameTrail: gs.flameTrail,
      bloodNova: gs.bloodNova, bloodNovaCD: gs.bloodNovaCD, vampiric: gs.vampiric, lightning: gs.lightning,
      lightningTargets: gs.lightningTargets, lightningCooldown: gs.lightningCooldown,
      axe: gs.axe, axeAmount: gs.axeAmount, axeDamage: gs.axeDamage, axePierce: gs.axePierce, axeEvolution: gs.axeEvolution,
      divineShield: gs.divineShield, armor: gs.armor, hpRegen: gs.hpRegen, lifeDrain: gs.lifeDrain,
      sessionCoins: gs.sessionCoins,
      xpGain: gs.xpGain, magnetRange: gs.magnetRange,
      orbSpeed: gs.orbSpeed, orbPower: gs.orbPower, orbRange: gs.orbRange,
      equinox: gs.equinox, solstice: gs.solstice,
      dualGunDamage: gs.dualGunDamage, dualGunSpeed: gs.dualGunSpeed, dualGunExtra: gs.dualGunExtra,
      dualGunAttackInterval: gs.dualGunAttackInterval, echo: gs.echo,
      ravens: gs.ravens, ravensCD: gs.ravensCD, ravensPower: gs.ravensPower, ravensCount: gs.ravensCount,
      spear: gs.spear,
      spearCount: gs.spearCount, spearInterval: gs.spearInterval, spearPierce: gs.spearPierce,
      spearSpeed: gs.spearSpeed, spearStorm: gs.spearStorm,
      meleeRange: gs.meleeRange, meleeArc: gs.meleeArc, meleeSpeed: gs.meleeSpeed, meleeDamage: gs.meleeDamage,
    }
    if (activeNetClient) {
      return { ...base, nextBossAt: 0, warningFired: false, finalBossWarningFired: false, bossAlive: false, finalBossAlive: false, enemies: [] }
    }
    const sp = this.spawner.getSnapshot()
    return { ...base, nextBossAt: sp.nextBossAt, warningFired: sp.warningFired, finalBossWarningFired: sp.finalBossWarningFired, bossAlive: sp.bossAlive, finalBossAlive: sp.finalBossAlive, enemies: this.spawner.getSaveableEnemies() }
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

  private handleAdminGiveUpgrade(upgradeId: string, targetLevel: number) {
    const net = activeNetClient
    if (net) {
      net.send({ type: 'adminGiveUpgrade', upgradeId, targetLevel })
      return
    }
    // Solo: apply directly on the client
    useGameStore.getState().adminSetUpgrade(upgradeId as any, targetLevel)
  }

  private handleAdminClearUpgrades() {
    const net = activeNetClient
    if (net) {
      net.send({ type: 'adminClearUpgrades' })
      return
    }
    useGameStore.getState().adminResetUpgrades()
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
      basic:     '⚡  HORDE INCOMING  ⚡',
      speeder:   '⚡  SPEEDERS INCOMING  ⚡',
      tank:      '⚡  TANKS INCOMING  ⚡',
      ghost:     '⚡  GHOST TIDE  ⚡',
      ranged:    '⚡  RANGED FLOOD  ⚡',
      // Stage 2
      drifter:   '⚡  DRIFTER RUSH  ⚡',
      scurrier:  '⚡  SCURRIER SWARM  ⚡',
      lurker:    '⚡  LURKER TIDE  ⚡',
      jackal:    '⚡  JACKAL PACK  ⚡',
      cultist:   '⚡  CULTIST RITUAL  ⚡',
      golem:     '⚡  GOLEM MARCH  ⚡',
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
    let shutdownStarted = false
    this.events.once('shutdown', () => {
      shutdownStarted = true
      unsubChosen()
      useGameStore.getState().setServerDrivenLeveling(false)
      net.close()
    })

    // Surface unexpected disconnects so the game doesn't silently freeze
    net.onClose(() => {
      if (shutdownStarted || net.closedGracefully) return
      if (!this.sys.displayList) return
      const gs = useGameStore.getState()
      if (!gs.isDead && !gs.isWon) {
        useAuthStore.getState().showSystemToast('Connection lost', '#ff6644')
        useGameStore.getState().die()
      }
    })

    net.on('levelUp', (msg) => {
      const choices = msg.choices
        .map(id => UPGRADE_POOL.find(u => u.id === id))
        .filter((u): u is Upgrade => u !== undefined)
      // Fill bar to 100% first so the player sees it complete before the upgrade screen appears.
      // Use setTimeout (not this.time.delayedCall) so the timer runs even when the scene is paused —
      // Phaser's scene clock stops on pause, which would deadlock the upgrade screen from ever appearing.
      useGameStore.setState({ xp: useGameStore.getState().xpNeeded })
      setTimeout(() => {
        const gs = useGameStore.getState()
        if (gs.isDead || gs.isWon) return
        if (choices.length === 0) {
          // All upgrades maxed — update level silently without freezing the screen
          useGameStore.setState({ level: msg.level, xp: msg.xp, xpNeeded: msg.xpToNext })
          return
        }
        useGameStore.setState({
          level: msg.level,
          xp: msg.xp,
          xpNeeded: msg.xpToNext,
          isLevelUpPending: true,
          upgradeChoices: choices,
          chosenUpgrade: null,
        })
      }, 350)
    })

    net.on('xpGrant', (msg) => {
      useGameStore.setState({ xp: msg.xp, xpNeeded: msg.xpToNext })
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
      // Apply per-kill flat heal (lifeDrain) — skipped in applyHit because server decides kills
      const { lifeDrain } = useGameStore.getState()
      if (lifeDrain > 0) useGameStore.setState(s => ({ hp: Math.min(s.maxHp, s.hp + lifeDrain) }))
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

    net.on('adminSetUpgrade', (msg) => {
      useGameStore.getState().adminSetUpgrade(msg.upgradeId as any, msg.level)
    })

    net.on('adminClearUpgrades', () => {
      useGameStore.getState().adminResetUpgrades()
    })

    net.on('roleChanged', (msg) => {
      useAuthStore.getState().setRole(msg.role)
      if (msg.role === 'admin') {
        useAuthStore.getState().showSystemToast('You have been granted admin access', '#88ff88')
      } else {
        useAuthStore.getState().showSystemToast('Your admin access has been revoked', '#ffaa44')
      }
    })

    net.on('playerOnline', (msg) => {
      useAuthStore.getState().showSystemToast(`${msg.username} is online`, '#44aaff')
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
        existing.update(snap.x, snap.y, snap.aura, snap.orbital, snap.ravens)
      } else {
        this.remotePlayers.set(snap.id, new RemotePlayer(this, snap.x, snap.y, snap.characterType, snap.username))
      }
    }
  }

  update(_time: number, delta: number) {
    if (useGameStore.getState().isPaused) return

    // Re-centre screen-sized wall/floor sprites on the camera and scroll via tilePosition.
    // Tiles are pre-scaled to integer world px widths so seams never fall on fractional pixels.
    if (this.wallTop && this.wallBot) {
      const camCX = Math.round(this.cameras.main.worldView.centerX)
      this.wallTop.x = camCX
      this.wallBot.x = camCX
      // tilePositionX = sprite.left = camCX - W/2 — same derivation as floor
      const wallTexelX = camCX - 1500   // W/2 = 3000/2
      this.wallTop.tilePositionX = wallTexelX
      this.wallBot.tilePositionX = wallTexelX
    }
    if (this.floorSprite) {
      const cam = this.cameras.main
      const cx = Math.round(cam.worldView.centerX)
      const cy = Math.round(cam.worldView.centerY)
      this.floorSprite.x = cx
      this.floorSprite.y = cy
      // tilePositionX = sprite.left = cx - W/2 makes UV = wx/tileWidth (world-aligned).
      // Both position and offset derive from cx, so they're always in sync — no slipping.
      this.floorSprite.tilePositionX = cx - 4000   // W/2 = 8000/2
      this.floorSprite.tilePositionY = cy - 2000   // H/2 = 4000/2
    }

    const spawnRequest = useGameStore.getState().adminSpawnRequest
    if (spawnRequest) {
      useGameStore.getState().clearAdminSpawnRequest()
      this.handleAdminSpawn(spawnRequest)
    }

    const giveRequest = useGameStore.getState().adminGiveRequest
    if (giveRequest) {
      useGameStore.getState().clearAdminGiveRequest()
      this.handleAdminGiveUpgrade(giveRequest.upgradeId, giveRequest.targetLevel)
    }

    if (useGameStore.getState().adminClearRequest) {
      useGameStore.getState().clearAdminClearRequest()
      this.handleAdminClearUpgrades()
    }

    this.chunkManager?.update(this.player.x, this.player.y)
    this.player.touchVx = this.joystick.vx
    this.player.touchVy = this.joystick.vy
    if (this.dashButton) {
      this.dashButton.update()
      if (this.dashButton.consumePress()) this.player.touchDashPressed = true
    }
    const novaPaused = this.combat.novaPaused
    if (!novaPaused) this.player.update(delta, this.effects)
    this.combat.setFacing(this.player.facingVx, this.player.facingVy)
    this.combat.setMoving(this.player.isMoving)
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
        const snap = this.buildSnapshot()
        if (snap) saveRun(snap)
      }
    } else {
      // Singleplayer
      if (!novaPaused) {
        runData.elapsed += delta
        // Stage 2: survive-to-end win (server normally handles this; fallback for offline mode)
        if (this.selectedStage === 2 && runData.elapsed >= RUN_DURATION) {
          soundSystem.bossDie()
          useGameStore.getState().win()
          this.scene.pause()
          return
        }
        this.spawner.update(this.player.x, this.player.y, delta)
        this.combat.update(this.player.x, this.player.y, this.spawner.all, delta)
      }

      this.saveTimer += delta
      if (this.saveTimer >= this.SAVE_INTERVAL) {
        this.saveTimer = 0
        const snap = this.buildSnapshot()
        if (snap) saveRun(snap)
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
      else waveLabel = this.selectedStage === 2
        ? stage2WaveLabel(runData.elapsed)
        : this.spawner.waveLabel(runData.elapsed)
    } else {
      waveLabel = this.selectedStage === 2
        ? stage2WaveLabel(runData.elapsed)
        : this.spawner.waveLabel()
    }
    runData.waveLabel = waveLabel
    runData.enemyCount = enemyCount
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`)

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
