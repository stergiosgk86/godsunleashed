import { useEffect, useRef, useState } from 'react'
import { NetClient } from '../net/NetClient'
import { useAuthStore } from '../store/authStore'
import type { PlayerSnapshot } from '../net/protocol'

function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth <= 600)
  useEffect(() => {
    const fn = () => setMob(window.innerWidth <= 600)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mob
}

interface Props {
  characterType: string
  onReady: (net: NetClient, players: PlayerSnapshot[]) => void
  onCancel: () => void
}

const MAX_PLAYERS = 4

const BASE_URL = import.meta.env.VITE_SERVER_URL
  ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

function makeWsUrl(): string {
  const token = useAuthStore.getState().token ?? ''
  return `${BASE_URL}?token=${encodeURIComponent(token)}`
}

export function MultiplayerLobby({ characterType, onReady, onCancel }: Props) {
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'starting' | 'error'>('connecting')
  const [errorMsg, setErrorMsg] = useState('')
  const [playerCount, setPlayerCount] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const netRef = useRef<NetClient | null>(null)
  const mob = useIsMobile()

  useEffect(() => {
    // handedOff: true once onReady is called; prevents cleanup from closing an
    // already-transferred connection (the lobby unmounts right after onReady).
    let handedOff = false
    let net: NetClient
    try {
      net = new NetClient(makeWsUrl())
      netRef.current = net
    } catch {
      setStatus('error')
      setErrorMsg('Could not create connection.')
      return
    }

    net.onOpen(() => {
      net.send({ type: 'join', characterType, viewportW: window.innerWidth, viewportH: window.innerHeight })
    })

    net.on('waiting', (msg) => {
      setStatus('waiting')
      setPlayerCount(msg.playerCount)
      setIsHost(msg.isHost)
    })

    net.on('start', (msg) => {
      setStatus('starting')
      net.playerId = msg.yourId
      // Short delay so all clients see "Starting…" before the scene loads
      setTimeout(() => {
        handedOff = true
        onReady(net, msg.players)
      }, 1200)
    })

    net.on('playerLeft', () => {
      if (handedOff) return
      setStatus('error')
      setErrorMsg('A player disconnected.')
    })

    net.onClose((code, reason) => {
      console.log(`[Lobby] WebSocket closed — code=${code} reason="${reason}" handedOff=${handedOff}`)
      if (handedOff) return
      setStatus(s => {
        if (s !== 'starting') {
          const msg = code === 4001
            ? 'Authentication failed. Please log out and back in.'
            : code === 1006
              ? `Cannot reach server. Is it running?`
              : `Connection closed (code ${code}).`
          setErrorMsg(msg)
          return 'error'
        }
        return s
      })
    })

    return () => { if (!handedOff) net.close() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStartGame = () => {
    netRef.current?.send({ type: 'startGame' })
  }

  const canStart = isHost && playerCount >= 2 && status === 'waiting'

  const statusLine =
    status === 'connecting' ? 'Connecting to server…' :
    status === 'waiting'    ? (isHost ? 'Waiting for more players…' : 'Waiting for host to start…') :
    status === 'starting'   ? 'Game starting…' :
    `Error: ${errorMsg}`

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #0d0d22 0%, #07070f 100%)',
      padding: 16,
      boxSizing: 'border-box',
    }}>
      <div style={{
        color: '#cc3333', fontSize: mob ? 24 : 40, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: mob ? 4 : 10, textShadow: '0 0 30px #ff2222',
        marginBottom: mob ? 24 : 48, textAlign: 'center',
      }}>
        MULTIPLAYER
      </div>

      <div style={{
        background: '#0d0d1f',
        border: '2px solid #4444aa',
        borderRadius: 12,
        padding: mob ? '28px 24px' : '40px 60px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: mob ? 20 : 28,
        boxShadow: '0 0 40px #2222aa44',
        minWidth: mob ? undefined : 360,
        width: mob ? '100%' : undefined,
        maxWidth: mob ? 400 : undefined,
        boxSizing: 'border-box',
      }}>
        {status === 'error' ? (
          <div style={{ color: '#cc4444', fontFamily: 'monospace', fontSize: 14, textAlign: 'center' }}>
            {statusLine}
          </div>
        ) : (
          <>
            {/* Player slots */}
            {status === 'waiting' && (
              <div style={{ display: 'flex', gap: 10 }}>
                {Array.from({ length: MAX_PLAYERS }, (_, i) => (
                  <div key={i} style={{
                    width: 44, height: 44, borderRadius: 8,
                    border: `2px solid ${i < playerCount ? '#4466ff' : '#333355'}`,
                    background: i < playerCount ? 'rgba(68,102,255,0.18)' : 'rgba(20,20,50,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s',
                  }}>
                    <span style={{
                      color: i < playerCount ? '#88aaff' : '#33335a',
                      fontSize: 20,
                    }}>
                      {i < playerCount ? '⚔' : '○'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Spinner dots (connecting / starting) */}
            {status !== 'waiting' && (
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: '#4444cc',
                    animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            )}

            {/* Player count */}
            {status === 'waiting' && (
              <div style={{ color: '#6688cc', fontFamily: 'monospace', fontSize: 13, letterSpacing: 2 }}>
                {playerCount} / {MAX_PLAYERS} PLAYERS
              </div>
            )}

            <div style={{
              color: status === 'starting' ? '#44ff88' : '#aaaaff',
              fontFamily: 'monospace', fontSize: 15, letterSpacing: 2, textAlign: 'center',
            }}>
              {statusLine}
            </div>

            {/* Start button — host only, needs ≥2 players */}
            {canStart && (
              <button
                onClick={handleStartGame}
                style={{
                  padding: '12px 40px',
                  background: 'rgba(30,80,30,0.6)',
                  border: '2px solid #44aa44',
                  borderRadius: 8,
                  color: '#88ff88',
                  fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold',
                  cursor: 'pointer', letterSpacing: 3,
                  textShadow: '0 0 8px #44ff44',
                  boxShadow: '0 0 16px rgba(68,200,68,0.2)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(40,110,40,0.8)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(30,80,30,0.6)')}
              >
                START GAME
              </button>
            )}
          </>
        )}

        <button
          onClick={onCancel}
          style={{
            padding: '10px 32px',
            background: 'transparent',
            border: '2px solid #441111',
            borderRadius: 8,
            color: '#aa4444',
            fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold',
            cursor: 'pointer', letterSpacing: 2,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1a0808')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          CANCEL
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
