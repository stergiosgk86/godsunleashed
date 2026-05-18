import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

export interface PlayerRow {
  id: number
  username: string | null
  created_at: string
  coins: number | null
  upgrades: Record<string, number> | null
  last_active: string | null
}

const UPGRADE_KEYS = ['maxHealth', 'recovery', 'magnet', 'might', 'luck', 'growth', 'moveSpeed'] as const
const UPGRADE_LABELS = ['HP', 'Rec', 'Mag', 'Mgt', 'Luck', 'Grow', 'Spd']

const thStyle: React.CSSProperties = {
  color: '#8888aa', fontSize: 11, fontFamily: 'monospace', letterSpacing: 1,
  padding: '6px 10px', textAlign: 'center', borderBottom: '1px solid #222244',
  whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  color: '#ccccff', fontSize: 12, fontFamily: 'monospace',
  padding: '5px 10px', textAlign: 'center', borderBottom: '1px solid #111133',
}
const backBtn: React.CSSProperties = {
  width: '100%', padding: '12px 0',
  fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
  border: '2px solid #2a2a50', borderRadius: 8,
  cursor: 'pointer', letterSpacing: 2,
  color: '#aaaaff', background: 'transparent',
  marginTop: 8,
}

export function AdminPlayersView({ onBack }: { onBack: () => void }) {
  const token = useAuthStore(s => s.token)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/players', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: { players: PlayerRow[] }) => { setPlayers(d.players); setLoading(false) })
      .catch(() => { setFetchError('Failed to load'); setLoading(false) })
  }, [token])

  return (
    <>
      <div style={{
        color: '#ff4444', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 3, textShadow: '0 0 10px #ff2222',
      }}>
        PLAYERS
      </div>

      <div style={{ maxWidth: '88vw', overflowX: 'auto', width: '100%' }}>
        {loading && (
          <div style={{ color: '#8888aa', fontFamily: 'monospace', textAlign: 'center', padding: 20 }}>
            Loading...
          </div>
        )}
        {fetchError && (
          <div style={{ color: '#ff4444', fontFamily: 'monospace', textAlign: 'center', padding: 20 }}>
            {fetchError}
          </div>
        )}
        {!loading && !fetchError && (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>#</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>User</th>
                <th style={thStyle}>Coins</th>
                {UPGRADE_LABELS.map(l => <th key={l} style={thStyle}>{l}</th>)}
                <th style={thStyle}>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ ...tdStyle, color: '#444466', padding: 20 }}>No players</td>
                </tr>
              ) : players.map(p => (
                <tr key={p.id}>
                  <td style={{ ...tdStyle, textAlign: 'left', color: '#555577' }}>{p.id}</td>
                  <td style={{ ...tdStyle, textAlign: 'left', color: '#aaaaff' }}>{p.username ?? '—'}</td>
                  <td style={{ ...tdStyle, color: '#ffcc44' }}>{p.coins ?? 0}</td>
                  {UPGRADE_KEYS.map(k => {
                    const rank = p.upgrades?.[k] ?? 0
                    return (
                      <td key={k} style={{ ...tdStyle, color: rank >= 5 ? '#44ff88' : '#ccccff' }}>
                        {rank}
                      </td>
                    )
                  })}
                  <td style={{ ...tdStyle, color: '#555577', fontSize: 11 }}>
                    {p.last_active ? new Date(p.last_active).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        style={backBtn}
        onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {'<-'} BACK
      </button>
    </>
  )
}
