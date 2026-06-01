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
      { label: 'Mjölnir',      entity: 'weapon:axe' },
      { label: 'Aura',         entity: 'weapon:aura' },
      { label: 'Spirit Orb',   entity: 'weapon:orbital' },
      { label: "Odin's Ravens", entity: 'weapon:ravens' },
      { label: 'Bifrost Spear', entity: 'weapon:spear' },
    ],
  },
]

type UpgradeDef = { id: UpgradeId; label: string; max: number }
type WeaponGroup = { label: string; color: string; statusId?: UpgradeId; items: UpgradeDef[] }

const WEAPON_UPGRADE_GROUPS: WeaponGroup[] = [
  {
    label: 'ARCANE WAND', color: '#cc88ff', statusId: 'wand',
    items: [
      { id: 'wand',      label: 'Unlock',     max: 1 },
      { id: 'multiShot', label: 'Multi Shot', max: 4 },
      { id: 'piercing',  label: 'Piercing',   max: 1 },
    ],
  },
  {
    label: 'BOOMERANG', color: '#ff88cc', statusId: 'boomerang',
    items: [
      { id: 'boomerang', label: 'Unlock', max: 1 },
    ],
  },
  {
    label: 'FLAME TRAIL', color: '#ff6644', statusId: 'flameTrail',
    items: [
      { id: 'flameTrail', label: 'Unlock', max: 1 },
    ],
  },
  {
    label: 'BLOOD NOVA', color: '#ff3366', statusId: 'bloodNova',
    items: [
      { id: 'bloodNova',   label: 'Unlock',    max: 1 },
      { id: 'bloodNovaCD', label: 'Dark Conv', max: 4 },
    ],
  },
  {
    label: 'SOUL DRAIN', color: '#aa44ff', statusId: 'vampiric',
    items: [
      { id: 'vampiric', label: 'Unlock', max: 1 },
    ],
  },
  {
    label: 'THUNDER STRIKE', color: '#88ccff', statusId: 'lightning',
    items: [
      { id: 'lightning',         label: 'Unlock',       max: 1 },
      { id: 'lightningTargets',  label: 'Storm +',      max: 2 },
      { id: 'lightningCooldown', label: 'Thunderhaste', max: 2 },
    ],
  },
  {
    label: 'MJÖLNIR', color: '#ffaa44', statusId: 'axe',
    items: [
      { id: 'axe',          label: 'Unlock',           max: 1 },
      { id: 'axeAmount',    label: 'Amount',           max: 2 },
      { id: 'axeDamage',    label: 'Damage',           max: 1 },
      { id: 'axePierce',    label: 'Pierce',           max: 1 },
      { id: 'axeEvolution', label: "Berserker's Ring", max: 1 },
    ],
  },
  {
    label: 'AURA', color: '#44ffcc', statusId: 'aura',
    items: [
      { id: 'aura',      label: 'Unlock', max: 1 },
      { id: 'auraTick',  label: 'Tempo',  max: 3 },
      { id: 'auraRange', label: 'Range',  max: 3 },
    ],
  },
  {
    label: 'SPIRIT ORB', color: '#88aaff', statusId: 'orbital',
    items: [
      { id: 'orbital',  label: 'Orbs',  max: 5 },
      { id: 'orbSpeed', label: 'Speed', max: 3 },
      { id: 'orbPower', label: 'Power', max: 3 },
      { id: 'orbRange', label: 'Range', max: 2 },
    ],
  },
  {
    label: 'EQUINOX / SOLSTICE', color: '#ffee44',
    items: [
      { id: 'equinox',       label: 'Equinox',     max: 1 },
      { id: 'solstice',      label: 'Solstice',    max: 1 },
      { id: 'dualGunDamage', label: 'Solar Dmg',   max: 3 },
      { id: 'dualGunSpeed',  label: 'Solar Spd',   max: 2 },
      { id: 'dualGunExtra',  label: 'Solar Extra', max: 2 },
    ],
  },
  {
    label: 'DIVINE SHIELD', color: '#44ccff', statusId: 'divineShield',
    items: [
      { id: 'divineShield', label: 'Unlock', max: 1 },
    ],
  },
  {
    label: "ODIN'S RAVENS", color: '#9955ff', statusId: 'ravens',
    items: [
      { id: 'ravens',      label: 'Unlock',   max: 1 },
      { id: 'ravensCD',    label: 'Cooldown', max: 3 },
      { id: 'ravensPower', label: 'Power',    max: 3 },
      { id: 'ravensCount', label: 'Count',    max: 2 },
    ],
  },
  {
    label: 'BIFROST SPEAR', color: '#44ff88', statusId: 'spear',
    items: [
      { id: 'spear',         label: 'Unlock',      max: 1 },
      { id: 'spearCount',    label: 'Count',       max: 5 },
      { id: 'spearInterval', label: 'Tempo',       max: 3 },
      { id: 'spearPierce',   label: 'Pierce',      max: 2 },
      { id: 'spearSpeed',    label: 'Speed',       max: 5 },
      { id: 'spearStorm',    label: '1000 Spears', max: 1 },
    ],
  },
  {
    label: 'STATS', color: '#44ff88',
    items: [
      { id: 'might',        label: 'Might',     max: 5 },
      { id: 'xpGain',       label: 'XP Gain',   max: 5 },
      { id: 'magnetRange',  label: 'Magnet',    max: 3 },
      { id: 'dashCooldown', label: 'Dash CD',   max: 4 },
      { id: 'dashDistance', label: 'Dash Dist', max: 3 },
      { id: 'echo',         label: 'Echo',      max: 2 },
    ],
  },
  {
    label: 'MELEE (ARES)', color: '#ff8844',
    items: [
      { id: 'meleeDamage', label: 'Blade Mastery', max: 4 },
      { id: 'meleeRange',  label: 'Iron Reach',    max: 4 },
      { id: 'meleeSpeed',  label: 'Battle Fury',   max: 4 },
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
    case 'axeAmount':         return s.axeAmount ?? 0
    case 'axeDamage':         return s.axeDamage ?? 0
    case 'axePierce':         return s.axePierce ?? 0
    case 'axeEvolution':      return s.axeEvolution ? 1 : 0
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
    case 'spear':             return s.spear ? 1 : 0
    case 'spearCount':        return s.spearCount ?? 0
    case 'spearInterval':     return s.spearInterval ?? 0
    case 'spearPierce':       return s.spearPierce ?? 0
    case 'spearSpeed':        return s.spearSpeed ?? 0
    case 'spearStorm':        return s.spearStorm ? 1 : 0
    case 'dashCooldown':      return Math.round(Math.log(s.dashCooldown / DASH_COOLDOWN_MS) / Math.log(0.75))
    case 'dashDistance':      return Math.round((s.dashDistance - 1) / 0.4)
    case 'meleeRange':        return s.meleeRange ?? 0
    case 'meleeSpeed':        return s.meleeSpeed ?? 0
    case 'meleeDamage':       return s.meleeDamage ?? 0
    default:                  return 0
  }
}

function UpgradesView({ onBack }: { onBack: () => void }) {
  const s = useGameStore(s => s)
  const mob = useIsMobile()
  // Start all sections collapsed so the list isn't overwhelming
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(WEAPON_UPGRADE_GROUPS.map(g => g.label))
  )

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

  const selectAll = useCallback(() => {
    for (const group of WEAPON_UPGRADE_GROUPS) {
      for (const item of group.items) {
        give(item.id, item.max)
      }
    }
  }, [give])

  const allCollapsed = collapsed.size === WEAPON_UPGRADE_GROUPS.length
  const toggleCollapseAll = useCallback(() => {
    setCollapsed(allCollapsed
      ? new Set()
      : new Set(WEAPON_UPGRADE_GROUPS.map(g => g.label))
    )
  }, [allCollapsed])

  const toggleGroup = useCallback((label: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  const levelBtnStyle = (active: boolean, color: string): React.CSSProperties => ({
    padding: mob ? '5px 10px' : '3px 8px',
    fontSize: mob ? 13 : 11,
    fontFamily: 'monospace', fontWeight: 'bold',
    border: `1px solid ${active ? color : '#333355'}`,
    borderRadius: 4, cursor: 'pointer',
    background: active ? color + '33' : '#0a0a1a',
    color: active ? color : '#555577',
    minWidth: mob ? 34 : 28, textAlign: 'center',
    flexShrink: 0,
  })

  return (
    <>
      <div style={{
        color: '#cc88ff', fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 3, textShadow: '0 0 10px #8844cc', alignSelf: 'flex-start',
      }}>
        UPGRADES
      </div>

      <div style={{ display: 'flex', gap: 6, width: '100%' }}>
        <button onClick={clearAll} style={{
          flex: 1, padding: '7px 2px', fontSize: mob ? 11 : 10, fontFamily: 'monospace', fontWeight: 'bold',
          border: '1px solid #661111', borderRadius: 6, cursor: 'pointer',
          background: '#1a0808', color: '#ff6666',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#2a0808')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1a0808')}
        >CLEAR ALL</button>
        <button onClick={selectAll} style={{
          flex: 1, padding: '7px 2px', fontSize: mob ? 11 : 10, fontFamily: 'monospace', fontWeight: 'bold',
          border: '1px solid #116611', borderRadius: 6, cursor: 'pointer',
          background: '#081a08', color: '#66ff66',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#082a08')}
          onMouseLeave={e => (e.currentTarget.style.background = '#081a08')}
        >SELECT ALL</button>
        <button onClick={toggleCollapseAll} style={{
          flex: 1, padding: '7px 2px', fontSize: mob ? 11 : 10, fontFamily: 'monospace', fontWeight: 'bold',
          border: '1px solid #444466', borderRadius: 6, cursor: 'pointer',
          background: '#0a0a1a', color: '#aaaacc',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
          onMouseLeave={e => (e.currentTarget.style.background = '#0a0a1a')}
        >{allCollapsed ? 'EXPAND ALL' : 'COLLAPSE ALL'}</button>
      </div>

      {(() => {
        const renderGroup = (group: WeaponGroup) => {
          const isCollapsed = collapsed.has(group.label)
          const statusLevel = group.statusId ? getCurrentLevel(group.statusId, s) : -1
          const isActive = statusLevel > 0
          return (
            <div key={group.label} style={{ width: '100%', borderRadius: 6 }}>
              <div
                onClick={() => toggleGroup(group.label)}
                onMouseEnter={e => (e.currentTarget.style.background = isActive ? `${group.color}2a` : '#191930')}
                onMouseLeave={e => (e.currentTarget.style.background = isActive ? `${group.color}1a` : '#111122')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: mob ? '10px 12px' : '7px 12px',
                  background: isActive ? `${group.color}1a` : '#111122',
                  border: `1px solid ${group.color}${isActive ? '55' : '28'}`,
                  borderRadius: isCollapsed ? 6 : '6px 6px 0 0',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background 0.15s ease',
                }}
              >
                <span style={{
                  color: group.color, fontFamily: 'monospace',
                  fontSize: mob ? 14 : 11, width: 12, flexShrink: 0,
                }}>
                  {isCollapsed ? '▸' : '▾'}
                </span>
                <span style={{
                  color: group.color, fontFamily: 'monospace',
                  fontSize: mob ? 13 : 11, letterSpacing: 1, flex: 1, fontWeight: 'bold',
                  opacity: group.statusId && !isActive ? 0.5 : 1,
                }}>
                  {group.label}
                </span>
                {group.statusId && (
                  <span style={{
                    fontSize: mob ? 11 : 9, fontFamily: 'monospace', fontWeight: 'bold',
                    color: isActive ? '#44ff88' : '#555577',
                    border: `1px solid ${isActive ? '#44ff8833' : '#33334455'}`,
                    borderRadius: 10, padding: '1px 7px',
                    background: isActive ? '#44ff8815' : 'transparent',
                  }}>
                    {isActive ? 'ON' : 'OFF'}
                  </span>
                )}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateRows: isCollapsed ? '0fr' : '1fr',
                transition: 'grid-template-rows 0.35s ease',
              }}>
                <div style={{ overflow: 'hidden', minHeight: 0 }}>
                <div style={{
                  padding: mob ? '10px 12px' : '8px 12px',
                  border: `1px solid ${group.color}28`,
                  borderTop: 'none',
                  borderRadius: '0 0 6px 6px',
                  background: '#0c0c1e',
                  display: 'flex', flexDirection: 'column', gap: mob ? 8 : 5,
                }}>
                  {group.items.map(item => {
                    const cur = getCurrentLevel(item.id, s)
                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        flexWrap: mob ? 'wrap' : 'nowrap',
                      }}>
                        <span style={{
                          color: item.label === 'Unlock' ? group.color : '#9999bb',
                          fontFamily: 'monospace',
                          fontSize: mob ? 13 : 11,
                          width: mob ? 88 : 96,
                          flexShrink: 0,
                          fontWeight: item.label === 'Unlock' ? 'bold' : 'normal',
                        }}>
                          {item.label}
                        </span>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
              </div>
            </div>
          )
        }

        const half = Math.ceil(WEAPON_UPGRADE_GROUPS.length / 2)
        return mob ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {WEAPON_UPGRADE_GROUPS.map(renderGroup)}
          </div>
        ) : (
          <div style={{ width: '100%', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {WEAPON_UPGRADE_GROUPS.slice(0, half).map(renderGroup)}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {WEAPON_UPGRADE_GROUPS.slice(half).map(renderGroup)}
            </div>
          </div>
        )
      })()}

      <button
        onClick={onBack}
        style={{
          width: 'calc((100% - 12px) / 3)', padding: '7px 0', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold',
          border: '1px solid #4444cc', borderRadius: 6, cursor: 'pointer', letterSpacing: 2,
          color: '#aaaaff', background: '#0d0d1f', boxShadow: 'none', marginTop: 4,
          position: 'sticky', bottom: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
        onMouseLeave={e => (e.currentTarget.style.background = '#0d0d1f')}
      >
        ← BACK
      </button>
    </>
  )
}

function AdminPanel({ onBack, onSubViewChange }: { onBack: () => void; onSubViewChange?: (v: 'main' | 'players' | 'spawn' | 'upgrades') => void }) {
  const adminInvincible = useGameStore(s => s.adminInvincible)
  const setAdminInvincible = useGameStore(s => s.setAdminInvincible)
  const requestAdminSpawn = useGameStore(s => s.requestAdminSpawn)
  const role = useAuthStore(s => s.role)
  const isSuperAdmin = role === 'super_admin'
  const [subView, setSubView] = useState<'main' | 'players' | 'spawn' | 'upgrades'>('main')
  const mob = useIsMobile()

  const changeSubView = (v: 'main' | 'players' | 'spawn' | 'upgrades') => {
    setSubView(v)
    onSubViewChange?.(v)
  }

  const toggleStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '10px 14px',
    background: '#0a0a1a', border: '1px solid #333366',
    borderRadius: 6, cursor: 'pointer',
  }

  if (subView === 'players') {
    return <AdminPlayersView onBack={() => changeSubView('main')} />
  }

  if (subView === 'upgrades') {
    return <UpgradesView onBack={() => changeSubView('main')} />
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
          onClick={() => changeSubView('main')}
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
        <div style={toggleStyle} onClick={() => changeSubView('spawn')}>
          <span style={{ color: '#ccccff', fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 }}>
            SPAWN
          </span>
          <span style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>→</span>
        </div>
        <div style={toggleStyle} onClick={() => changeSubView('upgrades')}>
          <span style={{ color: '#ccccff', fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 }}>
            UPGRADES
          </span>
          <span style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>→</span>
        </div>
        {isSuperAdmin && (
          <div style={toggleStyle} onClick={() => changeSubView('players')}>
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

export function PauseMenu({ onQuit, hidden = false }: { onQuit: () => void; hidden?: boolean }) {
  const isPaused = useGameStore(s => s.isPaused)
  const isLevelUpPending = useGameStore(s => s.isLevelUpPending)
  const isDead = useGameStore(s => s.isDead)
  const isWon = useGameStore(s => s.isWon)
  const togglePause = useGameStore(s => s.togglePause)
  const role = useAuthStore(s => s.role)
  const isAdmin = role === 'super_admin' || role === 'admin'
  const [view, setView] = useState<'main' | 'settings' | 'controls' | 'stats' | 'sounds' | 'admin'>('main')
  const [adminSubView, setAdminSubView] = useState<'main' | 'players' | 'spawn' | 'upgrades'>('main')
  function handleQuit() {
    onQuit()
  }

  const mob = useIsMobile()
  useEffect(() => { if (!isPaused) { setView('main'); setAdminSubView('main') } }, [isPaused])


  if (hidden || !isPaused || isLevelUpPending || isDead || isWon) return null

  const panel = (
    <div style={{
      background: '#0d0d1f',
      border: '2px solid #4444aa',
      borderRadius: 12,
      padding: mob ? '20px 16px' : (view === 'admin' && (adminSubView === 'upgrades' || adminSubView === 'spawn' || adminSubView === 'players') ? '28px 36px' : '40px 60px'),
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: mob ? 12 : 16,
      boxShadow: '0 0 40px #2222aa88',
      width: !mob && view === 'admin' && adminSubView === 'players' ? 'calc(100vw - 48px)' : !mob && view === 'admin' && (adminSubView === 'upgrades' || adminSubView === 'spawn') ? 'min(940px, calc(100vw - 48px))' : mob ? 'calc(100vw - 32px)' : 'min(360px, calc(100vw - 32px))',
      minWidth: mob ? undefined : 320,
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 48px)',
      overflowY: 'auto',
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
        <AdminPanel onBack={() => { setView('main'); setAdminSubView('main') }} onSubViewChange={setAdminSubView} />
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
