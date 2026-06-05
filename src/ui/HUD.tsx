import { useEffect, useState } from 'react'
import { useGameStore, weaponBaseDamage } from '../store/gameStore'
import { useStageStore } from '../store/stageStore'
import { runData, RUN_DURATION } from '../game/runData'

function WaveLabel() {
  const [label, setLabel] = useState('')
  const [enemies, setEnemies] = useState(0)
  useEffect(() => {
    let id: number
    const tick = () => { setLabel(runData.waveLabel); setEnemies(runData.enemyCount); id = requestAnimationFrame(tick) }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])
  if (!label) return null
  const isBoss = label.startsWith('⚠') || label.startsWith('☠')
  const isSurge = label.startsWith('⚡')
  const color = isBoss ? '#ff6633' : isSurge ? '#ffcc00' : '#aabbff'
  return (
    <div style={{
      position: 'absolute', top: window.innerWidth <= 768 ? 58 : 16, left: 16,
      color, fontSize: 11, fontFamily: 'monospace',
      background: '#05050faa', border: `1px solid ${isBoss ? '#552200' : isSurge ? '#554400' : '#1a1a33'}`,
      borderRadius: 4, padding: '3px 8px',
      pointerEvents: 'none',
      textShadow: isBoss ? '0 0 8px #ff4400' : isSurge ? '0 0 8px #ffaa00' : 'none',
    }}>
      {label}  ·  {enemies} enemies
    </div>
  )
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function TimerDisplay() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    let id: number
    const tick = () => { setElapsed(runData.elapsed); id = requestAnimationFrame(tick) }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])

  const remaining = Math.max(0, RUN_DURATION - elapsed)
  const pct = Math.min(1, elapsed / RUN_DURATION)
  const warning = remaining < 60_000

  return (
    <div style={{
      position: 'absolute', top: 0, left: '50%',
      transform: 'translateX(-50%)', width: window.innerWidth <= 768 ? 200 : 260,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      pointerEvents: 'none',
      background: '#05050faa',
      border: '1px solid #1a1a33',
      borderTop: 'none',
      borderRadius: '0 0 8px 8px',
      padding: '0 14px 6px',
    }}>
      <div style={{
        color: warning ? '#ff4444' : '#ffffff',
        fontSize: window.innerWidth <= 768 ? 17 : 22, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: window.innerWidth <= 768 ? 2 : 4, padding: '6px 0 4px',
        textShadow: warning ? '0 0 12px #ff0000' : '0 0 12px #4455ff',
      }}>
        {fmt(elapsed)} <span style={{ color: '#666688' }}>/ {fmt(RUN_DURATION)}</span>
      </div>
      <div style={{ width: '100%', height: 7, background: '#0d0d22', borderRadius: 99, border: '1px solid #2a2a55' }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`,
          background: warning
            ? 'linear-gradient(90deg, #cc0000, #ff5555)'
            : 'linear-gradient(90deg, #2255cc, #55aaff)',
          borderRadius: 99, transition: 'background 0.5s',
          boxShadow: warning ? '0 0 8px #ff2222' : '0 0 8px #3366ff',
        }} />
      </div>
    </div>
  )
}

function DashIndicator() {
  const [pct, setPct] = useState(100)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    let id: number
    const tick = () => {
      const { dashCooldownUntil, dashCooldown } = useGameStore.getState()
      const rem = Math.max(0, dashCooldownUntil - Date.now())
      setRemaining(rem)
      setPct(rem === 0 ? 100 : ((dashCooldown - rem) / dashCooldown) * 100)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])

  const ready = pct >= 100

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        color: ready ? '#88ccff' : '#446688',
        fontSize: 11, fontFamily: 'monospace', letterSpacing: 1, width: 36,
      }}>
        DASH
      </span>
      <div style={{ flex: 1, height: 6, background: '#001122', borderRadius: 3, overflow: 'hidden', border: '1px solid #223344' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: ready ? 'linear-gradient(90deg, #2266aa, #88ccff)' : 'linear-gradient(90deg, #113355, #2266aa)',
          borderRadius: 3, transition: 'none',
        }} />
      </div>
      <span style={{ color: ready ? '#88ccff' : '#446688', fontSize: 10, fontFamily: 'monospace', width: 28, textAlign: 'right' }}>
        {ready ? 'RDY' : `${(remaining / 1000).toFixed(1)}s`}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#1a1a33', margin: '3px 0' }} />
}

function StatRow({ label, value, color = '#7777aa' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: '#ccccdd', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 }}>{label}</span>
      <span style={{ color, fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' }}>{value}</span>
    </div>
  )
}

const WEAPON_SLOT_DEFS = [
  { id: 'melee',      label: 'MLÉ', color: '#dd3311' },
  { id: 'wand',       label: 'WND', color: '#88aaff' },
  { id: 'lightning',  label: 'ZAP', color: '#ddee44' },
  { id: 'axe',        label: 'AXE', color: '#ffaa44' },
  { id: 'aura',       label: 'AUR', color: '#aa55ff' },
  { id: 'orbital',    label: 'ORB', color: '#cc88ff' },
  { id: 'boomerang',  label: 'BMR', color: '#ffcc44' },
  { id: 'flameTrail', label: 'FLM', color: '#ff6633' },
  { id: 'bloodNova',  label: 'NOV', color: '#ff3333' },
  { id: 'equinox',    label: 'EQN', color: '#44aaff' },
  { id: 'solstice',   label: 'SOL', color: '#ffbb22' },
  { id: 'ravens',      label: 'RVN', color: '#bb77ff' },
  { id: 'spear',       label: 'SPR', color: '#00ddff' },
  { id: 'vampiric',    label: 'DRN', color: '#cc3355' },
  { id: 'divineShield',label: 'SHD', color: '#44ccff' },
] as const

function WeaponSlots() {
  const isMeleeChar = useGameStore(s => s.isMeleeChar)
  const wand       = useGameStore(s => s.wand)
  const lightning  = useGameStore(s => s.lightning)
  const axe        = useGameStore(s => s.axe)
  const aura       = useGameStore(s => s.aura)
  const orbital    = useGameStore(s => s.orbital)
  const boomerang  = useGameStore(s => s.boomerang)
  const flameTrail = useGameStore(s => s.flameTrail)
  const bloodNova  = useGameStore(s => s.bloodNova)
  const equinox    = useGameStore(s => s.equinox)
  const solstice   = useGameStore(s => s.solstice)
  const ravens        = useGameStore(s => s.ravens)
  const spear         = useGameStore(s => s.spear)
  const vampiric      = useGameStore(s => s.vampiric)
  const divineShield  = useGameStore(s => s.divineShield)

  const ownedMap: Record<string, boolean> = {
    melee: !!isMeleeChar,
    wand: !!wand, lightning: !!lightning, axe: !!axe,
    aura: aura > 0, orbital: orbital > 0, boomerang: !!boomerang,
    flameTrail: !!flameTrail, bloodNova: !!bloodNova,
    equinox: !!equinox, solstice: !!solstice, ravens: !!ravens, spear: !!spear,
    vampiric: !!vampiric, divineShield: !!divineShield,
  }

  const owned = WEAPON_SLOT_DEFS.filter(w => ownedMap[w.id])
  const count  = owned.length
  const atMax  = count >= 6

  const slots = [...owned, ...Array(Math.max(0, 6 - count)).fill(null)].slice(0, 6) as
    (typeof WEAPON_SLOT_DEFS[number] | null)[]

  return (
    <>
      <Divider />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#7777aa', letterSpacing: 1 }}>WEAPONS</span>
        <span style={{
          fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold',
          color: atMax ? '#ffcc44' : '#556688',
          textShadow: atMax ? '0 0 6px #ffaa00' : 'none',
        }}>
          {count}/6{atMax ? ' ★' : ''}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {slots.map((w, i) => (
          <div key={i} style={{
            width: 22, height: 22,
            borderRadius: 4,
            border: `1px solid ${w ? (atMax ? '#ffcc44bb' : w.color + '88') : '#1a1a33'}`,
            background: w ? w.color + '22' : '#05050f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: atMax && w ? `0 0 5px ${w.color}55` : 'none',
          }}>
            {w && (
              <span style={{
                fontFamily: 'monospace', fontSize: 7, fontWeight: 'bold',
                color: atMax ? '#ffdd88' : w.color,
                letterSpacing: 0,
              }}>
                {w.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

interface WeaponChipProps { label: string; detail?: string; color: string }
function WeaponChip({ label, detail, color }: WeaponChipProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color, fontSize: 8 }}>◆</span>
      <span style={{ color, fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 }}>
        {label}
      </span>
      {detail && (
        <span style={{ color: '#555577', fontFamily: 'monospace', fontSize: 9 }}>{detail}</span>
      )}
    </div>
  )
}

function LeftPanel() {
  if (window.innerWidth <= 768) return null
  const level       = useGameStore(s => s.level)
  const might       = useGameStore(s => s.might)
  const moveSpeed   = useGameStore(s => s.moveSpeed)
  const attackInterval = useGameStore(s => s.attackInterval)
  const hpRegen     = useGameStore(s => s.hpRegen)
  const sessionCoins = useGameStore(s => s.sessionCoins)
  const wand        = useGameStore(s => s.wand)
  const multiShot   = useGameStore(s => s.multiShot)
  const piercing    = useGameStore(s => s.piercing)
  const aura        = useGameStore(s => s.aura)
  const orbital     = useGameStore(s => s.orbital)
  const boomerang   = useGameStore(s => s.boomerang)
  const flameTrail  = useGameStore(s => s.flameTrail)
  const bloodNova   = useGameStore(s => s.bloodNova)
  const lightning   = useGameStore(s => s.lightning)
  const axe            = useGameStore(s => s.axe)
  const axeAmountHud   = useGameStore(s => s.axeAmount)
  const axeEvolutionHud = useGameStore(s => s.axeEvolution)
  const equinox     = useGameStore(s => s.equinox)
  const solstice    = useGameStore(s => s.solstice)
  const ravens      = useGameStore(s => s.ravens)
  const spear2         = useGameStore(s => s.spear)
  const spearStormHud  = useGameStore(s => s.spearStorm)
  const spearCountHud  = useGameStore(s => s.spearCount)
  const vampiricHud    = useGameStore(s => s.vampiric)
  const divineShieldHud = useGameStore(s => s.divineShield)
  const echoHud        = useGameStore(s => s.echo)

  const dmg = Math.floor(weaponBaseDamage(level) * might)
  const aps = (1000 / attackInterval).toFixed(2)

  const hasWeapons = wand || multiShot > 0 || piercing || aura > 0 || orbital > 0 || boomerang || flameTrail || bloodNova || lightning || axe || equinox || solstice || ravens || spear2 || vampiricHud || divineShieldHud || echoHud > 0

  return (
    <div style={{
      position: 'absolute', top: window.innerWidth <= 768 ? 128 : 72, left: 16,
      background: '#05050faa',
      border: '1px solid #1a1a33',
      borderRadius: 6, padding: '7px 10px',
      display: 'flex', flexDirection: 'column', gap: 4,
      minWidth: 168,
      pointerEvents: 'none',
    }}>
      {/* Level + coins */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{
          color: '#ffffff', fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
          textShadow: '0 0 8px #4444ff',
        }}>
          LVL {level}
        </span>
        <span style={{
          color: '#ccaa22', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold',
          textShadow: '0 0 6px #886600',
        }}>
          ◈ {sessionCoins}
        </span>
      </div>

      <Divider />

      {/* Stats */}
      <StatRow label="DMG"  value={`~${dmg}`}    color="#ff8888" />
      <StatRow label="ASPD" value={`${aps}/s`}   color="#88aaff" />
      <StatRow label="SPD"  value={`${moveSpeed}`} color="#88ffcc" />
      {hpRegen > 0 && (
        <StatRow label="REGEN" value={`${hpRegen.toFixed(1)}/s`} color="#44cc66" />
      )}

      {/* Weapons */}
      {hasWeapons && (
        <>
          <Divider />
          {wand             && <WeaponChip label="ARCANE WAND"                                        color="#88aaff" />}
          {multiShot > 0   && <WeaponChip label="MULTI SHOT"  detail={`×${multiShot + 1}`}          color="#88aaff" />}
          {piercing         && <WeaponChip label="PIERCING"                                          color="#44ccff" />}
          {lightning        && <WeaponChip label="THUNDER STRIKE"                                    color="#ddee44" />}
          {axe              && <WeaponChip label={axeEvolutionHud ? "BERSERKER'S RING" : "MJÖLNIR"} detail={!axeEvolutionHud && axeAmountHud > 0 ? '×2' : undefined} color="#ffaa44" />}
          {aura > 0         && <WeaponChip label="AURA"        detail={`${'●'.repeat(Math.min(aura, 5))}${aura > 5 ? `+${aura - 5}` : ''}`} color="#aa55ff" />}
          {orbital > 0      && <WeaponChip label="SPIRIT ORB"  detail={`×${orbital}`}               color="#cc88ff" />}
          {boomerang         && <WeaponChip label="BOOMERANG"                                        color="#ffcc44" />}
          {flameTrail        && <WeaponChip label="FLAME TRAIL"                                      color="#ff6633" />}
          {bloodNova         && <WeaponChip label="BLOOD NOVA"                                       color="#ff3333" />}
          {equinox           && <WeaponChip label="EQUINOX"                                          color="#44aaff" />}
          {solstice          && <WeaponChip label="SOLSTICE"                                         color="#ffbb22" />}
          {ravens            && <WeaponChip label="ODIN'S RAVENS"                                    color="#bb77ff" />}
          {spear2            && <WeaponChip label={spearStormHud ? "THOUSAND SPEARS" : "BIFROST SPEAR"} detail={!spearStormHud && spearCountHud > 0 ? `×${1 + spearCountHud}` : undefined} color="#00ddff" />}
          {vampiricHud       && <WeaponChip label="SOUL DRAIN"                                         color="#cc3355" />}
          {divineShieldHud   && <WeaponChip label="DIVINE SHIELD"                                      color="#44ccff" />}
          {echoHud > 0       && <WeaponChip label="ECHO"           detail={`×${echoHud}`}              color="#aaddff" />}
        </>
      )}
      <WeaponSlots />
    </div>
  )
}

function PauseButton() {
  const togglePause = useGameStore(s => s.togglePause)
  if (window.innerWidth > 768) return null
  return (
    <button
      onClick={togglePause}
      style={{
        position: 'absolute', top: 8, left: 8,
        width: 48, height: 48,
        background: '#05050fcc',
        border: '1px solid #2a2a55',
        borderRadius: 8,
        color: '#8899cc',
        fontSize: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        pointerEvents: 'auto',
        zIndex: 10,
        touchAction: 'none',
      }}
    >
      ⏸
    </button>
  )
}

function FogIndicator() {
  const selectedStage = useStageStore(s => s.selectedStage)
  const [fogT, setFogT] = useState(0)

  useEffect(() => {
    if (selectedStage !== 3) return
    let id: number
    const tick = () => { setFogT(Math.min(runData.elapsed / RUN_DURATION, 1)); id = requestAnimationFrame(tick) }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [selectedStage])

  if (selectedStage !== 3) return null

  const pct  = fogT * 100
  const warn = fogT > 0.66
  const crit = fogT > 0.85

  return (
    <div style={{
      position: 'absolute', top: window.innerWidth <= 768 ? 58 : 16, right: 16,
      background: '#05050faa',
      border: `1px solid ${crit ? '#660022' : warn ? '#441133' : '#2a1a44'}`,
      borderRadius: 4, padding: '4px 8px',
      pointerEvents: 'none', minWidth: 130,
      display: 'flex', flexDirection: 'column', gap: 4,
      boxShadow: crit ? '0 0 10px rgba(180,0,60,0.35)' : warn ? '0 0 6px rgba(120,0,80,0.25)' : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          color: crit ? '#ff4466' : warn ? '#cc66aa' : '#9966cc',
          fontSize: 10, fontFamily: 'monospace', letterSpacing: 1,
          textShadow: crit ? '0 0 8px #ff0044' : 'none',
        }}>
          VEIL CLOSING
        </span>
        <span style={{
          color: crit ? '#ff4466' : warn ? '#cc66aa' : '#9966cc',
          fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold',
        }}>
          {Math.round(pct)}%
        </span>
      </div>
      <div style={{ height: 5, background: '#0d0d22', borderRadius: 99, overflow: 'hidden', border: '1px solid #1a0a2a' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: crit
            ? 'linear-gradient(90deg, #660033, #ff0044)'
            : warn
              ? 'linear-gradient(90deg, #551144, #cc2277)'
              : 'linear-gradient(90deg, #331166, #8833cc)',
          borderRadius: 99,
          boxShadow: warn ? '0 0 6px rgba(200,30,100,0.5)' : '0 0 4px rgba(120,40,200,0.4)',
        }} />
      </div>
    </div>
  )
}

export function HUD() {
  const hp = useGameStore(s => s.hp)
  const maxHp = useGameStore(s => s.maxHp)
  const xp = useGameStore(s => s.xp)
  const xpNeeded = useGameStore(s => s.xpNeeded)

  const hpPct = (hp / maxHp) * 100
  const xpClamped = Math.min(xp, xpNeeded)
  const xpPct = (xpClamped / xpNeeded) * 100

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <PauseButton />
      <WaveLabel />
      <TimerDisplay />
      <FogIndicator />
      <LeftPanel />

      <div style={{
        position: 'absolute', bottom: 0, left: '50%',
        transform: 'translateX(-50%)', width: window.innerWidth <= 768 ? 240 : 320,
        paddingBottom: window.innerWidth <= 768 ? 72 : 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {window.innerWidth > 768 && <DashIndicator />}
        <div>
          <div style={{ color: '#ff8888', fontSize: 13, fontFamily: 'monospace', marginBottom: 4, textAlign: 'center' }}>
            HP {hp} / {maxHp}
          </div>
          <div style={{ height: 14, background: '#220000', borderRadius: 7, overflow: 'hidden', border: '1px solid #550000' }}>
            <div style={{
              height: '100%', width: `${hpPct}%`,
              background: 'linear-gradient(90deg, #cc0000, #ff4444)',
              borderRadius: 7, transition: 'width 0.1s',
            }} />
          </div>
        </div>
        <div>
          <div style={{ color: '#00ff88', fontSize: 13, fontFamily: 'monospace', marginBottom: 4, textAlign: 'center' }}>
            XP {xpClamped} / {xpNeeded}
          </div>
          <div style={{ height: 10, background: '#002211', borderRadius: 5, overflow: 'hidden', border: '1px solid #005533' }}>
            <div style={{
              height: '100%', width: `${xpPct}%`,
              background: 'linear-gradient(90deg, #00aa55, #00ff88)',
              borderRadius: 5, transition: 'width 0.15s',
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}
