import { useState, useEffect } from 'react'
import { useGameStore, weaponBaseDamage } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'
import { useAuthStore } from '../store/authStore'
import { CONTROLS } from '../game/controls'
import { soundSystem } from '../game/SoundSystem'

const btnBase: React.CSSProperties = {
  width: '100%',
  padding: '12px 0',
  fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
  border: '2px solid #4444cc', borderRadius: 8,
  cursor: 'pointer', letterSpacing: 2,
}

function Key({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      background: '#1a1a3a',
      border: '1px solid #4444aa',
      borderRadius: 4,
      color: '#ccccff',
      fontSize: 12,
      fontFamily: 'monospace',
    }}>
      {label}
    </span>
  )
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, width: '100%' }}>
      <span style={{ color: '#8888aa', fontSize: 13, fontFamily: 'monospace' }}>{label}</span>
      <span style={{ color: '#ccccff', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' }}>{value}</span>
    </div>
  )
}

function StatsView() {
  const s = useGameStore(s => s)
  const dashCooldownSec = (s.dashCooldown / 1000).toFixed(1)
  const attacksPerSec = (1000 / s.attackInterval).toFixed(2)
  const dashDistMult = s.dashDistance.toFixed(1)
  const baseDmg = weaponBaseDamage(s.level)
  const finalDmg = Math.floor(baseDmg * s.might)

  return (
    <>
      <div style={{
        color: '#aaaaff', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 3, textShadow: '0 0 10px #4444ff',
      }}>
        STATS
      </div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StatRow label="Level" value={s.level} />
        <StatRow label="HP" value={`${s.hp} / ${s.maxHp}`} />
        <StatRow label="Base DMG" value={baseDmg} />
        <StatRow label="Might" value={`${s.might.toFixed(2)}x`} />
        <StatRow label="Final DMG" value={finalDmg} />
        <StatRow label="Attack Speed" value={`${attacksPerSec}/s`} />
        <StatRow label="Move Speed" value={s.moveSpeed} />
        <StatRow label="Dash Cooldown" value={`${dashCooldownSec}s`} />
        <StatRow label="Dash Distance" value={`${dashDistMult}x`} />
        <StatRow label="Multi Shot" value={s.multiShot > 0 ? `+${s.multiShot}` : '—'} />
        <StatRow label="Piercing" value={s.piercing ? 'Yes' : '—'} />
        <StatRow label="Aura" value={s.aura > 0 ? `Lv ${s.aura}` : '—'} />
        <StatRow label="Spirit Orbs" value={s.orbital > 0 ? `${s.orbital}` : '—'} />
      </div>
    </>
  )
}

function AdminPanel({ onBack }: { onBack: () => void }) {
  const adminInvincible = useGameStore(s => s.adminInvincible)
  const setAdminInvincible = useGameStore(s => s.setAdminInvincible)

  const toggleStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '10px 14px',
    background: '#0a0a1a', border: '1px solid #333366',
    borderRadius: 6, cursor: 'pointer',
  }

  return (
    <>
      <div style={{
        color: '#ff4444', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 3, textShadow: '0 0 10px #ff2222',
      }}>
        ADMIN PANEL
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={toggleStyle} onClick={() => setAdminInvincible(!adminInvincible)}>
          <span style={{ color: '#ccccff', fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 }}>
            INVINCIBLE
          </span>
          <span style={{
            color: adminInvincible ? '#44ff44' : '#666688',
            fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold',
          }}>
            {adminInvincible ? 'ON' : 'OFF'}
          </span>
        </div>
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

export function PauseMenu({ onQuit }: { onQuit: () => void }) {
  const isPaused = useGameStore(s => s.isPaused)
  const togglePause = useGameStore(s => s.togglePause)
  const depositCoins = useProfileStore(s => s.depositCoins)
  const role = useAuthStore(s => s.role)
  const isSuperAdmin = role === 'super_admin'
  const [view, setView] = useState<'main' | 'controls' | 'stats' | 'sounds' | 'admin'>('main')
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

  function handleQuit() {
    const { sessionCoins, resetRun } = useGameStore.getState()
    depositCoins(sessionCoins)
    resetRun()
    onQuit()
  }

  useEffect(() => { if (!isPaused) setView('main') }, [isPaused])

  if (!isPaused) return null

  const panel = (
    <div style={{
      background: '#0d0d1f',
      border: '2px solid #4444aa',
      borderRadius: 12,
      padding: '40px 60px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      boxShadow: '0 0 40px #2222aa88',
      minWidth: 320,
    }}>
      {view === 'main' ? (
        <>
          <div style={{
            color: '#aaaaff', fontSize: 32, fontFamily: 'monospace', fontWeight: 'bold',
            letterSpacing: 4, textShadow: '0 0 12px #4444ff',
          }}>
            PAUSED
          </div>

          <button
            onClick={togglePause}
            style={{ ...btnBase, color: '#ffffff', background: '#2222aa', boxShadow: '0 0 12px #2222aa' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#3333cc')}
            onMouseLeave={e => (e.currentTarget.style.background = '#2222aa')}
          >
            RESUME
          </button>

          <button
            onClick={() => setView('stats')}
            style={{ ...btnBase, color: '#aaaaff', background: 'transparent', boxShadow: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            STATS
          </button>

          <button
            onClick={() => setView('controls')}
            style={{ ...btnBase, color: '#aaaaff', background: 'transparent', boxShadow: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            CONTROLS
          </button>

          <button
            onClick={() => setView('sounds')}
            style={{ ...btnBase, color: '#aaaaff', background: 'transparent', boxShadow: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            SOUNDS
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setView('admin')}
              style={{ ...btnBase, color: '#ff6666', background: 'transparent', boxShadow: 'none', borderColor: '#661111' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1a0808')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              ADMIN PANEL
            </button>
          )}

          <div style={{ width: '100%', height: 1, background: '#1a1a3a' }} />

          <button
            onClick={handleQuit}
            style={{ ...btnBase, color: '#aa4444', background: 'transparent', boxShadow: 'none', borderColor: '#441111' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#1a0808'
              e.currentTarget.style.borderColor = '#882222'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#441111'
            }}
          >
            QUIT TO MENU
          </button>
        </>
      ) : view === 'admin' ? (
        <AdminPanel onBack={() => setView('main')} />
      ) : view === 'stats' ? (
        <>
          <StatsView />
          <button
            onClick={() => setView('main')}
            style={{ ...btnBase, color: '#aaaaff', background: 'transparent', boxShadow: 'none', marginTop: 8 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            ← BACK
          </button>
        </>
      ) : view === 'sounds' ? (
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
            onClick={() => setView('main')}
            style={{ ...btnBase, color: '#aaaaff', background: 'transparent', boxShadow: 'none', marginTop: 8 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            ← BACK
          </button>
        </>
      ) : (
        <>
          <div style={{
            color: '#aaaaff', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
            letterSpacing: 3, textShadow: '0 0 10px #4444ff',
          }}>
            CONTROLS
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {CONTROLS.map(({ keys, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {keys.map(k => <Key key={k} label={k} />)}
                </div>
                <span style={{ color: '#8888aa', fontSize: 13, fontFamily: 'monospace' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setView('main')}
            style={{ ...btnBase, color: '#aaaaff', background: 'transparent', boxShadow: 'none', marginTop: 8 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            ← BACK
          </button>
        </>
      )}
    </div>
  )

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        zIndex: 50,
      }}
      onClick={e => { if (e.target === e.currentTarget) { setView('main'); togglePause() } }}
    >
      {panel}
    </div>
  )
}
