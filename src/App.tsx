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
import { clearRun } from './game/runSave'
import { CHARACTER_DEFS } from './game/characters'
import { setNetClient, activeNetClient } from './net/netState'
import { runData } from './game/runData'
import { AchievementToast } from './ui/AchievementToast'
import { LobbyToast } from './ui/LobbyToast'
import { soundSystem } from './game/SoundSystem'
import type { NetClient } from './net/NetClient'
import type { PlayerSnapshot } from './net/protocol'

function parseJwt(token: string): { userId: number; username: string } {
  const payload = token.split('.')[1]
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

function GameView({ onQuit, onPlayAgain }: { onQuit: () => void; onPlayAgain: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const togglePause = useGameStore(s => s.togglePause)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const gs = useGameStore.getState()
      if (e.key === 'Escape' && !gs.isDead && !gs.isWon) togglePause()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [togglePause])

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
      moveSpeed:      Math.min(300, Math.floor((200 + char.bonusMoveSpeed) * (1 + (upgrades.moveSpeed ?? 0) * 0.02))),
      attackInterval: Math.max(250, Math.floor(600 * char.attackIntervalMult * Math.pow(0.95, upgrades.attackSpeed))),
      dashCooldown:   Math.max(400, Math.floor(DASH_COOLDOWN_MS * char.dashCooldownMult)),
      dashDistance:   1 + char.bonusDashDistance,
      aura:           char.startAura,
      lightning:      char.startLightning,
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

      // Load profile if authenticated
      const currentToken = useAuthStore.getState().token
      // Read gods_screen before any await — a later effect overwrites it with 'menu'
      const shouldRestoreGame = sessionStorage.getItem('gods_screen') === 'game'
      if (currentToken) {
        await fetchProfile()
        // Restore singleplayer session after page reload
        if (shouldRestoreGame) {
          startRun()
          startRunWithToken()
          setInGame(true)
        }
      }

      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    sessionStorage.setItem('gods_screen', inGame ? 'game' : 'menu')
  }, [inGame])

  useEffect(() => {
    inLobbyRef.current = inLobby
    if (!inLobby) prevLobbyCount.current = 0
  }, [inLobby])

  useEffect(() => {
    if (!token) return
    const poll = async () => {
      try {
        const res = await fetch('/lobby/status')
        if (!res.ok) return
        const data = await res.json() as { playersWaiting: number; names: string[] }
        if (!inLobbyRef.current && data.playersWaiting > prevLobbyCount.current) {
          setLobbyNames(data.names)
        }
        prevLobbyCount.current = data.playersWaiting
      } catch { /* non-fatal */ }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [token])

  const runSubmittedRef = useRef(false)
  const runTokenRef = useRef<string | null>(null)

  async function startRunWithToken() {
    runTokenRef.current = null
    const authToken = useAuthStore.getState().token
    if (!authToken) return
    try {
      const res = await fetch('/api/runs/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) {
        const data = await res.json() as { token: string }
        runTokenRef.current = data.token
      }
    } catch { /* non-fatal — submitRun will fail gracefully without a token */ }
  }

  function submitRun() {
    if (runSubmittedRef.current) return
    const s = useGameStore.getState()
    const authToken = useAuthStore.getState().token
    if (!authToken || s.kills === 0) return  // skip empty runs
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
        runToken: runTokenRef.current,
        score,
        kills: s.kills,
        timeSurvived: timeMs,
        coins: s.sessionCoins,
        won: s.isWon,
        multiplayer: !!activeNetClient,
        bossKills: s.bossKills,
        level: s.level,
        damageDealt: s.damageDealt,
        weaponCount,
        tookDamage: s.tookDamageThisRun,
        finalHp: s.hp,
        maxHp: s.maxHp,
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

  // Submit run to leaderboard on death or win
  useEffect(() => {
    if (!inGame) return
    runSubmittedRef.current = false
    const unsub = useGameStore.subscribe(
      s => s.isDead || s.isWon,
      (ended) => { if (ended) submitRun() },
    )
    return unsub
  }, [inGame])

  function handlePlay() {
    setNetClient(null)
    clearRun()
    startRun()
    startRunWithToken()
    setInGame(true)
  }

  function handleMultiplayer() {
    setInLobby(true)
  }

  function handleLobbyReady(net: NetClient, _players: PlayerSnapshot[]) {
    setNetClient(net)
    startRun()
    startRunWithToken()
    setInLobby(false)
    setInGame(true)
  }

  function handleLobbyCancel() {
    setInLobby(false)
  }

  function handleQuit() {
    submitRun()
    soundSystem.stopMusic()
    setNetClient(null)
    useGameStore.getState().resetRun()
    setInGame(false)
  }

  function handlePlayAgain() {
    const wasMultiplayer = !!activeNetClient
    setNetClient(null)
    clearRun()
    runSubmittedRef.current = false
    runData.elapsed = 0
    if (wasMultiplayer) {
      useGameStore.getState().resetRun()
      setInGame(false)
      setInLobby(true)
    } else {
      startRun()
      startRunWithToken()
      setRunKey(k => k + 1)
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
