import { useState, useEffect, useCallback } from 'react'

function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth <= 768)
  useEffect(() => {
    const fn = () => setMob(window.innerWidth <= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mob
}
import { useGameStore, weaponBaseDamage, DASH_COOLDOWN_MS, type AdminSpawnEntity, type UpgradeId } from '../store/gameStore'
import { activeNetClient } from '../net/netState'
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
      { label: 'Veteran',     entity: 'veteran' },
      { label: 'Brute',       entity: 'brute' },
      { label: 'Revenant',    entity: 'revenant' },
      { label: 'Warlord',     entity: 'warlord' },
      { label: 'Titan',       entity: 'titan' },
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
  {
    label: 'WEAPONS', color: '#cc88ff',
    items: [
      { label: 'Arcane Wand',  entity: 'weapon:wand' },
      { label: 'Boomerang',    entity: 'weapon:boomerang' },
      { label: 'Flame Trail',  entity: 'weapon:flameTrail' },
      { label: 'Blood Nova',   entity: 'weapon:bloodNova' },
      { label: 'Thunder Strike', entity: 'weapon:lightning' },
      { label: 'War Axe',      entity: 'weapon:axe' },
      { label: 'Aura',         entity: 'weapon:aura' },
      { label: 'Spirit Orb',   entity: 'weapon:orbital' },
      { label: "Odin's Ravens", entity: 'weapon:ravens' },
    ],
  },
]

type UpgradeDef = { id: UpgradeId; label: string; max: number }
const ADMIN_UPGRADE_GROUPS: { label: string; color: string; items: UpgradeDef[] }[] = [
  {
    label: 'WEAPONS', color: '#cc88ff',
    items: [
      { id: 'wand', label: 'Wand', max: 1 },
      { id: 'boomerang', label: 'Boomerang', max: 1 },
      { id: 'flameTrail', label: 'Flame Trail', max: 1 },
      { id: 'bloodNova', label: 'Blood Nova', max: 1 },
      { id: 'vampiric', label: 'Soul Drain', max: 1 },
      { id: 'lightning', label: 'Thunder', max: 1 },
      { id: 'axe', label: 'War Axe', max: 1 },
      { id: 'aura', label: 'Aura', max: 1 },
      { id: 'orbital', label: 'Spirit Orb', max: 5 },
      { id: 'equinox', label: 'Equinox', max: 1 },
      { id: 'solstice', label: 'Solstice', max: 1 },
      { id: 'divineShield', label: 'D.Shield', max: 1 },
      { id: 'ravens', label: "Ravens", max: 1 },
    ],
  },
  {
    label: 'UPGRADES', color: '#88aaff',
    items: [
      { id: 'multiShot', label: 'Multi Shot', max: 4 },
      { id: 'piercing', label: 'Piercing', max: 1 },
      { id: 'auraTick', label: 'Aura Tempo', max: 3 },
      { id: 'auraRange', label: 'Aura Range', max: 3 },
      { id: 'orbSpeed', label: 'Orb Speed', max: 3 },
      { id: 'orbPower', label: 'Orb Power', max: 3 },
      { id: 'orbRange', label: 'Orb Range', max: 2 },
      { id: 'bloodNovaCD', label: 'Dark Conv', max: 4 },
      { id: 'lightningTargets', label: 'Storm +', max: 2 },
      { id: 'lightningCooldown', label: 'Thunderhaste', max: 2 },
      { id: 'dualGunDamage', label: 'Solar Dmg', max: 3 },
      { id: 'dualGunSpeed', label: 'Solar Spd', max: 2 },
      { id: 'dualGunExtra', label: 'Solar Extra', max: 2 },
      { id: 'echo', label: 'Echo', max: 2 },
      { id: 'ravensCD', label: 'Ravens CD', max: 3 },
      { id: 'ravensPower', label: 'Ravens Pwr', max: 3 },
      { id: 'ravensCount', label: 'Ravens Cnt', max: 2 },
    ],
  },
  {
    label: 'STATS', color: '#44ff88',
    items: [
      { id: 'might', label: 'Might', max: 5 },
      { id: 'xpGain', label: 'XP Gain', max: 5 },
      { id: 'magnetRange', label: 'Magnet', max: 3 },
      { id: 'dashCooldown', label: 'Dash CD', max: 4 },
      { id: 'dashDistance', label: 'Dash Dist', max: 3 },
    ],
  },
]

function getCurrentLevel(id: UpgradeId, s: ReturnType<typeof useGameStore.getState>): number {
  switch (id) {
    case 'wand':              return s.wand ? 1 : 0
    case 'piercing':          return s.piercing ? 1 : 0
    case 'multiShot':         return s.multiShot
    case 'aura':              return s.aura > 0 ? 1 : 0
    case 'auraTick':          return s.auraTick
    case 'auraRange':         return s.auraRange
    case 'orbital':           return s.orbital
    case 'orbSpeed':          return s.orbSpeed
    case 'orbPower':          return s.orbPower
    case 'orbRange':          return s.orbRange
    case 'boomerang':         return s.boomerang ? 1 : 0
    case 'flameTrail':        return s.flameTrail ? 1 : 0
    case 'bloodNova':         return s.bloodNova ? 1 : 0
    case 'bloodNovaCD':       return s.bloodNovaCD
    case 'vampiric':          return s.vampiric ? 1 : 0
    case 'lightning':         return s.lightning ? 1 : 0
    case 'lightningTargets':  return s.lightningTargets
    case 'lightningCooldown': return s.lightningCooldown
    case 'might':             return s.mightPicks
    case 'axe':               return s.axe ? 1 : 0
    case 'divineShield':      return s.divineShield ? 1 : 0
    case 'xpGain':            return s.xpGain
    case 'magnetRange':       return s.magnetRange
    case 'equinox':           return s.equinox ? 1 : 0
    case 'solstice':          return s.solstice ? 1 : 0
    case 'dualGunDamage':     return s.dualGunDamage
    case 'dualGunSpeed':      return s.dualGunSpeed
    case 'dualGunExtra':      return s.dualGunExtra
    case 'echo':              return s.echo
    case 'ravens':            return s.ravens ? 1 : 0
    case 'ravensCD':          return s.ravensCD
    case 'ravensPower':       return s.ravensPower
    case 'ravensCount':       return s.ravensCount
    case 'dashCooldown':      return Math.round(Math.log(s.dashCooldown / DASH_COOLDOWN_MS) / Math.log(0.75))
    case 'dashDistance':      return Math.round((s.dashDistance - 1) / 0.4)
    default:                  return 0
  }
}

function UpgradesView({ onBack }: { onBack: () => void }) {
  const s = useGameStore(s => s)

  const give = useCallback((id: UpgradeId, level: number) => {
    if (activeNetClient) {
      activeNetClient.send({ type: 'adminGiveUpgrade', upgradeId: id, targetLevel: level })
    } else {
      useGameStore.getState().adminSetUpgrade(id, level)
    }
  }, [])

  const clearAll = useCallback(() => {
    if (activeNetClient) {
      activeNetClient.send({ type: 'adminClearUpgrades' })
    } else {
      useGameStore.getState().adminResetUpgrades()
    }
  }, [])

  const levelBtnStyle = (active: boolean, color: string): React.CSSProperties => ({
    padding: '2px 7px', fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold',
    border: `1px solid ${active ? color : '#333355'}`,
    borderRadius: 4, cursor: 'pointer',
    background: active ? color + '44' : '#0a0a1a',
    color: active ? color : '#555577',
    minWidth: 26, textAlign: 'center',
  })

  return (
    <>
      <div style={{
        color: '#cc88ff', fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 3, textShadow: '0 0 10px #8844cc',
      }}>
        UPGRADES
      </div>

      <button
        onClick={clearAll}
        style={{
          width: '100%', padding: '8px 0', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
          border: '1px solid #661111', borderRadius: 6, cursor: 'pointer', letterSpacing: 2,
          background: '#1a0808', color: '#ff6666',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#2a0808')}
        onMouseLeave={e => (e.currentTarget.style.background = '#1a0808')}
      >
        CLEAR ALL
      </button>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '58vh' }}>
        {ADMIN_UPGRADE_GROUPS.map(group => (
          <div key={group.label}>
            <div style={{ color: group.color, fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, marginBottom: 5 }}>
              {group.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {group.items.map(item => {
                const cur = getCurrentLevel(item.id, s)
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#aaaacc', fontFamily: 'monospace', fontSize: 11, minWidth: 90, flexShrink: 0 }}>
                      {item.label}
                    </span>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {Array.from({ length: item.max + 1 }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => give(item.id, i)}
                          style={levelBtnStyle(cur === i, group.color)}
                          onMouseEnter={e => { if (cur !== i) e.currentTarget.style.background = '#111133' }}
                          onMouseLeave={e => { if (cur !== i) e.currentTarget.style.background = '#0a0a1a' }}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onBack}
        style={{ ...{ width: '100%', padding: '12px 0', fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold', border: '2px solid #4444cc', borderRadius: 8, cursor: 'pointer', letterSpacing: 2 }, color: '#aaaaff', background: 'transparent', boxShadow: 'none', marginTop: 8 }}
        onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        ← BACK
      </button>
    </>
  )
}

function AdminPanel({ onBack }: { onBack: () => void }) {
  const adminInvincible = useGameStore(s => s.adminInvincible)
  const setAdminInvincible = useGameStore(s => s.setAdminInvincible)
  const requestAdminSpawn = useGameStore(s => s.requestAdminSpawn)
  const role = useAuthStore(s => s.role)
  const isSuperAdmin = role === 'super_admin'
  const [subView, setSubView] = useState<'main' | 'players' | 'spawn' | 'upgrades'>('main')
  const mob = useIsMobile()

  const toggleStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '10px 14px',
    background: '#0a0a1a', border: '1px solid #333366',
    borderRadius: 6, cursor: 'pointer',
  }

  if (subView === 'players') {
    return <AdminPlayersView onBack={() => setSubView('main')} />
  }

  if (subView === 'upgrades') {
    return <UpgradesView onBack={() => setSubView('main')} />
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

        {mob ? (
          // Mobile: vertical scroll layout
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
        ) : (
          // Desktop: horizontal landscape layout, all groups visible at once
          <div style={{ display: 'flex', flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
            {SPAWN_GROUPS.map(group => (
              <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 140 }}>
                <div style={{ color: group.color, fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>
                  {group.label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {group.items.map(item => (
                    <button
                      key={item.entity}
                      onClick={() => { requestAdminSpawn(item.entity); useGameStore.getState().togglePause() }}
                      style={{
                        padding: '7px 4px', fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold',
                        border: `1px solid ${group.color}44`, borderRadius: 5,
                        background: '#0a0a1a', color: '#ccccff', cursor: 'pointer', letterSpacing: 1,
                        whiteSpace: 'nowrap',
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
        )}

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
        <div style={toggleStyle} onClick={() => setSubView('upgrades')}>
          <span style={{ color: '#ccccff', fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 }}>
            UPGRADES
          </span>
          <span style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>→</span>
        </div>
        {isSuperAdmin && (
          <div style={toggleStyle} onClick={() => setSubView('players')}>
            <span style={{ color: '#ccccff', fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 }}>
              PLAYERS
            </span>
            <span style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>→</span>
          </div>
        )}
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
  const isDead = useGameStore(s => s.isDead)
  const isWon = useGameStore(s => s.isWon)
  const togglePause = useGameStore(s => s.togglePause)
  const depositCoins = useProfileStore(s => s.depositCoins)
  const role = useAuthStore(s => s.role)
  const isAdmin = role === 'super_admin' || role === 'admin'
  const [view, setView] = useState<'main' | 'settings' | 'controls' | 'stats' | 'sounds' | 'admin'>('main')
  function handleQuit() {
    const { sessionCoins, resetRun } = useGameStore.getState()
    depositCoins(sessionCoins)
    onQuit()   // submitRun must read sessionCoins before resetRun clears it
    resetRun()
  }

  const mob = useIsMobile()
  useEffect(() => { if (!isPaused) setView('main') }, [isPaused])


  if (!isPaused || isLevelUpPending || isDead || isWon) return null

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

          {isAdmin && (
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
