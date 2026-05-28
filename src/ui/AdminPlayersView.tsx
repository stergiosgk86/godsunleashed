import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'

export interface PlayerRow {
  id: number
  username: string | null
  role: string | null
  created_at: string
  coins: number | null
  upgrades: Record<string, number> | null
  last_active: string | null
  unlocked_stages: number[] | null
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

function formatLastActive(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${dd}/${mm}/${yy} ${time}`
}

function ConfirmResetModal({ player, onConfirm, onCancel }: {
  player: PlayerRow
  onConfirm: () => void
  onCancel: () => void
}) {
  const label = player.username ?? `#${player.id}`
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10, borderRadius: 'inherit',
    }}>
      <div style={{
        background: '#0d0d1a', border: '2px solid #442222',
        borderRadius: 10, padding: '28px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        boxShadow: '0 0 30px #ff222255',
        minWidth: 260,
      }}>
        <div style={{ color: '#ff4444', fontSize: 14, fontFamily: 'monospace', letterSpacing: 2, fontWeight: 'bold' }}>
          RESET PLAYER
        </div>
        <div style={{ color: '#ccccff', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.6 }}>
          Reset coins and all upgrade ranks<br />
          to <span style={{ color: '#ff8888', fontWeight: 'bold' }}>0</span> for{' '}
          <span style={{ color: '#aaaaff', fontWeight: 'bold' }}>{label}</span>?
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '6px 20px', fontSize: 11, fontFamily: 'monospace',
              color: '#ff4444', background: 'transparent',
              border: '1px solid #442222', borderRadius: 5,
              cursor: 'pointer', letterSpacing: 1,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#3a0000'
              e.currentTarget.style.borderColor = '#ff4444'
              e.currentTarget.style.color = '#ff8888'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#442222'
              e.currentTarget.style.color = '#ff4444'
            }}
          >
            CONFIRM
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 20px', fontSize: 11, fontFamily: 'monospace',
              color: '#aaaaff', background: 'transparent',
              border: '1px solid #2a2a50', borderRadius: 5,
              cursor: 'pointer', letterSpacing: 1,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#111133'
              e.currentTarget.style.borderColor = '#aaaaff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#2a2a50'
            }}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmClearRunsModal({ player, onConfirm, onCancel }: {
  player: PlayerRow
  onConfirm: () => void
  onCancel: () => void
}) {
  const label = player.username ?? `#${player.id}`
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10, borderRadius: 'inherit',
    }}>
      <div style={{
        background: '#0d0d1a', border: '2px solid #224422',
        borderRadius: 10, padding: '28px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        boxShadow: '0 0 30px #22ff2255',
        minWidth: 260,
      }}>
        <div style={{ color: '#44ff88', fontSize: 14, fontFamily: 'monospace', letterSpacing: 2, fontWeight: 'bold' }}>
          CLEAR LEADERBOARD
        </div>
        <div style={{ color: '#ccccff', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.6 }}>
          Delete <span style={{ color: '#ff8888', fontWeight: 'bold' }}>all runs</span> for{' '}
          <span style={{ color: '#aaaaff', fontWeight: 'bold' }}>{label}</span>?<br />
          This removes them from the leaderboard.
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '6px 20px', fontSize: 11, fontFamily: 'monospace',
              color: '#44ff88', background: 'transparent',
              border: '1px solid #224422', borderRadius: 5,
              cursor: 'pointer', letterSpacing: 1,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#003a00'
              e.currentTarget.style.borderColor = '#44ff88'
              e.currentTarget.style.color = '#88ffaa'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#224422'
              e.currentTarget.style.color = '#44ff88'
            }}
          >
            CONFIRM
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 20px', fontSize: 11, fontFamily: 'monospace',
              color: '#aaaaff', background: 'transparent',
              border: '1px solid #2a2a50', borderRadius: 5,
              cursor: 'pointer', letterSpacing: 1,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#111133'
              e.currentTarget.style.borderColor = '#aaaaff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#2a2a50'
            }}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}

function GiveCoinsModal({ player, onConfirm, onCancel }: {
  player: PlayerRow
  onConfirm: (amount: number) => void
  onCancel: () => void
}) {
  const [raw, setRaw] = useState('')
  const label = player.username ?? `#${player.id}`
  const amount = parseInt(raw, 10)
  const valid = Number.isInteger(amount) && amount > 0 && amount <= 5_000_000

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10, borderRadius: 'inherit',
    }}>
      <div style={{
        background: '#0d0d1a', border: '2px solid #443300',
        borderRadius: 10, padding: '28px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        boxShadow: '0 0 30px #ffcc4455',
        minWidth: 280,
      }}>
        <div style={{ color: '#ffcc44', fontSize: 14, fontFamily: 'monospace', letterSpacing: 2, fontWeight: 'bold' }}>
          GIVE COINS
        </div>
        <div style={{ color: '#ccccff', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.6 }}>
          Add coins to{' '}
          <span style={{ color: '#aaaaff', fontWeight: 'bold' }}>{label}</span>
        </div>
        <input
          type="number"
          min={1}
          max={5000000}
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder="Amount"
          autoFocus
          style={{
            width: 140, padding: '6px 10px',
            fontSize: 13, fontFamily: 'monospace', textAlign: 'center',
            background: '#0a0a18', border: '1px solid #443300', borderRadius: 5,
            color: '#ffcc44', outline: 'none',
          }}
          onKeyDown={e => { if (e.key === 'Enter' && valid) onConfirm(amount) }}
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onConfirm(amount)}
            style={{
              padding: '6px 20px', fontSize: 11, fontFamily: 'monospace',
              color: valid ? '#ffcc44' : '#665500', background: 'transparent',
              border: `1px solid ${valid ? '#443300' : '#221800'}`, borderRadius: 5,
              cursor: valid ? 'pointer' : 'default', letterSpacing: 1,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              if (!valid) return
              e.currentTarget.style.background = '#3a2400'
              e.currentTarget.style.borderColor = '#ffcc44'
              e.currentTarget.style.color = '#ffe088'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = valid ? '#443300' : '#221800'
              e.currentTarget.style.color = valid ? '#ffcc44' : '#665500'
            }}
          >
            GIVE
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 20px', fontSize: 11, fontFamily: 'monospace',
              color: '#aaaaff', background: 'transparent',
              border: '1px solid #2a2a50', borderRadius: 5,
              cursor: 'pointer', letterSpacing: 1,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#111133'
              e.currentTarget.style.borderColor = '#aaaaff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#2a2a50'
            }}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmRoleModal({ player, grant, onConfirm, onCancel }: {
  player: PlayerRow
  grant: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const label = player.username ?? `#${player.id}`
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10, borderRadius: 'inherit',
    }}>
      <div style={{
        background: '#0d0d1a', border: `2px solid ${grant ? '#334433' : '#443322'}`,
        borderRadius: 10, padding: '28px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        boxShadow: `0 0 30px ${grant ? '#44ff8855' : '#ff884455'}`,
        minWidth: 260,
      }}>
        <div style={{ color: grant ? '#88ff88' : '#ffaa44', fontSize: 14, fontFamily: 'monospace', letterSpacing: 2, fontWeight: 'bold' }}>
          {grant ? 'GRANT ADMIN' : 'REVOKE ADMIN'}
        </div>
        <div style={{ color: '#ccccff', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.6 }}>
          {grant
            ? <>{`Give `}<span style={{ color: '#aaaaff', fontWeight: 'bold' }}>{label}</span>{` access to the in-game admin panel?`}</>
            : <>{`Remove admin access from `}<span style={{ color: '#aaaaff', fontWeight: 'bold' }}>{label}</span>{`?`}</>
          }
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button type="button" onClick={onConfirm} style={{
            padding: '6px 20px', fontSize: 11, fontFamily: 'monospace',
            color: grant ? '#88ff88' : '#ffaa44', background: 'transparent',
            border: `1px solid ${grant ? '#334433' : '#443322'}`, borderRadius: 5,
            cursor: 'pointer', letterSpacing: 1,
          }}>CONFIRM</button>
          <button type="button" onClick={onCancel} style={{
            padding: '6px 20px', fontSize: 11, fontFamily: 'monospace',
            color: '#aaaaff', background: 'transparent',
            border: '1px solid #2a2a50', borderRadius: 5,
            cursor: 'pointer', letterSpacing: 1,
          }}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

const STAGE_DEFS = [
  { num: 2, name: 'Underworld Depths' },
]

function StageUnlockModal({ player, onToggle, toggling, onClose }: {
  player: PlayerRow
  onToggle: (stage: number, unlock: boolean) => void
  toggling: boolean
  onClose: () => void
}) {
  const label = player.username ?? `#${player.id}`
  const unlockedStages = player.unlocked_stages ?? []
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10, borderRadius: 'inherit',
    }}>
      <div style={{
        background: '#0d0d1a', border: '2px solid #334455',
        borderRadius: 10, padding: '24px 28px',
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: '0 0 30px #4488aa55', minWidth: 300,
      }}>
        <div style={{ color: '#88ccff', fontSize: 14, fontFamily: 'monospace', letterSpacing: 2, fontWeight: 'bold' }}>
          STAGE ACCESS
        </div>
        <div style={{ color: '#8888aa', fontSize: 12, fontFamily: 'monospace' }}>
          Player: <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STAGE_DEFS.map(({ num, name }) => {
            const unlocked = unlockedStages.includes(num)
            return (
              <div key={num} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 12px',
                border: `1px solid ${unlocked ? 'rgba(60,160,80,0.35)' : 'rgba(80,80,120,0.3)'}`,
              }}>
                <div>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#ccccff', fontWeight: 'bold' }}>Stage {num}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#555577', marginLeft: 8 }}>{name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: 1, color: unlocked ? '#44ff88' : '#664444' }}>
                    {unlocked ? 'UNLOCKED' : 'LOCKED'}
                  </span>
                  <button
                    type="button"
                    disabled={toggling}
                    onClick={() => onToggle(num, !unlocked)}
                    style={{
                      padding: '3px 10px', fontSize: 10, fontFamily: 'monospace',
                      color: unlocked ? '#ffaa44' : '#44ff88', background: 'transparent',
                      border: `1px solid ${unlocked ? '#443322' : '#224422'}`, borderRadius: 4,
                      cursor: toggling ? 'default' : 'pointer',
                      opacity: toggling ? 0.4 : 1, letterSpacing: 1,
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (toggling) return
                      e.currentTarget.style.background = unlocked ? '#3a2000' : '#003a00'
                    }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {unlocked ? 'REVOKE' : 'UNLOCK'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '6px 0', fontSize: 11, fontFamily: 'monospace',
            color: '#aaaaff', background: 'transparent',
            border: '1px solid #2a2a50', borderRadius: 5,
            cursor: 'pointer', letterSpacing: 1,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          CLOSE
        </button>
      </div>
    </div>
  )
}

export function AdminPlayersView({ onBack }: { onBack: () => void }) {
  const token = useAuthStore(s => s.token)
  const myId = useAuthStore(s => s.userId)
  const fetchProfile = useProfileStore(s => s.fetchProfile)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [resetting, setResetting] = useState<Set<number>>(new Set())
  const [clearingRuns, setClearingRuns] = useState<Set<number>>(new Set())
  const [givingCoins, setGivingCoins] = useState<Set<number>>(new Set())
  const [togglingRole, setTogglingRole] = useState<Set<number>>(new Set())
  const [confirmTarget, setConfirmTarget] = useState<PlayerRow | null>(null)
  const [confirmClearRuns, setConfirmClearRuns] = useState<PlayerRow | null>(null)
  const [giveCoinsTarget, setGiveCoinsTarget] = useState<PlayerRow | null>(null)
  const [roleTarget, setRoleTarget] = useState<PlayerRow | null>(null)
  const [stageTarget, setStageTarget] = useState<PlayerRow | null>(null)
  const [togglingStage, setTogglingStage] = useState(false)
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string, color: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, color })
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    fetch('/api/admin/players', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: { players: PlayerRow[] }) => { setPlayers(d.players); setLoading(false) })
      .catch(() => { setFetchError('Failed to load'); setLoading(false) })
  }, [token])

  async function executeGiveCoins(p: PlayerRow, amount: number) {
    setGiveCoinsTarget(null)
    setGivingCoins(prev => new Set(prev).add(p.id))
    try {
      const res = await fetch(`/api/admin/players/${p.id}/coins`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPlayers(prev => prev.map(row =>
        row.id === p.id ? { ...row, coins: data.coins } : row
      ))
      if (p.id === myId) void fetchProfile()
      showToast(`+${amount} coins granted to ${p.username ?? `#${p.id}`}`, '#ffcc44')
    } catch {
      showToast('Failed to give coins', '#ff4444')
    } finally {
      setGivingCoins(prev => { const next = new Set(prev); next.delete(p.id); return next })
    }
  }

  async function executeClearRuns(p: PlayerRow) {
    setConfirmClearRuns(null)
    setClearingRuns(prev => new Set(prev).add(p.id))
    try {
      const res = await fetch(`/api/admin/players/${p.id}/runs`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      showToast(`Leaderboard cleared for ${p.username ?? `#${p.id}`}`, '#44ff88')
    } catch {
      showToast('Failed to clear runs', '#ff4444')
    } finally {
      setClearingRuns(prev => { const next = new Set(prev); next.delete(p.id); return next })
    }
  }

  async function executeReset(p: PlayerRow) {
    setConfirmTarget(null)
    setResetting(prev => new Set(prev).add(p.id))
    try {
      const res = await fetch(`/api/admin/players/${p.id}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const emptyUpgrades = Object.fromEntries(UPGRADE_KEYS.map(k => [k, 0]))
      setPlayers(prev => prev.map(row =>
        row.id === p.id ? { ...row, coins: 0, upgrades: emptyUpgrades } : row
      ))
      if (p.id === myId) void fetchProfile()
      showToast(`${p.username ?? `#${p.id}`} has been reset`, '#ffcc44')
    } catch {
      showToast('Failed to reset player', '#ff4444')
    } finally {
      setResetting(prev => { const next = new Set(prev); next.delete(p.id); return next })
    }
  }

  async function executeRoleChange(p: PlayerRow) {
    const grant = p.role !== 'admin'
    setRoleTarget(null)
    setTogglingRole(prev => new Set(prev).add(p.id))
    try {
      const res = await fetch(`/api/admin/players/${p.id}/role`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: grant ? 'admin' : null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPlayers(prev => prev.map(row =>
        row.id === p.id ? { ...row, role: data.role } : row
      ))
      showToast(
        grant ? `${p.username ?? `#${p.id}`} is now an admin` : `Admin revoked from ${p.username ?? `#${p.id}`}`,
        grant ? '#88ff88' : '#ffaa44',
      )
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to change role', '#ff4444')
    } finally {
      setTogglingRole(prev => { const next = new Set(prev); next.delete(p.id); return next })
    }
  }

  async function executeToggleStage(p: PlayerRow, stage: number, unlock: boolean) {
    setTogglingStage(true)
    try {
      const res = await fetch(`/api/admin/players/${p.id}/stages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, unlock }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const updatedStages: number[] = data.unlocked_stages ?? []
      setPlayers(prev => prev.map(row =>
        row.id === p.id ? { ...row, unlocked_stages: updatedStages } : row
      ))
      setStageTarget(prev => prev?.id === p.id ? { ...prev, unlocked_stages: updatedStages } : prev)
      showToast(
        unlock
          ? `Stage ${stage} unlocked for ${p.username ?? `#${p.id}`}`
          : `Stage ${stage} revoked from ${p.username ?? `#${p.id}`}`,
        unlock ? '#44ff88' : '#ffaa44',
      )
    } catch {
      showToast('Failed to update stage access', '#ff4444')
    } finally {
      setTogglingStage(false)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {toast && (
        <div style={{
          position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, pointerEvents: 'none',
          background: '#0d0d1a', border: `1.5px solid ${toast.color}`,
          borderRadius: 8, padding: '8px 20px',
          color: toast.color, fontFamily: 'monospace', fontSize: 12, letterSpacing: 1,
          boxShadow: `0 0 16px ${toast.color}55`,
          whiteSpace: 'nowrap',
          animation: 'fadeInDown 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}
      {confirmTarget && (
        <ConfirmResetModal
          player={confirmTarget}
          onConfirm={() => executeReset(confirmTarget)}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
      {confirmClearRuns && (
        <ConfirmClearRunsModal
          player={confirmClearRuns}
          onConfirm={() => executeClearRuns(confirmClearRuns)}
          onCancel={() => setConfirmClearRuns(null)}
        />
      )}
      {giveCoinsTarget && (
        <GiveCoinsModal
          player={giveCoinsTarget}
          onConfirm={(amount) => executeGiveCoins(giveCoinsTarget, amount)}
          onCancel={() => setGiveCoinsTarget(null)}
        />
      )}
      {roleTarget && (
        <ConfirmRoleModal
          player={roleTarget}
          grant={roleTarget.role !== 'admin'}
          onConfirm={() => executeRoleChange(roleTarget)}
          onCancel={() => setRoleTarget(null)}
        />
      )}
      {stageTarget && (
        <StageUnlockModal
          player={stageTarget}
          onToggle={(stage, unlock) => executeToggleStage(stageTarget, stage, unlock)}
          toggling={togglingStage}
          onClose={() => setStageTarget(null)}
        />
      )}

      <div style={{
        color: '#ff4444', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 3, textShadow: '0 0 10px #ff2222',
        marginBottom: 8,
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
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ ...tdStyle, color: '#444466', padding: 20 }}>No players</td>
                </tr>
              ) : players.map(p => (
                <tr
                  key={p.id}
                  onMouseEnter={() => setHoveredRow(p.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ background: hoveredRow === p.id ? '#151528' : 'transparent', transition: 'background 0.1s' }}
                >
                  <td style={{ ...tdStyle, textAlign: 'left', color: '#555577' }}>{p.id}</td>
                  <td style={{ ...tdStyle, textAlign: 'left', color: '#aaaaff' }}>
                    {p.username ?? '—'}
                    {p.role === 'admin' && (
                      <span style={{
                        marginLeft: 6, fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold',
                        color: '#88ff88', border: '1px solid #336633', borderRadius: 3,
                        padding: '1px 4px', letterSpacing: 1,
                      }}>ADMIN</span>
                    )}
                    {p.role === 'super_admin' && (
                      <span style={{
                        marginLeft: 6, fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold',
                        color: '#ff8844', border: '1px solid #664422', borderRadius: 3,
                        padding: '1px 4px', letterSpacing: 1,
                      }}>OWNER</span>
                    )}
                  </td>
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
                    {p.last_active ? formatLastActive(p.last_active) : '—'}
                  </td>
                  <td style={{ ...tdStyle, display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                    <button
                      type="button"
                      disabled={resetting.has(p.id)}
                      onClick={() => setConfirmTarget(p)}
                      style={{
                        padding: '2px 8px', fontSize: 10, fontFamily: 'monospace',
                        color: '#ff4444', background: 'transparent',
                        border: '1px solid #442222', borderRadius: 4,
                        cursor: resetting.has(p.id) ? 'default' : 'pointer',
                        opacity: resetting.has(p.id) ? 0.4 : 1,
                        letterSpacing: 1,
                        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (resetting.has(p.id)) return
                        e.currentTarget.style.background = '#3a0000'
                        e.currentTarget.style.borderColor = '#ff4444'
                        e.currentTarget.style.color = '#ff8888'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = '#442222'
                        e.currentTarget.style.color = '#ff4444'
                      }}
                    >
                      RESET
                    </button>
                    <button
                      type="button"
                      disabled={givingCoins.has(p.id)}
                      onClick={() => setGiveCoinsTarget(p)}
                      style={{
                        padding: '2px 8px', fontSize: 10, fontFamily: 'monospace',
                        color: '#ffcc44', background: 'transparent',
                        border: '1px solid #443300', borderRadius: 4,
                        cursor: givingCoins.has(p.id) ? 'default' : 'pointer',
                        opacity: givingCoins.has(p.id) ? 0.4 : 1,
                        letterSpacing: 1,
                        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (givingCoins.has(p.id)) return
                        e.currentTarget.style.background = '#3a2400'
                        e.currentTarget.style.borderColor = '#ffcc44'
                        e.currentTarget.style.color = '#ffe088'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = '#443300'
                        e.currentTarget.style.color = '#ffcc44'
                      }}
                    >
                      COINS
                    </button>
                    <button
                      type="button"
                      disabled={clearingRuns.has(p.id)}
                      onClick={() => setConfirmClearRuns(p)}
                      style={{
                        padding: '2px 8px', fontSize: 10, fontFamily: 'monospace',
                        color: '#44ff88', background: 'transparent',
                        border: '1px solid #224422', borderRadius: 4,
                        cursor: clearingRuns.has(p.id) ? 'default' : 'pointer',
                        opacity: clearingRuns.has(p.id) ? 0.4 : 1,
                        letterSpacing: 1,
                        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (clearingRuns.has(p.id)) return
                        e.currentTarget.style.background = '#003a00'
                        e.currentTarget.style.borderColor = '#44ff88'
                        e.currentTarget.style.color = '#88ffaa'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = '#224422'
                        e.currentTarget.style.color = '#44ff88'
                      }}
                    >
                      CLR LB
                    </button>
                    <button
                      type="button"
                      onClick={() => setStageTarget(p)}
                      style={{
                        padding: '2px 8px', fontSize: 10, fontFamily: 'monospace',
                        color: '#88ccff', background: 'transparent',
                        border: '1px solid #223344', borderRadius: 4,
                        cursor: 'pointer', letterSpacing: 1,
                        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#001a2a'
                        e.currentTarget.style.borderColor = '#88ccff'
                        e.currentTarget.style.color = '#aaddff'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = '#223344'
                        e.currentTarget.style.color = '#88ccff'
                      }}
                    >
                      STAGES
                    </button>
                    {p.role !== 'super_admin' && (
                      <button
                        type="button"
                        disabled={togglingRole.has(p.id)}
                        onClick={() => setRoleTarget(p)}
                        style={{
                          padding: '2px 8px', fontSize: 10, fontFamily: 'monospace',
                          color: p.role === 'admin' ? '#ffaa44' : '#88ff88', background: 'transparent',
                          border: `1px solid ${p.role === 'admin' ? '#443322' : '#336633'}`, borderRadius: 4,
                          cursor: togglingRole.has(p.id) ? 'default' : 'pointer',
                          opacity: togglingRole.has(p.id) ? 0.4 : 1,
                          letterSpacing: 1,
                          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => {
                          if (togglingRole.has(p.id)) return
                          e.currentTarget.style.background = p.role === 'admin' ? '#3a2000' : '#003a00'
                        }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        {p.role === 'admin' ? 'REVOKE' : 'ADMIN'}
                      </button>
                    )}
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
    </div>
  )
}
