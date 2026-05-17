import { useEffect, useRef } from 'react'
import { minimapData } from '../game/minimapData'

const WALL_FRAC = 64 / 4000

export function Minimap() {
  const isMobile = window.innerWidth <= 768
  const SIZE = isMobile ? 110 : 180
  const PADDING = isMobile ? 6 : 12
  const topOffset = isMobile ? 128 : PADDING
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let animId: number

    function draw() {
      const { playerX, playerY, enemies, remotePlayers, worldSize } = minimapData
      const scale = SIZE / worldSize
      const W = Math.round(WALL_FRAC * SIZE)

      ctx.clearRect(0, 0, SIZE, SIZE)

      // Wall area
      ctx.fillStyle = '#060610'
      ctx.fillRect(0, 0, SIZE, SIZE)

      // Play area
      ctx.fillStyle = '#0b0b1e'
      ctx.fillRect(W, W, SIZE - W * 2, SIZE - W * 2)

      // Faint grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      for (let i = 1; i < 4; i++) {
        const p = (SIZE / 4) * i
        ctx.beginPath(); ctx.moveTo(p, W); ctx.lineTo(p, SIZE - W); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(W, p); ctx.lineTo(SIZE - W, p); ctx.stroke()
      }

      // Wall inner edge
      ctx.strokeStyle = 'rgba(68, 85, 200, 0.45)'
      ctx.lineWidth = 1
      ctx.strokeRect(W + 0.5, W + 0.5, SIZE - W * 2 - 1, SIZE - W * 2 - 1)

      // Enemies
      for (const e of enemies) {
        const ex = e.x * scale
        const ey = e.y * scale
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
        const rx = rp.x * scale
        const ry = rp.y * scale
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

      // Player pulsing ring
      const px = playerX * scale
      const py = playerY * scale
      const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 500)
      ctx.strokeStyle = `rgba(0,210,255,${pulse})`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(px, py, 7 + pulse * 3, 0, Math.PI * 2); ctx.stroke()

      // Player dot
      ctx.shadowColor = '#00ddff'; ctx.shadowBlur = 10
      ctx.fillStyle = '#00eeff'
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0

      // Player crosshair
      ctx.strokeStyle = 'rgba(0,220,255,0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px - 8, py); ctx.lineTo(px - 4, py)
      ctx.moveTo(px + 4, py); ctx.lineTo(px + 8, py)
      ctx.moveTo(px, py - 8); ctx.lineTo(px, py - 4)
      ctx.moveTo(px, py + 4); ctx.lineTo(px, py + 8)
      ctx.stroke()

      // Scan lines
      ctx.fillStyle = 'rgba(0,0,0,0.07)'
      for (let y = 0; y < SIZE; y += 3) ctx.fillRect(0, y, SIZE, 1)

      // Corner brackets
      const B = 10
      ctx.strokeStyle = '#5566aa'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(B, 1);        ctx.lineTo(1, 1);        ctx.lineTo(1, B)
      ctx.moveTo(SIZE-B, 1);   ctx.lineTo(SIZE-1, 1);   ctx.lineTo(SIZE-1, B)
      ctx.moveTo(B, SIZE-1);   ctx.lineTo(1, SIZE-1);   ctx.lineTo(1, SIZE-B)
      ctx.moveTo(SIZE-B,SIZE-1);ctx.lineTo(SIZE-1,SIZE-1);ctx.lineTo(SIZE-1,SIZE-B)
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
        MAP
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
