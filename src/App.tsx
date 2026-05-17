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
import { useProfileStore } from './store/profileStore'
import { useAuthStore } from './store/authStore'
import { useCharacterStore } from './store/characterStore'
import { clearRun } from './game/runSave'
import { CHARACTER_DEFS } from './game/characters'
import { setNetClient, activeNetClient } from './net/netState'
import { runData } from './game/runData'
import { AchievementToast } from './ui/AchievementToast'
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
      scene: [PreloadScene, MainScene],
      parent: containerRef.current ?? undefined,
    }

    const game = new Phaser.Game(config)
    return () => game.destroy(true)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
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
  const initRef = useRef(false)

  const token = useAuthStore(s => s.token)
  const setAuth = useAuthStore(s => s.setAuth)
  const fetchProfile = useProfileStore(s => s.fetchProfile)

  function startRun() {
    const { upgrades } = useProfileStore.getState()
    const char = CHARACTER_DEFS[useCharacterStore.getState().selectedCharacter]

    useGameStore.getState().resetRun()

    const startMaxHp = Math.max(50, Math.floor(100 * (1 + upgrades.maxHealth * 0.1)) + char.bonusMaxHp)

    useGameStore.setState({
      might:          (1.0 + upgrades.might * 0.05) * char.mightMult,
      maxHp:          startMaxHp,
      hp:             startMaxHp,
      hpRegen:        (upgrades.recovery ?? 0) * 0.1 + char.bonusHpRegen,
      moveSpeed:      Math.floor((200 + char.bonusMoveSpeed) * (1 + (upgrades.moveSpeed ?? 0) * 0.02)),
      attackInterval: Math.max(100, Math.floor(600 * char.attackIntervalMult)),
      dashCooldown:   Math.max(400, Math.floor(DASH_COOLDOWN_MS * char.dashCooldownMult)),
      dashDistance:   1 + char.bonusDashDistance,
      aura:           char.startAura,
      lifeDrain:      char.lifeDrain,
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
      if (currentToken) {
        await fetchProfile()
        // Restore singleplayer session after page reload
        if (sessionStorage.getItem('gods_screen') === 'game') {
          startRun()
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

  // Submit run to leaderboard when game ends (once per run)
  useEffect(() => {
    if (!inGame) return
    let submitted = false
    const unsub = useGameStore.subscribe(
      s => s.isDead || s.isWon,
      (ended) => {
        if (!ended || submitted) return
        submitted = true
        const s = useGameStore.getState()
        const token = useAuthStore.getState().token
        if (!token) return
        const timeMs = runData.elapsed
        const score = s.kills * 10 + s.sessionCoins * 5 + Math.floor(timeMs / 1000) * 2 + (s.isWon ? 5000 : 0)
        fetch('/api/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            score,
            kills: s.kills,
            timeSurvived: timeMs,
            coins: s.sessionCoins,
            won: s.isWon,
            multiplayer: !!activeNetClient,
          }),
        }).catch(() => { /* non-fatal */ })
      },
    )
    return unsub
  }, [inGame])

  function handlePlay() {
    setNetClient(null)
    clearRun()
    startRun()
    setInGame(true)
  }

  function handleMultiplayer() {
    setInLobby(true)
  }

  function handleLobbyReady(net: NetClient, _players: PlayerSnapshot[]) {
    setNetClient(net)
    startRun()
    setInLobby(false)
    setInGame(true)
  }

  function handleLobbyCancel() {
    setInLobby(false)
  }

  function handleQuit() {
    setNetClient(null)
    useGameStore.getState().resetRun()
    setInGame(false)
  }

  function handlePlayAgain() {
    setNetClient(null)
    clearRun()
    startRun()
    setRunKey(k => k + 1)
  }

  function handleLogout() {
    useAuthStore.getState().clearAuth()
    useProfileStore.getState().reset()
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

  if (!inGame) {
    return <MainMenu onPlay={handlePlay} onMultiplayer={handleMultiplayer} onLogout={handleLogout} />
  }

  return <GameView key={runKey} onQuit={handleQuit} onPlayAgain={handlePlayAgain} />
}

export default App
