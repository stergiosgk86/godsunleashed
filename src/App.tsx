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
import { useGameStore, DASH_COOLDOWN_MS } from './store/gameStore'
import { useProfileStore } from './store/profileStore'
import { useCharacterStore } from './store/characterStore'
import { CHARACTER_DEFS } from './game/characters'
import { setNetClient } from './net/netState'
import type { NetClient } from './net/NetClient'
import type { PlayerSnapshot } from './net/protocol'

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
    </div>
  )
}

function App() {
  const [inGame, setInGame] = useState(false)
  const [inLobby, setInLobby] = useState(false)
  const [runKey, setRunKey] = useState(0)
  const activeProfileId = useProfileStore(s => s.activeProfileId)

  function startRun() {
    const { profiles, activeProfileId } = useProfileStore.getState()
    const upgrades = profiles.find(p => p.id === activeProfileId)?.upgrades
      ?? { maxHealth: 0, recovery: 0, magnet: 0, might: 0, luck: 0 }
    const char = CHARACTER_DEFS[useCharacterStore.getState().selectedCharacter]

    useGameStore.getState().resetRun()

    const startMaxHp = Math.max(50, Math.floor(100 * (1 + upgrades.maxHealth * 0.1)) + char.bonusMaxHp)

    useGameStore.setState({
      might:         (1.0 + upgrades.might * 0.05) * char.mightMult,
      maxHp:         startMaxHp,
      hp:            startMaxHp,
      hpRegen:       upgrades.recovery * 0.1 + char.bonusHpRegen,
      moveSpeed:     200 + char.bonusMoveSpeed,
      attackInterval: Math.max(100, Math.floor(600 * char.attackIntervalMult)),
      dashCooldown:  Math.max(400, Math.floor(DASH_COOLDOWN_MS * char.dashCooldownMult)),
      dashDistance:  1 + char.bonusDashDistance,
      aura:          char.startAura,
      lifeDrain:     char.lifeDrain,
    })
  }

  function handlePlay() {
    setNetClient(null)
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
    startRun()
    setRunKey(k => k + 1)
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

  if (!inGame || !activeProfileId) {
    return <MainMenu onPlay={handlePlay} onMultiplayer={handleMultiplayer} />
  }

  return <GameView key={runKey} onQuit={handleQuit} onPlayAgain={handlePlayAgain} />
}

export default App
