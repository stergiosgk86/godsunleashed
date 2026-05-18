import { useState, useEffect } from 'react'
import {
  useKeyBindingsStore,
  type BindableAction,
  keyCodeLabel,
  isAllowedKeyCode,
  DEFAULT_BINDINGS,
} from '../store/keyBindingsStore'

const btnBase: React.CSSProperties = {
  width: '100%', padding: '12px 0',
  fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
  border: '2px solid #4444cc', borderRadius: 8,
  cursor: 'pointer', letterSpacing: 2,
}

function Key({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px',
      background: '#1a1a3a', border: '1px solid #4444aa',
      borderRadius: 4, color: '#ccccff', fontSize: 12, fontFamily: 'monospace',
    }}>
      {label}
    </span>
  )
}

const REBINDABLE: { action: BindableAction; label: string }[] = [
  { action: 'up',    label: 'Move Up' },
  { action: 'down',  label: 'Move Down' },
  { action: 'left',  label: 'Move Left' },
  { action: 'right', label: 'Move Right' },
  { action: 'dash',  label: 'Dash' },
]

export function ControlsView({ onBack }: { onBack: () => void }) {
  const bindings = useKeyBindingsStore()
  const setBinding = useKeyBindingsStore(s => s.setBinding)
  const reset = useKeyBindingsStore(s => s.reset)
  const [listening, setListening] = useState<BindableAction | null>(null)

  useEffect(() => {
    if (!listening) return
    function onKey(e: KeyboardEvent) {
      e.preventDefault()
      if (e.keyCode === 27) { setListening(null); return }
      if (!isAllowedKeyCode(e.keyCode)) return
      setBinding(listening!, e.keyCode)
      setListening(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listening, setBinding])

  return (
    <>
      <div style={{
        color: '#aaaaff', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 3, textShadow: '0 0 10px #4444ff',
      }}>
        CONTROLS
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {REBINDABLE.map(({ action, label }) => {
          const isActive = listening === action
          const isDefault = bindings[action] === DEFAULT_BINDINGS[action]
          return (
            <div key={action} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            }}>
              <span style={{ color: '#8888aa', fontSize: 13, fontFamily: 'monospace', minWidth: 80 }}>
                {label}
              </span>
              <button
                onClick={() => setListening(isActive ? null : action)}
                style={{
                  padding: '4px 12px',
                  background: isActive ? '#333300' : '#1a1a3a',
                  border: `1px solid ${isActive ? '#aaaa00' : '#4444aa'}`,
                  borderRadius: 4,
                  color: isActive ? '#ffff66' : (isDefault ? '#ccccff' : '#66ffcc'),
                  fontSize: 13, fontFamily: 'monospace', cursor: 'pointer',
                  minWidth: 72, textAlign: 'center',
                  animation: isActive ? 'pulse 0.8s ease-in-out infinite' : undefined,
                }}
              >
                {isActive ? '...' : keyCodeLabel(bindings[action])}
              </button>
            </div>
          )
        })}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          marginTop: 4, paddingTop: 8, borderTop: '1px solid #1a1a3a',
        }}>
          <span style={{ color: '#666688', fontSize: 13, fontFamily: 'monospace', minWidth: 80 }}>
            Move (alt)
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {['↑', '←', '↓', '→'].map(k => <Key key={k} label={k} />)}
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <span style={{ color: '#666688', fontSize: 13, fontFamily: 'monospace', minWidth: 80 }}>
            Pause
          </span>
          <Key label="ESC" />
        </div>
      </div>

      {listening && (
        <div style={{ color: '#ffff66', fontSize: 12, fontFamily: 'monospace', textAlign: 'center' }}>
          Press any key — ESC to cancel
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <button
          onClick={reset}
          style={{ ...btnBase, flex: 1, color: '#888888', background: 'transparent', boxShadow: 'none', borderColor: '#333355', fontSize: 12 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0d0d20')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          RESET
        </button>
        <button
          onClick={onBack}
          style={{ ...btnBase, flex: 2, color: '#aaaaff', background: 'transparent', boxShadow: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          ← BACK
        </button>
      </div>
    </>
  )
}
