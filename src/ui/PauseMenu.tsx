import { useState, useEffect } from 'react'

function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth <= 768)
  useEffect(() => {
    const fn = () => setMob(window.innerWidth <= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mob
}
import { useGameStore, weaponBaseDamage, type AdminSpawnEntity } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'
import { useAuthStore } from '../store/authStore'
import { AdminPlayersView } from './AdminPlayersView'
import { ControlsView } from './ControlsView'
import { SoundsView } from './SoundsView'

const btnBase: React.CSSProperties = {
  width: '100%',
  padding: '12px 0',
  fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
  border: '2px solid #4444cc', borderRadius: 8,
  cursor: 'pointer', letterSpacing: 2,
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
        <StatRow label="Armor" value={s.armor > 0 ? `-${s.armor} dmg` : '—'} />
        <StatRow label="Multi Shot" value={s.multiShot > 0 ? `+${s.multiShot}` : '—'} />
        <StatRow label="Piercing" value={s.piercing ? 'Yes' : '—'} />
        <StatRow label="Aura" value={s.aura > 0 ? `Lv ${s.aura}` : '—'} />
        <StatRow label="Spirit Orbs" value={s.orbital > 0 ? `${s.orbital}` : '—'} />
      </div>
    </>
  )
}

const SPAWN_GROUPS: { label: string; color: string; items: { label: string; entity: AdminSpawnEntity }[] }[] = [
  {
    label: 'ENEMIES', color: '#ff8844',
    items: [
      { label: 'Basic',       entity: 'basic' },
      { label: 'Speeder',     entity: 'speeder' },
      { label: 'Tank',        entity: 'tank' },
      { label: 'Ranged',      entity: 'ranged' },
      { label: 'Exploder',    entity: 'exploder' },
      { label: 'Ghost',       entity: 'ghost' },
      { label: 'Charger',     entity: 'charger' },
      { label: 'Necromancer', entity: 'necromancer' },
    ],
  },
  {
    label: 'BOSSES', color: '#ff4444',
    items: [
      { label: 'Summoner', entity: 'summoner' },
      { label: 'Boss',     entity: 'boss' },
      { label: 'Final Boss', entity: 'finalBoss' },
    ],
  },
  {
    label: 'ITEMS', color: '#44ff88',
    items: [
      { label: 'Potion', entity: 'potion' },
      { label: 'XP Orb', entity: 'xporb' },
      { label: 'Coin',   entity: 'coin' },
    ],
  },
]

function AdminPanel({ onBack }: { onBack: () => void }) {
  const adminInvincible = useGameStore(s => s.adminInvincible)
  const setAdminInvincible = useGameStore(s => s.setAdminInvincible)
  const requestAdminSpawn = useGameStore(s => s.requestAdminSpawn)
  const [subView, setSubView] = useState<'main' | 'players' | 'spawn'>('main')

  const toggleStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '10px 14px',
    background: '#0a0a1a', border: '1px solid #333366',
    borderRadius: 6, cursor: 'pointer',
  }

  if (subView === 'players') {
    return <AdminPlayersView onBack={() => setSubView('main')} />
  }

  if (subView === 'spawn') {
    return (
      <>
        <div style={{
          color: '#ff4444', fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
          letterSpacing: 3, textShadow: '0 0 10px #ff2222',
        }}>
          SPAWN
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '60vh' }}>
          {SPAWN_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{ color: group.color, fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>
                {group.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {group.items.map(item => (
                  <button
                    key={item.entity}
                    onClick={() => { requestAdminSpawn(item.entity); useGameStore.getState().togglePause() }}
                    style={{
                      padding: '8px 4px', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold',
                      border: `1px solid ${group.color}44`, borderRadius: 5,
                      background: '#0a0a1a', color: '#ccccff', cursor: 'pointer', letterSpacing: 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#0a0a1a')}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setSubView('main')}
          style={{ ...btnBase, color: '#aaaaff', background: 'transparent', boxShadow: 'none', marginTop: 8 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          ← BACK
        </button>
      </>
    )
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
        <div style={toggleStyle} onClick={() => setSubView('spawn')}>
          <span style={{ color: '#ccccff', fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 }}>
            SPAWN
          </span>
          <span style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>→</span>
        </div>
        <div style={toggleStyle} onClick={() => setSubView('players')}>
          <span style={{ color: '#ccccff', fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 }}>
            PLAYERS
          </span>
          <span style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>→</span>
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
  const isLevelUpPending = useGameStore(s => s.isLevelUpPending)
  const togglePause = useGameStore(s => s.togglePause)
  const depositCoins = useProfileStore(s => s.depositCoins)
  const role = useAuthStore(s => s.role)
  const isSuperAdmin = role === 'super_admin'
  const [view, setView] = useState<'main' | 'settings' | 'controls' | 'stats' | 'sounds' | 'admin'>('main')
  function handleQuit() {
    const { sessionCoins, resetRun } = useGameStore.getState()
    depositCoins(sessionCoins)
    onQuit()   // submitRun must read sessionCoins before resetRun clears it
    resetRun()
  }

  const mob = useIsMobile()
  useEffect(() => { if (!isPaused) setView('main') }, [isPaused])


  if (!isPaused || isLevelUpPending) return null

  const panel = (
    <div style={{
      background: '#0d0d1f',
      border: '2px solid #4444aa',
      borderRadius: 12,
      padding: mob ? '24px 20px' : '40px 60px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: mob ? 14 : 20,
      boxShadow: '0 0 40px #2222aa88',
      minWidth: mob ? undefined : 320,
      width: mob ? 'calc(100vw - 32px)' : undefined,
      maxWidth: mob ? 'calc(100vw - 32px)' : undefined,
      maxHeight: mob ? 'calc(100vh - 64px)' : undefined,
      overflowY: mob ? 'auto' : undefined,
      boxSizing: 'border-box',
    }}>
      {view === 'main' ? (
        <>
          <div style={{
            color: '#aaaaff', fontSize: mob ? 22 : 32, fontFamily: 'monospace', fontWeight: 'bold',
            letterSpacing: mob ? 2 : 4, textShadow: '0 0 12px #4444ff',
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
            onClick={() => setView('settings')}
            style={{ ...btnBase, color: '#aaaaff', background: 'transparent', boxShadow: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            SETTINGS
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
      ) : view === 'settings' ? (
        <>
          <div style={{
            color: '#aaaaff', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
            letterSpacing: 3, textShadow: '0 0 10px #4444ff',
          }}>
            SETTINGS
          </div>
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
        <SoundsView onBack={() => setView('settings')} />
      ) : (
        <ControlsView onBack={() => setView('settings')} />
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
