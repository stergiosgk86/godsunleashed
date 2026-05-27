import { useEffect, useState } from 'react'
import { useGameStore, weaponBaseDamage } from '../store/gameStore'
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
      position: 'absolute', top: window.innerWidth <= 768 ? 8 : 16, left: window.innerWidth <= 768 ? 60 : 16,
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
  const level       = useGameStore(s => s.level)
  const might       = useGameStore(s => s.might)
  const moveSpeed   = useGameStore(s => s.moveSpeed)
  const attackInterval = useGameStore(s => s.attackInterval)
  const hpRegen     = useGameStore(s => s.hpRegen)
  const sessionCoins = useGameStore(s => s.sessionCoins)
  const multiShot   = useGameStore(s => s.multiShot)
  const piercing    = useGameStore(s => s.piercing)
  const aura        = useGameStore(s => s.aura)
  const orbital     = useGameStore(s => s.orbital)
  const boomerang   = useGameStore(s => s.boomerang)
  const flameTrail  = useGameStore(s => s.flameTrail)
  const bloodNova   = useGameStore(s => s.bloodNova)

  const dmg = Math.floor(weaponBaseDamage(level) * might)
  const aps = (1000 / attackInterval).toFixed(2)

  const hasWeapons = multiShot > 0 || piercing || aura > 0 || orbital > 0 || boomerang || flameTrail || bloodNova

  return (
    <div style={{
      position: 'absolute', top: window.innerWidth <= 768 ? 128 : 72, left: 16,
      background: '#05050faa',
      border: '1px solid #1a1a33',
      borderRadius: 6, padding: '7px 10px',
      display: 'flex', flexDirection: 'column', gap: 4,
      minWidth: 140,
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
          {multiShot > 0  && <WeaponChip label="MULTI SHOT"  detail={`×${multiShot + 1}`}          color="#88aaff" />}
          {piercing        && <WeaponChip label="PIERCING"                                           color="#44ccff" />}
          {aura > 0        && <WeaponChip label="AURA"        detail={`${'●'.repeat(Math.min(aura, 5))}${aura > 5 ? `+${aura - 5}` : ''}`} color="#aa55ff" />}
          {orbital > 0     && <WeaponChip label="SPIRIT ORB"  detail={`×${orbital}`}                color="#cc88ff" />}
          {boomerang        && <WeaponChip label="BOOMERANG"                                         color="#ffcc44" />}
          {flameTrail       && <WeaponChip label="FLAME TRAIL"                                       color="#ff6633" />}
          {bloodNova        && <WeaponChip label="BLOOD NOVA"                                        color="#ff3333" />}
        </>
      )}
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
      <LeftPanel />

      <div style={{
        position: 'absolute', bottom: 0, left: '50%',
        transform: 'translateX(-50%)', width: window.innerWidth <= 768 ? 240 : 320,
        paddingBottom: window.innerWidth <= 768 ? 72 : 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <DashIndicator />
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
