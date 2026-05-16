import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { runData, RUN_DURATION } from '../game/runData'

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
      transform: 'translateX(-50%)', width: 260,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        color: warning ? '#ff4444' : '#aaaacc',
        fontSize: 16, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 3, padding: '6px 0 4px',
        textShadow: warning ? '0 0 10px #ff0000' : 'none',
        animation: warning ? 'none' : 'none',
      }}>
        {fmt(elapsed)} <span style={{ color: '#333355', fontSize: 12 }}>/ {fmt(RUN_DURATION)}</span>
      </div>
      <div style={{ width: '100%', height: 4, background: '#0a0a1a', borderRadius: 2 }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`,
          background: warning
            ? 'linear-gradient(90deg, #aa0000, #ff4444)'
            : 'linear-gradient(90deg, #2244aa, #4488ff)',
          borderRadius: 2, transition: 'background 0.5s',
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

function AuraIndicator() {
  const aura = useGameStore(s => s.aura)
  if (aura === 0) return null

  const pips = Math.min(aura, 5)
  const extra = aura > 5 ? aura - 5 : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#aa55ff', fontSize: 11, fontFamily: 'monospace', letterSpacing: 1, width: 36 }}>
        AURA
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {Array.from({ length: pips }).map((_, i) => (
          <span key={i} style={{ color: '#aa55ff', fontSize: 12, textShadow: '0 0 6px #9933ff' }}>●</span>
        ))}
        {extra > 0 && (
          <span style={{ color: '#aa55ff', fontSize: 10, fontFamily: 'monospace' }}>+{extra}</span>
        )}
      </div>
    </div>
  )
}

export function HUD() {
  const hp = useGameStore(s => s.hp)
  const maxHp = useGameStore(s => s.maxHp)
  const xp = useGameStore(s => s.xp)
  const xpNeeded = useGameStore(s => s.xpNeeded)
  const level = useGameStore(s => s.level)
  const sessionCoins = useGameStore(s => s.sessionCoins)

  const hpPct = (hp / maxHp) * 100
  const xpPct = (xp / xpNeeded) * 100

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <TimerDisplay />

      <div style={{
        position: 'absolute', top: 16, left: 16,
        color: '#ffffff', fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
        textShadow: '0 0 8px #4444ff',
      }}>
        LVL {level}
      </div>

      <div style={{
        position: 'absolute', top: 44, left: 16,
        color: '#ccaa22', fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold',
        textShadow: '0 0 6px #886600',
      }}>
        ◈ {sessionCoins}
      </div>

      <div style={{
        position: 'absolute', bottom: 112, left: '50%',
        transform: 'translateX(-50%)', width: 320,
      }}>
        <AuraIndicator />
      </div>

      <div style={{
        position: 'absolute', bottom: 80, left: '50%',
        transform: 'translateX(-50%)', width: 320,
      }}>
        <DashIndicator />
      </div>

      <div style={{
        position: 'absolute', bottom: 48, left: '50%',
        transform: 'translateX(-50%)', width: 320,
      }}>
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

      <div style={{
        position: 'absolute', bottom: 16, left: '50%',
        transform: 'translateX(-50%)', width: 320,
      }}>
        <div style={{ color: '#00ff88', fontSize: 13, fontFamily: 'monospace', marginBottom: 4, textAlign: 'center' }}>
          XP {xp} / {xpNeeded}
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
  )
}
