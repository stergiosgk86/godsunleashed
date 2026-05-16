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
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

      {/* Top half: title + hint */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
        position: 'relative', zIndex: 1,
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            color: '#ffdd44', fontSize: 22, fontFamily: 'monospace',
            letterSpacing: 8, marginBottom: 12,
            textShadow: '0 0 14px #ffaa00, 0 0 36px #ff7700, 0 0 70px #ff4400',
            animation: 'lu-label 0.65s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            LEVEL UP
          </div>
          <div style={{
            color: '#ffffff', fontSize: 130, fontFamily: 'monospace', fontWeight: 'bold', lineHeight: 1,
            textShadow: '0 0 22px rgba(180,160,255,0.95), 0 0 60px rgba(120,80,255,0.55)',
            animation: 'lu-number 0.55s cubic-bezier(0.34,1.56,0.64,1) 80ms both',
          }}>
            {level}
          </div>
        </div>

        {/* Hint */}
        <div style={{
          color: '#7777aa', fontFamily: 'monospace', fontSize: 20, letterSpacing: 2,
          animation: 'lu-hint 0.4s ease-out 360ms both',
        }}>
          choose an upgrade
        </div>
      </div>

      {/* Bottom half: cards */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
          {choices.map((u, i) => (
            <div key={u.id} style={{
              display: 'flex',
              animation: `lu-card 0.5s cubic-bezier(0.34,1.56,0.64,1) ${360 + i * 110}ms both`,
            }}>
              <UpgradeCard label={u.label} description={u.description} onClick={() => onChoose(u.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function UpgradeCard({ label, description, onClick }: {
  label: string; description: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 190, padding: '28px 20px', height: '100%', boxSizing: 'border-box',
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
      <span style={{ fontSize: 13, color: '#888888', lineHeight: 1.4 }}>{description}</span>
    </button>
  )
}
