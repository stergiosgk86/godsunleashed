import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { PreloadScene } from './game/PreloadScene'
import { MainScene } from './game/MainScene'
import { HUD } from './ui/HUD'
import { LevelUpScreen } from './ui/LevelUpScreen'
import { BossHPBar } from './ui/BossHPBar'
import { Minimap } from './ui/Minimap'
import { PauseMenu } from './ui/PauseMenu'
import { DeathScreen } from './ui/DeathScreen'
import { WinScreen } from './ui/WinScreen'
import { MainMenu } from './ui/MainMenu'
import { MultiplayerLobby } from './ui/MultiplayerLobby'
import { AuthScreen } from './ui/AuthScreen'
import { useGameStore, DASH_COOLDOWN_MS } from './store/gameStore'
import { ACHIEVEMENT_MAP } from './game/achievements'
import { useProfileStore } from './store/profileStore'
import { useAuthStore } from './store/authStore'
import { useCharacterStore } from './store/characterStore'
import { clearRun, loadRun } from './game/runSave'
import { setPendingRunRestore, peekPendingRunRestore } from './game/pendingRunRestore'
import { CHARACTER_DEFS } from './game/characters'
import { setNetClient, activeNetClient } from './net/netState'
import { NetClient } from './net/NetClient'
import { runData } from './game/runData'
import { AchievementToast } from './ui/AchievementToast'
import { SystemToast } from './ui/SystemToast'
import { LobbyToast } from './ui/LobbyToast'
import { soundSystem } from './game/SoundSystem'
import type { PlayerSnapshot } from './net/protocol'

const WS_BASE = import.meta.env.VITE_SERVER_URL
  ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

function makeWsUrl(token: string) {
  return `${WS_BASE}?token=${encodeURIComponent(token)}`
}

function parseJwt(token: string): { userId: number; username: string } {
  const payload = token.split('.')[1]
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

function GameView({ onQuit, onPlayAgain }: { onQuit: () => void; onPlayAgain: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  // ESC handler lives here so it's active immediately on mount, before Phaser finishes loading.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const gs = useGameStore.getState()
      if (!gs.isDead && !gs.isWon && !gs.isLevelUpPending) gs.togglePause()
    }
    window.addEventListener('keydown', onEsc, { capture: true })
    return () => window.removeEventListener('keydown', onEsc, { capture: true })
  }, [])

  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#11112a',
      physics: { default: 'arcade', arcade: { debug: false } },
      input: { activePointers: 3 },
      scene: [PreloadScene, MainScene],
      parent: containerRef.current ?? undefined,
    }

    const game = new Phaser.Game(config)

    // Fire synthetic keyup events when the window loses focus so held
    // keys don't get stuck (e.g. after right-click opens the context menu).
    const onBlur = () => {
      for (const key of ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', ' ']) {
        window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
      }
    }
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('blur', onBlur)
      game.destroy(true)
    }
  }, [])

  return (
    <div
      style={{ position: 'relative', width: '100vw', height: '100vh' }}
      onContextMenu={e => e.preventDefault()}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <HUD />
      <BossHPBar />
      <Minimap />
      <LevelUpScreen />
      <PauseMenu onQuit={onQuit} />
      <DeathScreen onPlayAgain={onPlayAgain} onMainMenu={onQuit} />
      <WinScreen onPlayAgain={onPlayAgain} onMainMenu={onQuit} />
      <AchievementToast />
      <SystemToast />
    </div>
  )
}

function App() {
  const [inGame, setInGame] = useState(false)
  const [inLobby, setInLobby] = useState(false)
  const [runKey, setRunKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lobbyNames, setLobbyNames] = useState<string[] | null>(null)
  const initRef = useRef(false)
  const prevLobbyCount = useRef(0)
  const inLobbyRef = useRef(false)
  const isMultiplayerRun = useRef(false)

  const token = useAuthStore(s => s.token)
  const setAuth = useAuthStore(s => s.setAuth)
  const fetchProfile = useProfileStore(s => s.fetchProfile)

  function startRun() {
    const rawUpgrades = useProfileStore.getState().upgrades
    const char = CHARACTER_DEFS[useCharacterStore.getState().selectedCharacter]
    // Clamp every rank to [0, 5] — defence-in-depth against corrupted profile data
    const clampRank = (n: number) => Math.max(0, Math.min(5, Math.floor(isFinite(n) ? n : 0)))
    const upgrades = {
      maxHealth:    clampRank(rawUpgrades.maxHealth),
      recovery:     clampRank(rawUpgrades.recovery),
      magnet:       clampRank(rawUpgrades.magnet),
      might:        clampRank(rawUpgrades.might),
      luck:         clampRank(rawUpgrades.luck),
      growth:       clampRank(rawUpgrades.growth),
      moveSpeed:    clampRank(rawUpgrades.moveSpeed),
      armor:        clampRank(rawUpgrades.armor),
      attackSpeed:  clampRank(rawUpgrades.attackSpeed),
    }

    useGameStore.getState().resetRun()

    const startMaxHp = Math.max(50, Math.floor(100 * (1 + upgrades.maxHealth * 0.1)) + char.bonusMaxHp)

    useGameStore.setState({
      might:          (1.0 + upgrades.might * 0.05) * char.mightMult,
      maxHp:          startMaxHp,
      hp:             startMaxHp,
      hpRegen:        (upgrades.recovery ?? 0) * 0.1 + char.bonusHpRegen,
      moveSpeed:      Math.min(240, Math.floor((160 + char.bonusMoveSpeed) * (1 + (upgrades.moveSpeed ?? 0) * 0.02))),
      attackInterval:     Math.max(250, Math.floor(1350 * char.attackIntervalMult * Math.pow(0.95, upgrades.attackSpeed))),
      wandAttackInterval: Math.max(250, Math.floor(1200 * char.attackIntervalMult * Math.pow(0.95, upgrades.attackSpeed))),
      dashCooldown:   Math.max(400, Math.floor(DASH_COOLDOWN_MS * char.dashCooldownMult)),
      dashDistance:   1 + char.bonusDashDistance,
      aura:           char.startAura,
      lightning:      char.startLightning,
      boomerang:      char.startBoomerang,
      flameTrail:     char.startFlameTrail,
      orbital:        char.startOrbital,
      wand:           char.startWand,
      equinox:        char.startEquinox,
      solstice:       char.startSolstice,
      dualGunAttackInterval: Math.max(500, Math.floor(1400 * char.attackIntervalMult * Math.pow(0.95, upgrades.attackSpeed))),
      lifeDrain:      char.lifeDrain,
      armor:          char.baseArmor + (upgrades.armor ?? 0),
    })
  }

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      // Handle Google OAuth ?token= in URL
      const params = new URLSearchParams(window.location.search)
      const urlToken = params.get('token')
      if (urlToken) {
        try {
          const payload = parseJwt(urlToken)
          setAuth(urlToken, payload.userId, payload.username)
        } catch { /* malformed token — ignore */ }
        window.history.replaceState({}, '', '/')
      }

      // Load profile if authenticated, then check for a mid-run snapshot to restore
      const currentToken = useAuthStore.getState().token
      if (currentToken) {
        await fetchProfile()
        const snap = await loadRun()
        if (snap) {
          setPendingRunRestore(snap)
          await handlePlay(true)
        }
      }

      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    inLobbyRef.current = inLobby
    if (!inLobby) prevLobbyCount.current = 0
  }, [inLobby])

  useEffect(() => {
    if (!inGame && !inLobby && token) soundSystem.startMenuMusic()
  }, [inGame, inLobby, token])

  useEffect(() => {
    if (!token) return
    const es = new EventSource('/lobby/stream')
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as { playersWaiting: number; names: string[] }
        if (!inLobbyRef.current && data.playersWaiting > prevLobbyCount.current) {
          setLobbyNames(data.names)
        } else if (data.playersWaiting === 0) {
          setLobbyNames(null)
        }
        prevLobbyCount.current = data.playersWaiting
      } catch { /* non-fatal */ }
    }
    return () => es.close()
  }, [token])

  const runSubmittedRef = useRef(false)

  // Register the runSaved handler on any net client (solo or multi).
  // The server writes the run to DB and sends back the result.
  function registerRunSavedHandler(net: NetClient) {
    net.on('runSaved', (msg) => {
      if (msg.newAchievements.length) {
        for (const id of msg.newAchievements) {
          const a = ACHIEVEMENT_MAP[id]
          if (a) useGameStore.setState({ recentAchievement: { id, name: a.name } })
        }
      }
      useProfileStore.getState().fetchProfile()
    })
  }

  // Only used as a fallback when there is no active WS connection (should not happen
  // in practice anymore, but kept so unauthenticated/offline edge cases degrade gracefully).
  function submitRun() {
    if (runSubmittedRef.current) return
    if (activeNetClient) return  // server already saves WS-connected runs
    const s = useGameStore.getState()
    const authToken = useAuthStore.getState().token
    if (!authToken || s.kills === 0) return
    runSubmittedRef.current = true
    const timeMs = runData.elapsed
    const score = s.kills * 10 + s.sessionCoins * 5 + Math.floor(timeMs / 1000) * 2 + (s.isWon ? 5000 : 0)
    const weaponCount = 1 +
      (s.aura > 0 ? 1 : 0) +
      (s.orbital > 0 ? 1 : 0) +
      (s.boomerang ? 1 : 0) +
      (s.flameTrail ? 1 : 0) +
      (s.bloodNova ? 1 : 0) +
      (s.lightning ? 1 : 0) +
      (s.axe ? 1 : 0)
    fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        score, kills: s.kills, timeSurvived: timeMs, coins: s.sessionCoins,
        won: s.isWon, multiplayer: false, bossKills: s.bossKills, level: s.level,
        damageDealt: s.damageDealt, weaponCount, tookDamage: s.tookDamageThisRun,
        finalHp: s.hp, maxHp: s.maxHp,
      }),
    })
      .then(r => r.json())
      .then((data: { newAchievements?: string[] }) => {
        if (data.newAchievements?.length) {
          for (const id of data.newAchievements) {
            const a = ACHIEVEMENT_MAP[id]
            if (a) useGameStore.setState({ recentAchievement: { id, name: a.name } })
          }
        }
        useProfileStore.getState().fetchProfile()
      })
      .catch(() => { /* non-fatal */ })
  }

  // Submit run to leaderboard on death or win (fallback path only)
  // Poll for role changes while on the main menu (no WS connection there)
  useEffect(() => {
    if (inGame || !token) return
    const poll = setInterval(fetchProfile, 20_000)
    const onVisible = () => { if (!document.hidden) fetchProfile() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(poll); document.removeEventListener('visibilitychange', onVisible) }
  }, [inGame, token, fetchProfile])

  useEffect(() => {
    if (!inGame) return
    runSubmittedRef.current = false
    const unsub = useGameStore.subscribe(
      s => s.isDead || s.isWon,
      (ended) => { if (ended) submitRun() },
    )
    return unsub
  }, [inGame])

  async function handlePlay(restore = false) {
    isMultiplayerRun.current = false
    if (!restore) clearRun()
    startRun()
    const authToken = useAuthStore.getState().token
    const charType = useCharacterStore.getState().selectedCharacter
    const savedRun = restore ? peekPendingRunRestore() : null
    if (authToken) {
      const net = new NetClient(makeWsUrl(authToken))
      registerRunSavedHandler(net)
      await new Promise<void>((resolve) => {
        net.on('start', (msg) => { net.playerId = msg.yourId; setNetClient(net); resolve() })
        net.onOpen(() => net.send({
          type: 'join',
          characterType: charType,
          solo: true,
          viewportW: window.innerWidth,
          viewportH: window.innerHeight,
          ...(savedRun && {
            resumeElapsed: savedRun.elapsed,
            resumeLevel: savedRun.level,
            resumeXp: savedRun.xp,
          }),
        }))
      })
    }
    setInGame(true)
  }

  function handleMultiplayer() {
    setInLobby(true)
  }

  function handleLobbyReady(net: NetClient, _players: PlayerSnapshot[]) {
    registerRunSavedHandler(net)
    setNetClient(net)
    startRun()
    isMultiplayerRun.current = true
    setInLobby(false)
    setInGame(true)
  }

  function handleLobbyCancel() {
    setInLobby(false)
  }

  function handleQuit() {
    submitRun()
    clearRun()
    soundSystem.stopMusic()
    activeNetClient?.close()
    setNetClient(null)
    useGameStore.getState().resetRun()
    sessionStorage.removeItem('gods_menu_view')
    setInGame(false)
    // Sync profile after server has had time to process the WS close and save the run.
    setTimeout(() => useProfileStore.getState().fetchProfile(), 2000)
  }

  function handlePlayAgain() {
    const wasMultiplayer = isMultiplayerRun.current
    isMultiplayerRun.current = false
    activeNetClient?.close()
    setNetClient(null)
    clearRun()
    runSubmittedRef.current = false
    runData.elapsed = 0
    if (wasMultiplayer) {
      useGameStore.getState().resetRun()
      setInGame(false)
      setInLobby(true)
    } else {
      void handlePlay().then(() => setRunKey(k => k + 1))
    }
  }

  function handleLogout() {
    useAuthStore.getState().clearAuth()
    useProfileStore.getState().reset()
    sessionStorage.removeItem('gods_menu_view')
    setInGame(false)
    setInLobby(false)
  }

  if (loading) return null

  if (!token) {
    return <AuthScreen onAuthenticated={() => {}} />
  }

  if (inLobby) {
    const charType = useCharacterStore.getState().selectedCharacter
    return (
      <MultiplayerLobby
        characterType={charType}
        onReady={handleLobbyReady}
        onCancel={handleLobbyCancel}
      />
    )
  }

  const lobbyToastEl = lobbyNames ? (
    <LobbyToast
      names={lobbyNames}
      onDismiss={() => setLobbyNames(null)}
      onJoin={() => { setLobbyNames(null); handleMultiplayer() }}
    />
  ) : null

  if (!inGame) {
    return <>
      <MainMenu onPlay={handlePlay} onMultiplayer={handleMultiplayer} onLogout={handleLogout} />
      {lobbyToastEl}
    </>
  }

  return <>
    <GameView key={runKey} onQuit={handleQuit} onPlayAgain={handlePlayAgain} />
    {lobbyToastEl}
  </>
}

export default App
