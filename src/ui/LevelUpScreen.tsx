import { useEffect, useRef } from 'react'
import { useGameStore, type Upgrade, type UpgradeId } from '../store/gameStore'

const KEYFRAMES = `
@keyframes lu-in    { from { opacity:0 } to { opacity:1 } }
@keyframes lu-flash { from { opacity:0.65 } to { opacity:0 } }
@keyframes lu-label {
  0%   { opacity:0; transform:scale(0.3) translateY(-30px); filter:brightness(8); }
  60%  { transform:scale(1.12) translateY(0); filter:brightness(2.5); }
  100% { opacity:1; transform:scale(1); filter:brightness(1); }
}
@keyframes lu-number {
  0%   { opacity:0; transform:scale(0.1); }
  70%  { transform:scale(1.18); }
  100% { opacity:1; transform:scale(1); }
}
@keyframes lu-card {
  0%   { opacity:0; transform:translateY(60px) scale(0.8); }
  100% { opacity:1; transform:translateY(0) scale(1); }
}
@keyframes lu-hint  { from { opacity:0 } to { opacity:1 } }
`

// Returns { current, max } for pip display. max=0 → no pips shown.
function upgradeLevel(id: UpgradeId, s: ReturnType<typeof useGameStore.getState>): { current: number; max: number } {
  switch (id) {
    case 'wand':             return { current: s.wand ? 1 : 0,         max: 1 }
    case 'piercing':         return { current: s.piercing ? 1 : 0,     max: 1 }
    case 'boomerang':        return { current: s.boomerang ? 1 : 0,    max: 1 }
    case 'flameTrail':       return { current: s.flameTrail ? 1 : 0,   max: 1 }
    case 'bloodNova':        return { current: s.bloodNova ? 1 : 0,    max: 1 }
    case 'vampiric':         return { current: s.vampiric ? 1 : 0,     max: 1 }
    case 'lightning':        return { current: s.lightning ? 1 : 0,    max: 1 }
    case 'axe':              return { current: s.axe ? 1 : 0,          max: 1 }
    case 'aura':             return { current: s.aura > 0 ? 1 : 0,     max: 1 }
    case 'divineShield':     return { current: s.divineShield ? 1 : 0, max: 1 }
    case 'equinox':          return { current: s.equinox ? 1 : 0,      max: 1 }
    case 'solstice':         return { current: s.solstice ? 1 : 0,     max: 1 }
    case 'multiShot':        return { current: s.multiShot,            max: 3 }
    case 'orbital':          return { current: s.orbital,              max: 5 }
    case 'orbSpeed':         return { current: s.orbSpeed,             max: 3 }
    case 'orbPower':         return { current: s.orbPower,             max: 3 }
    case 'orbRange':         return { current: s.orbRange,             max: 2 }
    case 'bloodNovaCD':      return { current: s.bloodNovaCD,          max: 4 }
    case 'lightningTargets': return { current: s.lightningTargets,     max: 2 }
    case 'lightningCooldown':return { current: s.lightningCooldown,    max: 2 }
    case 'might':            return { current: Math.min(5, Math.round((s.might - 1) / 0.1)), max: 5 }
    case 'auraTick':         return { current: s.auraTick,             max: 3 }
    case 'auraRange':        return { current: s.auraRange,            max: 3 }
    case 'xpGain':           return { current: s.xpGain,              max: 5 }
    case 'magnetRange':      return { current: s.magnetRange,          max: 3 }
    case 'dualGunDamage':    return { current: s.dualGunDamage,        max: 3 }
    case 'dualGunSpeed':     return { current: s.dualGunSpeed,         max: 2 }
    case 'dualGunExtra':     return { current: s.dualGunExtra,         max: 2 }
    case 'echo':             return { current: s.echo,                 max: 2 }
    default:                 return { current: 0,                      max: 0 }
  }
}

export function LevelUpScreen() {
  const isLevelUpPending = useGameStore(s => s.isLevelUpPending)
  const upgradeChoices   = useGameStore(s => s.upgradeChoices)
  const level            = useGameStore(s => s.level)
  const chooseUpgrade    = useGameStore(s => s.chooseUpgrade)

  if (!isLevelUpPending) return null
  return <LevelUpOverlay level={level} choices={upgradeChoices} onChoose={chooseUpgrade} />
}

function LevelUpOverlay({ level, choices, onChoose }: {
  level: number
  choices: Upgrade[]
  onChoose: (id: UpgradeId) => void
}) {
  const isMobile = window.innerWidth <= 768
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gs = useGameStore.getState()

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    const W = canvas.width, H = canvas.height

    const COLORS = ['#ffdd44','#ffcc33','#ffffff','#ccaaff','#ffaa55','#aabbff']
    type P = { x:number; y:number; vx:number; vy:number; r:number; alpha:number; color:string }

    const particles: P[] = Array.from({ length: 70 }, () => ({
      x:     Math.random() * W,
      y:     H * (0.3 + Math.random() * 0.7),
      vx:    (Math.random() - 0.5) * 0.7,
      vy:    -(0.5 + Math.random() * 1.5),
      r:     0.8 + Math.random() * 2.5,
      alpha: 0.4 + Math.random() * 0.6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))

    let animId: number
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.alpha -= 0.003
        if (p.alpha <= 0 || p.y < -10) {
          p.y = H + p.r
          p.x = Math.random() * W
          p.alpha = 0.5 + Math.random() * 0.5
        }
        ctx.globalAlpha = p.alpha
        ctx.shadowColor = p.color
        ctx.shadowBlur  = p.r * 3
        ctx.fillStyle   = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur  = 0
      animId = requestAnimationFrame(draw)
    }
    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      animation: 'lu-in 0.25s ease-out both',
    }}>
      <style>{KEYFRAMES}</style>

      {/* Layered background glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: [
          'radial-gradient(ellipse 35% 28% at 50% 38%, rgba(140,90,15,0.45) 0%, transparent 100%)',
          'radial-gradient(ellipse 75% 65% at 50% 50%, rgba(65,35,175,0.55) 0%, transparent 75%)',
          'rgba(0,0,0,0.88)',
        ].join(', '),
      }} />

      {/* Floating particles */}
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, pointerEvents:'none' }} />

      {/* Entry flash */}
      <div style={{
        position: 'absolute', inset: 0, background: '#ffffff', pointerEvents: 'none',
        animation: 'lu-flash 0.5s ease-out both',
      }} />

      {/* Title + hint */}
      <div style={{
        flex: isMobile ? 'none' : 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: isMobile ? 8 : 24,
        padding: isMobile ? '20px 0 12px' : undefined,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            color: '#ffdd44', fontSize: 22, fontFamily: 'monospace',
            letterSpacing: 8, marginBottom: isMobile ? 4 : 12,
            textShadow: '0 0 14px #ffaa00, 0 0 36px #ff7700, 0 0 70px #ff4400',
            animation: 'lu-label 0.65s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            LEVEL UP
          </div>
          <div style={{
            color: '#ffffff', fontSize: isMobile ? 72 : 130,
            fontFamily: 'monospace', fontWeight: 'bold', lineHeight: 1,
            textShadow: '0 0 22px rgba(180,160,255,0.95), 0 0 60px rgba(120,80,255,0.55)',
            animation: 'lu-number 0.55s cubic-bezier(0.34,1.56,0.64,1) 80ms both',
          }}>
            {level}
          </div>
        </div>

        <div style={{
          color: '#7777aa', fontFamily: 'monospace',
          fontSize: isMobile ? 14 : 20, letterSpacing: 2,
          animation: 'lu-hint 0.4s ease-out 360ms both',
        }}>
          choose an upgrade
        </div>
      </div>

      {/* Cards */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: isMobile ? 'center' : 'flex-start',
        justifyContent: 'center',
        position: 'relative', zIndex: 1,
        width: '100%',
        overflowY: isMobile ? 'auto' : 'visible',
        padding: isMobile ? '0 0 16px' : undefined,
        boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 12 : 20,
          alignItems: 'stretch',
          width: isMobile ? '85%' : 'auto',
        }}>
          {choices.map((u, i) => {
            const { current, max } = upgradeLevel(u.id, gs)
            return (
              <div key={u.id} style={{
                display: 'flex',
                animation: `lu-card 0.5s cubic-bezier(0.34,1.56,0.64,1) ${360 + i * 110}ms both`,
              }}>
                <UpgradeCard
                  label={u.label}
                  description={u.description}
                  mobile={isMobile}
                  current={current}
                  max={max}
                  onClick={() => onChoose(u.id)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function UpgradeCard({ label, description, mobile, current, max, onClick }: {
  label: string; description: string; mobile?: boolean
  current: number; max: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: mobile ? '100%' : 190,
        padding: mobile ? '16px 20px' : '28px 20px 20px',
        height: '100%', boxSizing: 'border-box',
        background: '#0d0d2e', border: '2px solid #3333aa',
        borderRadius: 14, color: '#ffffff', fontFamily: 'monospace',
        cursor: 'pointer', display: 'flex', flexDirection: 'column',
        gap: 12, textAlign: 'center', alignItems: 'center', justifyContent: 'center',
        transition: 'border-color 0.15s, background 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = '#7777ff'
        el.style.background  = '#16163a'
        el.style.transform   = 'scale(1.05)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = '#3333aa'
        el.style.background  = '#0d0d2e'
        el.style.transform   = 'scale(1)'
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 'bold', color: '#aaddff' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#888888', lineHeight: 1.4, flex: 1 }}>{description}</span>
      {max > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 4 }}>
          {max > 1 && (
            <span style={{ fontSize: 10, color: '#ffdd44', letterSpacing: 2, fontFamily: 'monospace' }}>
              LV. {current + 1} / {max}
            </span>
          )}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {Array.from({ length: max }, (_, i) => {
              const filled = i < current
              const gaining = i === current
              return (
                <div key={i} style={{
                  width: gaining ? 10 : 8,
                  height: gaining ? 10 : 8,
                  borderRadius: '50%',
                  background: filled ? '#6688cc' : gaining ? '#ffdd44' : 'transparent',
                  border: `2px solid ${filled ? '#6688cc' : gaining ? '#ffdd44' : '#334466'}`,
                  boxShadow: gaining ? '0 0 6px #ffdd44' : 'none',
                  transition: 'all 0.15s',
                }} />
              )
            })}
          </div>
        </div>
      )}
    </button>
  )
}
