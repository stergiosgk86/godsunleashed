import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'

function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth <= 600)
  useEffect(() => {
    const fn = () => setMob(window.innerWidth <= 600)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mob
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', boxSizing: 'border-box',
  background: '#060612', border: '2px solid #2a2a55', borderRadius: 6,
  color: '#ffffff', fontFamily: 'monospace', fontSize: 14, outline: 'none',
}

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const mob = useIsMobile()

  const setAuth = useAuthStore(s => s.setAuth)
  const fetchProfile = useProfileStore(s => s.fetchProfile)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setAuth(data.token, data.userId, data.username)
      await fetchProfile()
      onAuthenticated()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #0d0d22 0%, #07070f 100%)',
      padding: '16px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        color: '#cc3333', fontSize: mob ? 26 : 48, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: mob ? 4 : 8, textShadow: '0 0 30px #ff2222, 0 0 70px #880000',
        marginBottom: 8, textAlign: 'center',
      }}>
        GODS UNLEASHED
      </div>
      <div style={{
        color: '#3a3a66', fontSize: 11, fontFamily: 'monospace', letterSpacing: mob ? 4 : 6,
        marginBottom: mob ? 24 : 40,
      }}>
        SURVIVE THE DIVINE
      </div>

      <div style={{
        background: '#0d0d1f', border: '2px solid #2a2a55', borderRadius: 12,
        padding: mob ? '24px 20px' : '36px 48px',
        width: mob ? '100%' : 360,
        maxWidth: mob ? 400 : undefined,
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 0 40px #11115544',
      }}>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #2a2a55' }}>
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError('') }}
              style={{
                flex: 1, padding: '8px 0', border: 'none',
                background: mode === m ? '#1a1a55' : 'transparent',
                color: mode === m ? '#aaaaff' : '#444466',
                fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold',
                letterSpacing: 2, cursor: 'pointer',
              }}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            style={inputStyle}
          />

          {error && (
            <div style={{ color: '#cc4444', fontFamily: 'monospace', fontSize: 12, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 0', marginTop: 4,
              background: loading ? '#0a0a30' : '#1e1e88',
              border: '2px solid #4444cc', borderRadius: 8,
              color: loading ? '#444466' : '#ffffff',
              fontFamily: 'monospace', fontSize: 15, fontWeight: 'bold',
              letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 0 16px #2222aa66',
            }}
          >
            {loading ? '...' : mode === 'login' ? 'LOGIN' : 'REGISTER'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: '#1a1a3a' }} />
          <span style={{ color: '#333355', fontFamily: 'monospace', fontSize: 11 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: '#1a1a3a' }} />
        </div>

        <a
          href="/auth/google"
          style={{
            display: 'block', textAlign: 'center',
            padding: '11px 0',
            background: 'transparent', border: '2px solid #2a2a55', borderRadius: 8,
            color: '#8888aa', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold',
            letterSpacing: 2, textDecoration: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#4444aa'; e.currentTarget.style.color = '#aaaadd' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a55'; e.currentTarget.style.color = '#8888aa' }}
        >
          SIGN IN WITH GOOGLE
        </a>
      </div>
    </div>
  )
}
