import { useState } from 'react'
import { soundSystem } from '../game/SoundSystem'

const btnBase: React.CSSProperties = {
  width: '100%', padding: '12px 0',
  fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
  border: '2px solid #4444cc', borderRadius: 8,
  cursor: 'pointer', letterSpacing: 2,
}

export function SoundsView({ onBack }: { onBack: () => void }) {
  const [muted, setMuted] = useState(() => soundSystem.muted)
  const [musicVol, setMusicVol] = useState(() => soundSystem.musicVolume)

  function handleMute() {
    soundSystem.toggleMute()
    setMuted(soundSystem.muted)
  }

  function handleMusicVol(delta: number) {
    const next = Math.round((soundSystem.musicVolume + delta) * 10) / 10
    soundSystem.setMusicVolume(next)
    setMusicVol(soundSystem.musicVolume)
  }

  return (
    <>
      <div style={{
        color: '#aaaaff', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 3, textShadow: '0 0 10px #4444ff',
      }}>
        SOUNDS
      </div>

      <button
        onClick={handleMute}
        style={{ ...btnBase, color: '#aaaaff', background: 'transparent', boxShadow: 'none' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {muted ? 'SOUND: OFF' : 'SOUND: ON'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#aaaaff', fontFamily: 'monospace', fontSize: 14, letterSpacing: 2, minWidth: 60 }}>
          MUSIC
        </span>
        <button
          onClick={() => handleMusicVol(-0.1)}
          disabled={musicVol <= 0}
          style={{ ...btnBase, width: 36, minWidth: 36, padding: '8px 0', color: '#aaaaff', background: 'transparent', boxShadow: 'none', opacity: musicVol <= 0 ? 0.3 : 1 }}
          onMouseEnter={e => { if (musicVol > 0) e.currentTarget.style.background = '#111133' }}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >−</button>
        <span style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: 14, minWidth: 38, textAlign: 'center' }}>
          {Math.round(musicVol * 100)}%
        </span>
        <button
          onClick={() => handleMusicVol(0.1)}
          disabled={musicVol >= 1}
          style={{ ...btnBase, width: 36, minWidth: 36, padding: '8px 0', color: '#aaaaff', background: 'transparent', boxShadow: 'none', opacity: musicVol >= 1 ? 0.3 : 1 }}
          onMouseEnter={e => { if (musicVol < 1) e.currentTarget.style.background = '#111133' }}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >+</button>
      </div>

      <button
        onClick={onBack}
        style={{ ...btnBase, color: '#aaaaff', background: 'transparent', boxShadow: 'none', marginTop: 8 }}
        onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        ← BACK
      </button>
    </>
  )
}
