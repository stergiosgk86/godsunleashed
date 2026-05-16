import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'
import { runData, RUN_DURATION } from '../game/runData'

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const btnBase: React.CSSProperties = {
  width: '100%', padding: '12px 0',
  fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
  border: '2px solid', borderRadius: 8,
  cursor: 'pointer', letterSpacing: 2,
}

export function WinScreen({ onPlayAgain, onMainMenu }: {
  onPlayAgain: () => void
  onMainMenu: () => void
}) {
  const isWon = useGameStore(s => s.isWon)
  const sessionCoins = useGameStore(s => s.sessionCoins)
  const level = useGameStore(s => s.level)
  const depositCoins = useProfileStore(s => s.depositCoins)

  useEffect(() => {
    if (isWon) depositCoins(sessionCoins)
  }, [isWon])

  if (!isWon) return null

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.80)',
      zIndex: 60,
    }}>
      <div style={{
        background: '#0d0d1f',
        border: '2px solid #886600',
        borderRadius: 12,
        padding: '40px 60px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        boxShadow: '0 0 80px #aa880044',
        minWidth: 340,
      }}>
        <div style={{
          color: '#ffcc00', fontSize: 36, fontFamily: 'monospace', fontWeight: 'bold',
          letterSpacing: 4, textShadow: '0 0 20px #ffaa00, 0 0 40px #884400',
        }}>
          YOU SURVIVED
        </div>

        <div style={{ color: '#886633', fontFamily: 'monospace', fontSize: 13, letterSpacing: 3 }}>
          THE NIGHT HAS ENDED
        </div>

        <div style={{ width: '100%', height: 1, background: '#2a2010' }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ color: '#666688', fontFamily: 'monospace', fontSize: 13 }}>TIME SURVIVED</span>
            <span style={{ color: '#aaaaff', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold' }}>
              {fmt(RUN_DURATION)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ color: '#666688', fontFamily: 'monospace', fontSize: 13 }}>LEVEL REACHED</span>
            <span style={{ color: '#aaaaff', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold' }}>
              {level}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ color: '#666688', fontFamily: 'monospace', fontSize: 13 }}>COINS EARNED</span>
            <span style={{ color: '#ffcc33', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold' }}>
              ◈ {sessionCoins}
            </span>
          </div>
          <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 11 }}>
            coins saved to your profile
          </div>
        </div>

        <div style={{ width: '100%', height: 1, background: '#2a2010' }} />

        <button
          onClick={onPlayAgain}
          style={{
            ...btnBase,
            color: '#ffffff', background: '#664400',
            borderColor: '#ffaa00',
            boxShadow: '0 0 16px #88440066',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#885500')}
          onMouseLeave={e => (e.currentTarget.style.background = '#664400')}
        >
          PLAY AGAIN
        </button>

        <button
          onClick={onMainMenu}
          style={{ ...btnBase, color: '#888899', background: 'transparent', borderColor: '#2a2a44' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#111122')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          MAIN MENU
        </button>
      </div>
    </div>
  )
}
