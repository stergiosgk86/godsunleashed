import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'

function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth <= 600)
  useEffect(() => {
    const fn = () => setMob(window.innerWidth <= 600)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mob
}

const btnBase: React.CSSProperties = {
  width: '100%', padding: '12px 0',
  fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
  border: '2px solid', borderRadius: 8,
  cursor: 'pointer', letterSpacing: 2,
}

export function DeathScreen({ onPlayAgain, onMainMenu }: {
  onPlayAgain: () => void
  onMainMenu: () => void
}) {
  const isDead = useGameStore(s => s.isDead)
  const sessionCoins = useGameStore(s => s.sessionCoins)
  const depositCoins = useProfileStore(s => s.depositCoins)
  const mob = useIsMobile()

  // Deposit coins into profile as soon as the death screen appears
  useEffect(() => {
    if (isDead) depositCoins(sessionCoins)
  }, [isDead])

  if (!isDead) return null

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.75)',
      zIndex: 60,
      padding: 16,
      boxSizing: 'border-box',
    }}>
      <div style={{
        background: '#0d0d1f',
        border: '2px solid #661111',
        borderRadius: 12,
        padding: mob ? '28px 24px' : '40px 60px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        boxShadow: '0 0 60px #44000088',
        width: mob ? '100%' : undefined,
        maxWidth: mob ? 380 : undefined,
        minWidth: mob ? undefined : 320,
        boxSizing: 'border-box',
      }}>
        <div style={{
          color: '#cc2222', fontSize: mob ? 28 : 36, fontFamily: 'monospace', fontWeight: 'bold',
          letterSpacing: mob ? 3 : 4, textShadow: '0 0 20px #ff0000',
        }}>
          YOU DIED
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <div style={{ color: '#666688', fontFamily: 'monospace', fontSize: 12, letterSpacing: 2 }}>
            COINS EARNED
          </div>
          <div style={{
            color: '#ffcc33', fontSize: 28, fontFamily: 'monospace', fontWeight: 'bold',
            textShadow: '0 0 12px #aa7700',
          }}>
            ◈ {sessionCoins}
          </div>
          <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 11 }}>
            saved to your profile
          </div>
        </div>

        <div style={{ width: '100%', height: 1, background: '#2a1a1a' }} />

        <button
          onClick={onPlayAgain}
          style={{
            ...btnBase,
            color: '#ffffff', background: '#2222aa',
            borderColor: '#4444cc',
            boxShadow: '0 0 12px #2222aa',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#3333cc')}
          onMouseLeave={e => (e.currentTarget.style.background = '#2222aa')}
        >
          PLAY AGAIN
        </button>

        <button
          onClick={onMainMenu}
          style={{
            ...btnBase,
            color: '#888899', background: 'transparent',
            borderColor: '#2a2a44',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#111122')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          MAIN MENU
        </button>
      </div>
    </div>
  )
}
