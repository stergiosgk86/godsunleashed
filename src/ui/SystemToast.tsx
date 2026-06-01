import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'

export function SystemToast() {
  const toast = useAuthStore(s => s.systemToast)
  const clearSystemToast = useAuthStore(s => s.clearSystemToast)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const t = window.setTimeout(() => {
      setVisible(false)
      window.setTimeout(clearSystemToast, 400)
    }, 4000)
    return () => clearTimeout(t)
  }, [toast, clearSystemToast])

  if (!toast) return null

  return (
    <div style={{
      position: 'fixed', top: 24, right: 24,
      transform: `translateY(${visible ? 0 : -20}px)`,
      opacity: visible ? 1 : 0,
      transition: 'transform 0.35s ease, opacity 0.35s ease',
      zIndex: 1000,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0d1a0d 0%, #0a120a 100%)',
        border: `2px solid ${toast.color}`,
        borderRadius: 10,
        padding: '12px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        boxShadow: `0 0 30px ${toast.color}55, 0 4px 20px rgba(0,0,0,0.6)`,
        minWidth: 240,
      }}>
        <div style={{
          color: '#aaaacc', fontFamily: 'monospace', fontSize: 9,
          letterSpacing: 4, textTransform: 'uppercase',
        }}>
          Admin
        </div>
        <div style={{
          color: toast.color, fontFamily: 'monospace', fontSize: 14,
          fontWeight: 'bold', letterSpacing: 1, textAlign: 'center',
          textShadow: `0 0 12px ${toast.color}99`,
        }}>
          {toast.message}
        </div>
      </div>
    </div>
  )
}
