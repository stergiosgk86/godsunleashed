import { useGameStore } from '../store/gameStore'

export function BossHPBar() {
  const bossHp           = useGameStore(s => s.bossHp)
  const bossMaxHp        = useGameStore(s => s.bossMaxHp)
  const bossInvulnerable = useGameStore(s => s.bossInvulnerable)

  if (bossHp === null) return null

  const pct     = Math.max(0, bossHp / bossMaxHp) * 100
  const isPhase2 = bossHp < bossMaxHp * 0.5
  const isMobile = window.innerWidth <= 768

  const barColor    = bossInvulnerable
    ? 'linear-gradient(90deg, #004466, #00aaff)'
    : isPhase2
      ? 'linear-gradient(90deg, #880000, #ff2222)'
      : 'linear-gradient(90deg, #aa5500, #ffaa00)'

  const borderColor = bossInvulnerable ? '#00aaff' : isPhase2 ? '#ff4444' : '#aa6600'
  const glowColor   = bossInvulnerable ? '#0088ff44' : isPhase2 ? '#ff000066' : '#ffaa0044'
  const labelColor  = bossInvulnerable ? '#00aaff' : isPhase2 ? '#ff4444' : '#ffaa00'
  const textShadow  = `0 0 12px ${bossInvulnerable ? '#0088ff' : isPhase2 ? '#ff0000' : '#ffaa00'}`

  const label = bossInvulnerable
    ? '\u{1F6E1} SHIELDED'
    : isPhase2 ? '⚠ BOSS — PHASE 2' : 'BOSS'

  return (
    <div style={{
      position: 'absolute',
      top: isMobile ? 54 : 56,
      left: '50%',
      transform: 'translateX(-50%)',
      width: isMobile ? 260 : 400,
      zIndex: 5,
      pointerEvents: 'none',
    }}>
      <div style={{
        color: labelColor,
        fontSize: 13,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        letterSpacing: 3,
        textAlign: 'center',
        marginBottom: 6,
        textShadow,
      }}>
        {label}
      </div>
      <div style={{
        height: 18,
        background: '#1a0000',
        borderRadius: 9,
        overflow: 'hidden',
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 12px ${glowColor}`,
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: barColor,
          borderRadius: 9,
          transition: 'width 0.1s',
        }} />
      </div>
      <div style={{
        color: '#888888',
        fontSize: 11,
        fontFamily: 'monospace',
        textAlign: 'center',
        marginTop: 4,
      }}>
        {bossHp} / {bossMaxHp}
      </div>
    </div>
  )
}
