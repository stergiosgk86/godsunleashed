import { useState } from 'react'
import { soundSystem, MUSIC_TRACKS } from '../game/SoundSystem'

const btnBase: React.CSSProperties = {
  width: '100%', padding: '12px 0',
  fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
  border: '2px solid #4444cc', borderRadius: 8,
  cursor: 'pointer', letterSpacing: 2,
}

export function SoundsView({ onBack }: { onBack: () => void }) {
  const [muted, setMuted] = useState(() => soundSystem.muted)
  const [musicVol, setMusicVol] = useState(() => soundSystem.musicVolume)
  const [gameTrackId, setGameTrackId] = useState(() => soundSystem.gameTrackId)

  function handleMute() {
    soundSystem.toggleMute()
    setMuted(soundSystem.muted)
  }

  function handleMusicVol(delta: number) {
    const next = Math.round((soundSystem.musicVolume + delta) * 10) / 10
    soundSystem.setMusicVolume(next)
    setMusicVol(soundSystem.musicVolume)
  }

  function handleTrackChange(dir: -1 | 1) {
    const idx = MUSIC_TRACKS.findIndex(t => t.id === gameTrackId)
    const next = MUSIC_TRACKS[(idx + dir + MUSIC_TRACKS.length) % MUSIC_TRACKS.length]
    soundSystem.setGameTrackId(next.id)
    setGameTrackId(next.id)
    soundSystem.startMusic()
  }

  const currentTrack = MUSIC_TRACKS.find(t => t.id === gameTrackId) ?? MUSIC_TRACKS[0]

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

      {/* Music volume */}
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

      {/* In-game track picker */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ color: '#8888aa', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>
          IN-GAME MUSIC
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => handleTrackChange(-1)}
            style={{ ...btnBase, width: 36, minWidth: 36, padding: '8px 0', color: '#aaaaff', background: 'transparent', boxShadow: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >‹</button>
          <div style={{
            flex: 1, textAlign: 'center',
            color: '#ccccff', fontFamily: 'monospace', fontSize: 12, letterSpacing: 1,
            background: '#0d0d22', border: '1px solid #333366', borderRadius: 6, padding: '8px 4px',
          }}>
            {currentTrack.label}
          </div>
          <button
            onClick={() => handleTrackChange(1)}
            style={{ ...btnBase, width: 36, minWidth: 36, padding: '8px 0', color: '#aaaaff', background: 'transparent', boxShadow: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >›</button>
        </div>
        <span style={{ color: '#444466', fontFamily: 'monospace', fontSize: 10, textAlign: 'center' }}>
          {MUSIC_TRACKS.findIndex(t => t.id === gameTrackId) + 1} / {MUSIC_TRACKS.length}
        </span>
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
