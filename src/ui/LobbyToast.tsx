import { useEffect, useState } from 'react'

interface Props {
  names: string[]
  onDismiss: () => void
  onJoin: () => void
}

export function LobbyToast({ names, onDismiss, onJoin }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
    const t = window.setTimeout(() => {
      setVisible(false)
      window.setTimeout(onDismiss, 400)
    }, 6000)
    return () => clearTimeout(t)
  }, [])

  const label = names.length === 1
    ? `${names[0]} is waiting in the lobby!`
    : `${names.join(', ')} are waiting in the lobby!`

  return (
    <div style={{
      position: 'fixed', top: 24, right: 24,
      transform: `translateY(${visible ? 0 : -80}px)`,
      opacity: visible ? 1 : 0,
      transition: 'transform 0.35s ease, opacity 0.35s ease',
      zIndex: 2000,
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #2a1a0a 0%, #1a0d00 100%)',
        border: '2px solid #cc8800',
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 8,
        boxShadow: '0 0 30px rgba(200,136,0,0.4), 0 4px 20px rgba(0,0,0,0.6)',
        maxWidth: 280,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{
              color: '#cc9900', fontFamily: 'monospace', fontSize: 9,
              letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4,
            }}>
              Lobby
            </div>
            <div style={{
              color: '#ffe8aa', fontFamily: 'monospace', fontSize: 13,
              fontWeight: 'bold', lineHeight: 1.4,
            }}>
              {label}
            </div>
          </div>
          <button
            onClick={() => { setVisible(false); setTimeout(onDismiss, 400) }}
            style={{
              background: 'none', border: 'none', color: '#886633',
              cursor: 'pointer', fontSize: 16, lineHeight: 1,
              padding: 0, flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
        <button
          onClick={onJoin}
          style={{
            background: 'linear-gradient(135deg, #cc8800, #aa6600)',
            border: 'none', borderRadius: 6, color: '#fff',
            fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold',
            padding: '6px 12px', cursor: 'pointer', letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Join Lobby
        </button>
      </div>
    </div>
  )
}
