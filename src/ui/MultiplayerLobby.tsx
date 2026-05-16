import { useEffect, useState } from 'react'
import { NetClient } from '../net/NetClient'
import type { PlayerSnapshot } from '../net/protocol'

interface Props {
  characterType: string
  onReady: (net: NetClient, players: PlayerSnapshot[]) => void
  onCancel: () => void
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:4000'

export function MultiplayerLobby({ characterType, onReady, onCancel }: Props) {
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'starting' | 'error'>('connecting')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let net: NetClient
    try {
      net = new NetClient(SERVER_URL)
    } catch {
      setStatus('error')
      setErrorMsg('Could not create connection.')
      return
    }

    net.onOpen(() => {
      net.send({ type: 'join', characterType })
    })

    net.on('waiting', () => setStatus('waiting'))

    net.on('start', (msg) => {
      setStatus('starting')
      net.playerId = msg.yourId
      // Short delay so both clients see "Starting…" before the scene loads
      setTimeout(() => onReady(net, msg.players), 1200)
    })

    net.on('playerLeft', () => {
      setStatus('error')
      setErrorMsg('The other player disconnected.')
    })

    net.onClose(() => {
      setStatus(s => {
        if (s !== 'starting') { setErrorMsg('Connection closed.'); return 'error' }
        return s
      })
    })

    return () => { net.close() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const label =
    status === 'connecting' ? 'Connecting to server…' :
    status === 'waiting'    ? 'Waiting for opponent…' :
    status === 'starting'   ? 'Both players ready! Starting…' :
    `Error: ${errorMsg}`

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #0d0d22 0%, #07070f 100%)',
    }}>
      <div style={{
        color: '#cc3333', fontSize: 40, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 10, textShadow: '0 0 30px #ff2222',
        marginBottom: 48,
      }}>
        MULTIPLAYER
      </div>

      <div style={{
        background: '#0d0d1f',
        border: '2px solid #4444aa',
        borderRadius: 12,
        padding: '40px 60px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
        boxShadow: '0 0 40px #2222aa44',
        minWidth: 360,
      }}>
        {status === 'error' ? (
          <div style={{ color: '#cc4444', fontFamily: 'monospace', fontSize: 14, textAlign: 'center' }}>
            {label}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#4444cc',
                  animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                }} />
              ))}
            </div>
            <div style={{
              color: status === 'starting' ? '#44ff88' : '#aaaaff',
              fontFamily: 'monospace', fontSize: 15, letterSpacing: 2, textAlign: 'center',
            }}>
              {label}
            </div>
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
