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
  online?: boolean
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

function formatLastActive(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  if (isToday) return `Today ${time}`
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
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

function ConfirmDeleteAccountModal({ player, onConfirm, onCancel }: {
  player: PlayerRow
  onConfirm: () => void
  onCancel: () => void
}) {
  const label = player.username ?? `#${player.id}`
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10, borderRadius: 'inherit',
    }}>
      <div style={{
        background: '#0d0000', border: '2px solid #ff0000',
        borderRadius: 10, padding: '28px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        boxShadow: '0 0 60px #ff000099',
        minWidth: 320,
      }}>
        <div style={{ color: '#ff0000', fontSize: 15, fontFamily: 'monospace', letterSpacing: 2, fontWeight: 'bold' }}>
          !! DELETE ACCOUNT !!
        </div>
        <div style={{ color: '#ccccff', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.8 }}>
          Permanently delete <span style={{ color: '#ff4444', fontWeight: 'bold' }}>{label}</span>.<br />
          This removes the account, all runs,<br />
          upgrades, coins, and achievements.<br />
          <span style={{ color: '#ff2222', fontWeight: 'bold' }}>This cannot be undone.</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '6px 20px', fontSize: 11, fontFamily: 'monospace',
              color: '#ff0000', background: 'transparent',
              border: '1px solid #880000', borderRadius: 5,
              cursor: 'pointer', letterSpacing: 1,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#440000'
              e.currentTarget.style.borderColor = '#ff0000'
              e.currentTarget.style.color = '#ff6666'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#880000'
              e.currentTarget.style.color = '#ff0000'
            }}
          >
            DELETE
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

function ConfirmFullResetModal({ player, onConfirm, onCancel }: {
  player: PlayerRow
  onConfirm: () => void
  onCancel: () => void
}) {
  const label = player.username ?? `#${player.id}`
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10, borderRadius: 'inherit',
    }}>
      <div style={{
        background: '#0d0d1a', border: '2px solid #ff2200',
        borderRadius: 10, padding: '28px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        boxShadow: '0 0 40px #ff220077',
        minWidth: 300,
      }}>
        <div style={{ color: '#ff4400', fontSize: 14, fontFamily: 'monospace', letterSpacing: 2, fontWeight: 'bold' }}>
          !! FULL PROGRESS RESET !!
        </div>
        <div style={{ color: '#ccccff', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.8 }}>
          Wipe <span style={{ color: '#ff8866', fontWeight: 'bold' }}>ALL</span> progress for{' '}
          <span style={{ color: '#aaaaff', fontWeight: 'bold' }}>{label}</span>:<br />
          coins · upgrades · characters · stages<br />
          weapons · achievements · runs
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '6px 20px', fontSize: 11, fontFamily: 'monospace',
              color: '#ff4400', background: 'transparent',
              border: '1px solid #661100', borderRadius: 5,
              cursor: 'pointer', letterSpacing: 1,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#3a0800'
              e.currentTarget.style.borderColor = '#ff4400'
              e.currentTarget.style.color = '#ff8866'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#661100'
              e.currentTarget.style.color = '#ff4400'
            }}
          >
            NUKE IT
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

type DetailAction = 'reset' | 'giveCoins' | 'clearRuns' | 'stages' | 'fullReset' | 'delete' | 'roleToggle'

function PlayerDetailModal({ player, isOnline, myRole, playerOnlineAt, onClose, onAction }: {
  player: PlayerRow
  isOnline: boolean
  myRole: string | null
  playerOnlineAt: Record<number, string>
  onClose: () => void
  onAction: (action: DetailAction) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const liveAt = playerOnlineAt[player.id]
  const iso = liveAt && (!player.last_active || liveAt > player.last_active) ? liveAt : player.last_active
  const lastActive = iso ? formatLastActive(iso) : '—'

  function Btn({ color, border, hoverBg, onClick, children, fullWidth }: {
    color: string; border: string; hoverBg: string
    onClick: () => void; children: React.ReactNode; fullWidth?: boolean
  }) {
    const [hov, setHov] = useState(false)
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          gridColumn: fullWidth ? '1 / -1' : undefined,
          padding: '9px 12px', fontSize: 11, fontFamily: 'monospace', letterSpacing: 1,
          color, background: hov ? hoverBg : 'transparent',
          border: `1px solid ${hov ? color : border}`, borderRadius: 6,
          cursor: 'pointer', textAlign: 'center',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {children}
      </button>
    )
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 15, borderRadius: 'inherit',
      }}
    >
      <div style={{
        background: '#0d0d1a', border: '1px solid #2a2a50',
        borderRadius: 12, padding: '22px 24px',
        width: 370, display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 0 40px rgba(80,80,200,0.15)',
      }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isOnline && (
              <span style={{
                width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                background: '#44ff88', boxShadow: '0 0 8px #44ff88',
                animation: 'online-pulse 1.6s ease-in-out infinite',
              }} />
            )}
            <span style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: 15, fontWeight: 'bold' }}>
              {player.username ?? '—'}
            </span>
            {player.role === 'admin' && (
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#88ff88', border: '1px solid #336633', borderRadius: 3, padding: '1px 4px', letterSpacing: 1 }}>ADMIN</span>
            )}
            {player.role === 'super_admin' && (
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#ff8844', border: '1px solid #664422', borderRadius: 3, padding: '1px 4px', letterSpacing: 1 }}>OWNER</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#333355', fontFamily: 'monospace', fontSize: 11 }}>#{player.id}</span>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#555577', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 2, fontFamily: 'monospace' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#aaaaff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555577')}
            >✕</button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#555577', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 }}>COINS</span>
            <span style={{ color: '#ffcc44', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold' }}>
              {(player.coins ?? 0).toLocaleString()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {UPGRADE_KEYS.map((k, i) => {
              const rank = player.upgrades?.[k] ?? 0
              return (
                <span key={k} style={{
                  fontFamily: 'monospace', fontSize: 10,
                  color: rank >= 5 ? '#44ff88' : rank > 0 ? '#aaaaff' : '#333355',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${rank >= 5 ? '#224422' : rank > 0 ? '#2a2a44' : '#1a1a2a'}`,
                  borderRadius: 4, padding: '2px 7px',
                }}>
                  {UPGRADE_LABELS[i]}&thinsp;{rank}
                </span>
              )
            })}
          </div>
          <div style={{ color: '#333355', fontFamily: 'monospace', fontSize: 10, textAlign: 'right', marginTop: 2 }}>
            Last active: <span style={{ color: '#555577' }}>{lastActive}</span>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Btn color="#ffcc44" border="#443300" hoverBg="#2a1a00" onClick={() => onAction('giveCoins')}>
            💰 Give Coins
          </Btn>
          <Btn color="#88ccff" border="#223344" hoverBg="#001a2a" onClick={() => onAction('stages')}>
            🔓 Stage Access
          </Btn>
          <Btn color="#ff8888" border="#442222" hoverBg="#2a0000" onClick={() => onAction('reset')}>
            ↺ Reset Stats
          </Btn>
          <Btn color="#44ff88" border="#224422" hoverBg="#002a00" onClick={() => onAction('clearRuns')}>
            ✕ Clear LB
          </Btn>
          {player.role !== 'super_admin' && (
            <Btn
              color={player.role === 'admin' ? '#ffaa44' : '#88ff88'}
              border={player.role === 'admin' ? '#443322' : '#336633'}
              hoverBg={player.role === 'admin' ? '#2a1800' : '#002a00'}
              fullWidth
              onClick={() => onAction('roleToggle')}
            >
              {player.role === 'admin' ? '⬇ Revoke Admin' : '⬆ Grant Admin'}
            </Btn>
          )}
        </div>

        {/* ── Danger zone ── */}
        {myRole === 'super_admin' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: -4 }}>
              <div style={{ flex: 1, height: 1, background: '#1a0a0a' }} />
              <span style={{ color: '#442222', fontFamily: 'monospace', fontSize: 9, letterSpacing: 2 }}>DANGER ZONE</span>
              <div style={{ flex: 1, height: 1, background: '#1a0a0a' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: -8 }}>
              <Btn color="#ff6622" border="#441100" hoverBg="#2a0800" onClick={() => onAction('fullReset')}>
                ☠ Full Reset
              </Btn>
              {player.role !== 'super_admin' ? (
                <Btn color="#ff2222" border="#660000" hoverBg="#2a0000" onClick={() => onAction('delete')}>
                  🗑 Delete Acct
                </Btn>
              ) : <div />}
            </div>
          </>
        )}

      </div>
    </div>
  )
}

export function AdminPlayersView({ onBack }: { onBack: () => void }) {
  const token = useAuthStore(s => s.token)
  const myId = useAuthStore(s => s.userId)
  const myRole = useAuthStore(s => s.role)
  const fetchProfile = useProfileStore(s => s.fetchProfile)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<PlayerRow | null>(null)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<PlayerRow | null>(null)
  const [confirmClearRuns, setConfirmClearRuns] = useState<PlayerRow | null>(null)
  const [confirmFullReset, setConfirmFullReset] = useState<PlayerRow | null>(null)
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

  const onlineUserIds = useAuthStore(s => s.onlineUserIds)
  const playerOnlineAt = useAuthStore(s => s.playerOnlineAt)
  const players = useAuthStore(s => s.adminPlayerRows)

  useEffect(() => {
    fetch('/api/admin/players', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: { players: PlayerRow[] }) => {
        useAuthStore.getState().setAdminPlayerRows(d.players)
        setLoading(false)
        useAuthStore.getState().seedOnlineUsers(d.players.filter(p => p.online).map(p => p.id))
      })
      .catch(() => { setFetchError('Failed to load'); setLoading(false) })
  }, [token])

  async function executeGiveCoins(p: PlayerRow, amount: number) {
    setGiveCoinsTarget(null)
    try {
      const res = await fetch(`/api/admin/players/${p.id}/coins`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      useAuthStore.getState().patchAdminPlayerRow(p.id, { coins: data.coins })
      if (p.id === myId) void fetchProfile()
      showToast(`+${amount} coins granted to ${p.username ?? `#${p.id}`}`, '#ffcc44')
    } catch {
      showToast('Failed to give coins', '#ff4444')
    }
  }

  async function executeClearRuns(p: PlayerRow) {
    setConfirmClearRuns(null)
    try {
      const res = await fetch(`/api/admin/players/${p.id}/runs`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      showToast(`Leaderboard cleared for ${p.username ?? `#${p.id}`}`, '#44ff88')
    } catch {
      showToast('Failed to clear runs', '#ff4444')
    }
  }

  async function executeReset(p: PlayerRow) {
    setConfirmTarget(null)
    try {
      const res = await fetch(`/api/admin/players/${p.id}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const emptyUpgrades = Object.fromEntries(UPGRADE_KEYS.map(k => [k, 0]))
      useAuthStore.getState().patchAdminPlayerRow(p.id, { coins: 0, upgrades: emptyUpgrades })
      if (p.id === myId) void fetchProfile()
      showToast(`${p.username ?? `#${p.id}`} has been reset`, '#ffcc44')
    } catch {
      showToast('Failed to reset player', '#ff4444')
    }
  }

  async function executeFullReset(p: PlayerRow) {
    setConfirmFullReset(null)
    try {
      const res = await fetch(`/api/admin/players/${p.id}/full-reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const emptyUpgrades = Object.fromEntries(UPGRADE_KEYS.map(k => [k, 0]))
      useAuthStore.getState().patchAdminPlayerRow(p.id, { coins: 0, upgrades: emptyUpgrades, unlocked_stages: [] })
      if (p.id === myId) void fetchProfile()
      showToast(`Full reset done for ${p.username ?? `#${p.id}`}`, '#ff8866')
    } catch {
      showToast('Failed to full-reset player', '#ff4444')
    }
  }

  async function executeDeleteAccount(p: PlayerRow) {
    setConfirmDeleteAccount(null)
    try {
      const res = await fetch(`/api/admin/players/${p.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      useAuthStore.getState().setAdminPlayerRows(
        useAuthStore.getState().adminPlayerRows.filter(r => r.id !== p.id)
      )
      showToast(`${p.username ?? `#${p.id}`} deleted`, '#ff4444')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to delete account', '#ff4444')
    }
  }

  async function executeRoleChange(p: PlayerRow) {
    const grant = p.role !== 'admin'
    setRoleTarget(null)
    try {
      const res = await fetch(`/api/admin/players/${p.id}/role`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: grant ? 'admin' : null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      useAuthStore.getState().patchAdminPlayerRow(p.id, { role: data.role })
      showToast(
        grant ? `${p.username ?? `#${p.id}`} is now an admin` : `Admin revoked from ${p.username ?? `#${p.id}`}`,
        grant ? '#88ff88' : '#ffaa44',
      )
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to change role', '#ff4444')
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
      useAuthStore.getState().patchAdminPlayerRow(p.id, { unlocked_stages: updatedStages })
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

  function handleDetailAction(p: PlayerRow, action: DetailAction) {
    setSelectedPlayer(null)
    switch (action) {
      case 'reset':      setConfirmTarget(p);       break
      case 'giveCoins':  setGiveCoinsTarget(p);     break
      case 'clearRuns':  setConfirmClearRuns(p);    break
      case 'stages':     setStageTarget(p);         break
      case 'fullReset':  setConfirmFullReset(p);    break
      case 'delete':     setConfirmDeleteAccount(p);break
      case 'roleToggle': setRoleTarget(p);          break
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <style>{`@keyframes online-pulse { 0%,100%{opacity:1;box-shadow:0 0 6px #44ff88} 50%{opacity:.4;box-shadow:0 0 2px #44ff88} }`}</style>
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

      {/* ── Player detail modal ── */}
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          isOnline={onlineUserIds.has(selectedPlayer.id)}
          myRole={myRole}
          playerOnlineAt={playerOnlineAt}
          onClose={() => setSelectedPlayer(null)}
          onAction={action => handleDetailAction(selectedPlayer, action)}
        />
      )}

      {/* ── Confirm modals ── */}
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
      {confirmFullReset && (
        <ConfirmFullResetModal
          player={confirmFullReset}
          onConfirm={() => executeFullReset(confirmFullReset)}
          onCancel={() => setConfirmFullReset(null)}
        />
      )}
      {confirmDeleteAccount && (
        <ConfirmDeleteAccountModal
          player={confirmDeleteAccount}
          onConfirm={() => executeDeleteAccount(confirmDeleteAccount)}
          onCancel={() => setConfirmDeleteAccount(null)}
        />
      )}

      <div style={{
        color: '#ff4444', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 3, textShadow: '0 0 10px #ff2222',
        marginBottom: 8, textAlign: 'center',
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
                <tr
                  key={p.id}
                  onClick={() => setSelectedPlayer(p)}
                  onMouseEnter={() => setHoveredRow(p.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    background: hoveredRow === p.id ? '#151528' : 'transparent',
                    transition: 'background 0.1s',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ ...tdStyle, textAlign: 'left', color: '#555577' }}>{p.id}</td>
                  <td style={{ ...tdStyle, textAlign: 'left', color: '#aaaaff' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {onlineUserIds.has(p.id) && (
                        <span style={{
                          display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                          background: '#44ff88', marginRight: 6, flexShrink: 0,
                          boxShadow: '0 0 6px #44ff88',
                          animation: 'online-pulse 1.6s ease-in-out infinite',
                        }} />
                      )}
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
                    </div>
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
                    {(() => {
                      const liveAt = playerOnlineAt[p.id]
                      const iso = liveAt && (!p.last_active || liveAt > p.last_active) ? liveAt : p.last_active
                      return iso ? formatLastActive(iso) : '—'
                    })()}
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
        style={{
          width: 'calc((100% - 12px) / 3)', padding: '7px 0', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold',
          border: '1px solid #4444cc', borderRadius: 6, cursor: 'pointer', letterSpacing: 2,
          color: '#aaaaff', background: '#0d0d1f', boxShadow: 'none', marginTop: 8,
          position: 'sticky', bottom: 0, display: 'block', margin: '8px auto 0',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
        onMouseLeave={e => (e.currentTarget.style.background = '#0d0d1f')}
      >
        ← BACK
      </button>
    </div>
  )
}
