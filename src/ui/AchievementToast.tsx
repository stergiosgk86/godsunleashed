import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'

export function AchievementToast() {
  const recentAchievement = useGameStore(s => s.recentAchievement)
  const clearRecentAchievement = useGameStore(s => s.clearRecentAchievement)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!recentAchievement) return
    setVisible(true)
    const t = window.setTimeout(() => {
      setVisible(false)
      window.setTimeout(clearRecentAchievement, 400)
    }, 3500)
    return () => clearTimeout(t)
  }, [recentAchievement, clearRecentAchievement])

  if (!recentAchievement) return null

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%',
      transform: `translateX(-50%) translateY(${visible ? 0 : 40}px)`,
      opacity: visible ? 1 : 0,
      transition: 'transform 0.35s ease, opacity 0.35s ease',
      zIndex: 1000,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a3a 0%, #0d0d22 100%)',
        border: '2px solid #6644cc',
        borderRadius: 10,
        padding: '12px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        boxShadow: '0 0 30px rgba(100,68,200,0.5), 0 4px 20px rgba(0,0,0,0.6)',
        minWidth: 220,
      }}>
        <div style={{
          color: '#aaaacc', fontFamily: 'monospace', fontSize: 9,
          letterSpacing: 4, textTransform: 'uppercase',
        }}>
          Achievement Unlocked
        </div>
        <div style={{
          color: '#ddccff', fontFamily: 'monospace', fontSize: 15,
          fontWeight: 'bold', letterSpacing: 2,
          textShadow: '0 0 12px rgba(180,150,255,0.7)',
        }}>
          {recentAchievement.name}
        </div>
      </div>
    </div>
  )
}
