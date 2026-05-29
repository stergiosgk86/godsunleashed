import { useEffect, useRef } from 'react'
import { minimapData } from '../game/minimapData'

// World-space radius visible on the minimap — enemies outside are clipped
const RADAR_RANGE = 1400

export function Minimap() {
  const isMobile = window.innerWidth <= 768
  if (isMobile) return null
  const SIZE    = isMobile ? 80 : 180
  const PADDING = isMobile ? 6 : 12
  const topOffset = isMobile ? 128 : PADDING
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let animId: number

    function draw() {
      const { playerX, playerY, enemies, remotePlayers } = minimapData
      const scale = SIZE / (RADAR_RANGE * 2)
      const cx = SIZE / 2
      const cy = SIZE / 2

      ctx.clearRect(0, 0, SIZE, SIZE)

      // Background
      ctx.fillStyle = '#0b0b1e'
      ctx.fillRect(0, 0, SIZE, SIZE)

      // Radar range rings
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      for (let r = 0.25; r <= 1; r += 0.25) {
        ctx.beginPath()
        ctx.arc(cx, cy, (SIZE / 2) * r, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Cardinal cross-hairs
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx, 0); ctx.lineTo(cx, SIZE)
      ctx.moveTo(0, cy); ctx.lineTo(SIZE, cy)
      ctx.stroke()

      // Enemies
      for (const e of enemies) {
        const ex = cx + (e.x - playerX) * scale
        const ey = cy + (e.y - playerY) * scale
        if (ex < 0 || ex > SIZE || ey < 0 || ey > SIZE) continue
        if (e.isBoss) {
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200)
          ctx.strokeStyle = `rgba(255,120,0,${pulse})`
          ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.stroke()
          ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 8
          ctx.fillStyle = '#ffaa00'
          ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI * 2); ctx.fill()
          ctx.shadowBlur = 0
        } else {
          ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 4
          ctx.fillStyle = '#ff4444'
          ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2); ctx.fill()
          ctx.shadowBlur = 0
        }
      }

      // Remote players (teammates)
      for (const rp of remotePlayers) {
        const rx = cx + (rp.x - playerX) * scale
        const ry = cy + (rp.y - playerY) * scale
        if (rx < 0 || rx > SIZE || ry < 0 || ry > SIZE) continue
        ctx.shadowColor = '#44ff88'; ctx.shadowBlur = 8
        ctx.fillStyle = '#44ff88'
        ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
        ctx.strokeStyle = 'rgba(68,255,136,0.7)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(rx - 7, ry); ctx.lineTo(rx - 3, ry)
        ctx.moveTo(rx + 3, ry); ctx.lineTo(rx + 7, ry)
        ctx.moveTo(rx, ry - 7); ctx.lineTo(rx, ry - 3)
        ctx.moveTo(rx, ry + 3); ctx.lineTo(rx, ry + 7)
        ctx.stroke()
      }

      // Player always at centre — pulsing ring
      const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 500)
      ctx.strokeStyle = `rgba(0,210,255,${pulse})`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, 7 + pulse * 3, 0, Math.PI * 2); ctx.stroke()

      // Player dot
      ctx.shadowColor = '#00ddff'; ctx.shadowBlur = 10
      ctx.fillStyle = '#00eeff'
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0

      // Player crosshair
      ctx.strokeStyle = 'rgba(0,220,255,0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx - 8, cy); ctx.lineTo(cx - 4, cy)
      ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 8, cy)
      ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy - 4)
      ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 8)
      ctx.stroke()

      // Scan lines
      ctx.fillStyle = 'rgba(0,0,0,0.07)'
      for (let y = 0; y < SIZE; y += 3) ctx.fillRect(0, y, SIZE, 1)

      // Corner brackets
      const B = 10
      ctx.strokeStyle = '#5566aa'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(B, 1);         ctx.lineTo(1, 1);         ctx.lineTo(1, B)
      ctx.moveTo(SIZE - B, 1);  ctx.lineTo(SIZE - 1, 1);  ctx.lineTo(SIZE - 1, B)
      ctx.moveTo(B, SIZE - 1);  ctx.lineTo(1, SIZE - 1);  ctx.lineTo(1, SIZE - B)
      ctx.moveTo(SIZE - B, SIZE - 1); ctx.lineTo(SIZE - 1, SIZE - 1); ctx.lineTo(SIZE - 1, SIZE - B)
      ctx.stroke()

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div style={{ position: 'absolute', top: topOffset, right: PADDING, pointerEvents: 'none' }}>
      <div style={{
        color: '#6677bb', fontSize: 9, fontFamily: 'monospace',
        letterSpacing: 3, marginBottom: 4, textAlign: 'right',
        textShadow: '0 0 6px rgba(100,120,220,0.6)',
      }}>
        RADAR
      </div>
      <div style={{
        padding: 2,
        background: 'rgba(8,10,32,0.6)',
        borderRadius: 3,
        border: '1px solid rgba(80,100,180,0.35)',
        boxShadow: '0 0 20px rgba(50,70,180,0.2), 0 0 6px rgba(80,100,200,0.35)',
      }}>
        <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ display: 'block', borderRadius: 1 }} />
      </div>
    </div>
  )
}
