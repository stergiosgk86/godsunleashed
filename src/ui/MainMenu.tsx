import { useState, useRef, useEffect, useCallback } from 'react'

function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth <= 600)
  useEffect(() => {
    const fn = () => setMob(window.innerWidth <= 600)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mob
}
import { useProfileStore, UPGRADE_COSTS, UPGRADE_MAX_RANK, CHARACTER_UNLOCK_COSTS, CHARACTER_ACHIEVEMENT_REQUIRED, type MetaUpgrades } from '../store/profileStore'
import { useAuthStore } from '../store/authStore'
import { useCharacterStore } from '../store/characterStore'
import { ALL_CHARACTERS, CHARACTER_DEFS } from '../game/characters'
import { SPRITE_URLS } from '../game/assets'
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from '../game/achievements'
import { AdminPlayersView } from './AdminPlayersView'
import { ControlsView } from './ControlsView'
import { SoundsView } from './SoundsView'

const CHAR_SPRITE_URL: Record<string, string> = {
  player:          SPRITE_URLS.player,
  char_rogue:      SPRITE_URLS.charRogue,
  char_witch:      SPRITE_URLS.charWitch,
  char_shade:      SPRITE_URLS.charShade,
  char_zeus:       SPRITE_URLS.charZeus,
  char_ares:       SPRITE_URLS.charAres,
  char_poseidon:   SPRITE_URLS.charPoseidon,
  char_apollo:     SPRITE_URLS.charApollo,
  char_hades:      SPRITE_URLS.charHades,
}

const SCALE = 2
const FRAME_W = 32 * SCALE
const FRAME_H = 32 * SCALE
const SHEET_W = 96 * SCALE
const SHEET_H = 128 * SCALE

function CharSprite({ spriteKey, color, menuFrame, menuRow, compact, staticSprite }: {
  spriteKey: string
  color: string
  menuFrame?: { fw: number; fh: number; sw: number; sh: number }
  menuRow?: number
  compact?: boolean
  staticSprite?: boolean
}) {
  const [frame, setFrame] = useState(0)
  const url = CHAR_SPRITE_URL[spriteKey]
  const fw = menuFrame?.fw ?? FRAME_W
  const fh = menuFrame?.fh ?? FRAME_H
  const sw = menuFrame?.sw ?? SHEET_W
  const sh = menuFrame?.sh ?? SHEET_H

  useEffect(() => {
    if (staticSprite) return
    const id = setInterval(() => setFrame(f => (f + 1) % 3), 200)
    return () => clearInterval(id)
  }, [staticSprite])

  const sf = compact ? 0.65 : 1
  const dfw = Math.round(fw * sf)
  const dfh = Math.round(fh * sf)
  const dsw = Math.round(sw * sf)
  const dsh = Math.round(sh * sf)
  const pad = Math.round(16 * sf)

  return (
    <div style={{
      width: dfw + pad, height: dfh + pad,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${color}44`,
      borderRadius: compact ? 7 : 10,
      flexShrink: 0,
    }}>
      {staticSprite ? (
        <img src={url} style={{
          width: dfw, height: dfh,
          objectFit: 'contain',
          filter: `drop-shadow(0 0 6px ${color}bb)`,
        }} />
      ) : (
        <div style={{
          width: dfw, height: dfh,
          backgroundImage: `url(${url})`,
          backgroundPosition: `-${frame * dfw}px -${Math.round((menuRow ?? 0) * dfh)}px`,
          backgroundSize: `${dsw}px ${dsh}px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
          filter: `drop-shadow(0 0 6px ${color}bb)`,
        }} />
      )}
    </div>
  )
}

const SHOP_UPGRADES: Array<{ id: keyof MetaUpgrades; label: string }> = [
  { id: 'maxHealth',   label: 'Max Health'   },
  { id: 'recovery',    label: 'Recovery'     },
  { id: 'magnet',      label: 'Magnet'       },
  { id: 'might',       label: 'Might'        },
  { id: 'luck',        label: 'Luck'         },
  { id: 'growth',      label: 'Growth'       },
  { id: 'moveSpeed',   label: 'Move Speed'   },
  { id: 'armor',       label: 'Armor'        },
  { id: 'attackSpeed', label: 'Attack Speed' },
]

const RAINDROPS = Array.from({ length: 90 }, (_, i) => ({
  id: i,
  left:     -5 + Math.random() * 110,
  duration: 0.45 + Math.random() * 0.55,
  delay:    -(Math.random() * 2.5),
  length:   12 + Math.random() * 22,
  opacity:  0.12 + Math.random() * 0.28,
}))

function RainEffect() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`
        @keyframes rain-fall {
          from { transform: translateY(-30px) translateX(0px); }
          to   { transform: translateY(110vh)  translateX(18px); }
        }
      `}</style>
      {RAINDROPS.map(d => (
        <div key={d.id} style={{
          position: 'absolute',
          left: `${d.left}%`,
          top: 0,
          width: 1,
          height: d.length,
          background: `linear-gradient(to bottom, transparent, rgba(160,200,255,${d.opacity}))`,
          borderRadius: 1,
          animation: `rain-fall ${d.duration}s ${d.delay}s linear infinite`,
        }} />
      ))}
    </div>
  )
}

function makeBoltPath(): string {
  let cx = 15 + Math.random() * 70
  const segs = 10 + Math.floor(Math.random() * 7)
  const pts = [`M ${cx.toFixed(1)} 0`]
  for (let i = 1; i <= segs; i++) {
    cx = Math.max(10, Math.min(90, cx + (Math.random() - 0.5) * 6))
    pts.push(`L ${cx.toFixed(1)} ${((100 * i) / segs).toFixed(1)}`)
  }
  return pts.join(' ')
}

function LightningEffect() {
  const [flashOpacity, setFlashOpacity] = useState(0)
  const [bolts, setBolts] = useState<string[]>([])
  const flashTimers = useRef<number[]>([])
  const scheduleTimer = useRef<number | undefined>(undefined)

  const strike = useCallback(() => {
    flashTimers.current.forEach(clearTimeout)
    const boltCount = Math.random() < 0.4 ? 2 : 1
    setBolts(Array.from({ length: boltCount }, makeBoltPath))
    setFlashOpacity(0.12)
    flashTimers.current = [
      window.setTimeout(() => setFlashOpacity(0.04),  70),
      window.setTimeout(() => setFlashOpacity(0.09),  130),
      window.setTimeout(() => setFlashOpacity(0.02),  200),
      window.setTimeout(() => { setFlashOpacity(0); setBolts([]) }, 420),
    ]
    scheduleTimer.current = window.setTimeout(strike, 3000 + Math.random() * 8000)
  }, [])

  useEffect(() => {
    scheduleTimer.current = window.setTimeout(strike, 800 + Math.random() * 2500)
    return () => {
      clearTimeout(scheduleTimer.current)
      flashTimers.current.forEach(clearTimeout)
    }
  }, [strike])

  return (
    <>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(200,220,255,1) 0%, rgba(180,210,255,0.3) 50%, transparent 100%)',
        opacity: flashOpacity,
        transition: flashOpacity > 0 ? 'none' : 'opacity 0.4s ease-out',
      }} />
      {bolts.length > 0 && (
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          viewBox="0 0 100 100" preserveAspectRatio="none"
        >
          {bolts.map((bolt, i) => (
            <g key={i}>
              <path d={bolt} stroke="rgba(160,190,255,0.18)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d={bolt} stroke="rgba(210,230,255,0.45)" strokeWidth="0.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d={bolt} stroke="rgba(240,250,255,0.85)" strokeWidth="0.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
        </svg>
      )}
    </>
  )
}

const PARTICLES = Array.from({ length: 35 }, (_, i) => ({
  id: i,
  left:     Math.random() * 100,
  startTop: 20 + Math.random() * 90,
  size:     1.2 + Math.random() * 2.4,
  duration: 9 + Math.random() * 13,
  delay:    -(Math.random() * 22),
  color:    Math.random() > 0.55 ? '#cc2233' : '#7722bb',
  swayDur:  3 + Math.random() * 4,
  swayDel:  -(Math.random() * 6),
}))

function MenuBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: -1 }}>
      <style>{`
        @keyframes menu-glow-pulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%       { opacity: 0.75; transform: scale(1.08); }
        }
        @keyframes particle-rise {
          from { transform: translateY(0);      opacity: 0; }
          8%   { opacity: 1; }
          88%  { opacity: 1; }
          to   { transform: translateY(-105vh); opacity: 0; }
        }
        @keyframes particle-sway {
          0%, 100% { margin-left: 0px;  }
          50%       { margin-left: 18px; }
        }
        @keyframes menu-scanlines {
          from { background-position: 0 0; }
          to   { background-position: 0 6px; }
        }
      `}</style>

      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 60%, #44000066 0%, transparent 65%)',
        animation: 'menu-glow-pulse 5s ease-in-out infinite',
      }} />

      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 30% 40%, #22004433 0%, transparent 55%)',
        animation: 'menu-glow-pulse 7s ease-in-out 1.5s infinite',
      }} />

      <RainEffect />
      <LightningEffect />

      {PARTICLES.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.left}%`,
          top: `${p.startTop}%`,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: p.color,
          boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          animation: [
            `particle-rise ${p.duration}s ${p.delay}s linear infinite`,
            `particle-sway ${p.swayDur}s ${p.swayDel}s ease-in-out infinite`,
          ].join(', '),
        }} />
      ))}

      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(0,0,0,0.07) 5px, rgba(0,0,0,0.07) 6px)',
        animation: 'menu-scanlines 0.2s steps(1) infinite',
      }} />
    </div>
  )
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

interface RunEntry {
  id: number
  username: string
  score: number
  kills: number
  time_survived: number
  coins: number
  won: boolean
  multiplayer: boolean
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function ViewHeader({ children, color = '#8888ff' }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ width: '100%', textAlign: 'center', paddingBottom: 2 }}>
      <div style={{
        color, fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 4,
        textShadow: `0 0 20px ${color}66`,
      }}>
        {children}
      </div>
      <div style={{
        height: 1, marginTop: 8,
        background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
      }} />
    </div>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack}
      style={{
        width: '100%', padding: '11px 0', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
        border: '1px solid rgba(80,80,160,0.3)', borderRadius: 10, cursor: 'pointer', letterSpacing: 2,
        color: '#7777cc', background: 'rgba(20,20,60,0.4)', transition: 'all 0.18s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,30,80,0.7)'; e.currentTarget.style.color = '#aaaaff'; e.currentTarget.style.borderColor = 'rgba(100,100,200,0.5)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(20,20,60,0.4)'; e.currentTarget.style.color = '#7777cc'; e.currentTarget.style.borderColor = 'rgba(80,80,160,0.3)' }}>
      ← BACK
    </button>
  )
}

function LeaderboardView({ onBack }: { onBack: () => void }) {
  const [runs, setRuns] = useState<RunEntry[]>([])
  const [personalBestId, setPersonalBestId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const token = useAuthStore.getState().token

  useEffect(() => {
    fetch('/api/leaderboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: { runs: RunEntry[]; personalBestId: number | null }) => {
        setRuns(d.runs)
        setPersonalBestId(d.personalBestId)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <>
      <ViewHeader color="#8888ff">LEADERBOARD</ViewHeader>

      {loading ? (
        <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>Loading…</div>
      ) : runs.length === 0 ? (
        <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>No runs yet. Be the first!</div>
      ) : (
        <div style={{ width: '100%', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ maxWidth: '88vw', overflowX: 'auto', width: '100%' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '28px minmax(90px, 1fr) 70px 55px 52px 52px',
              gap: '0 8px', padding: '6px 10px',
              color: '#9999cc', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, fontWeight: 'bold',
              borderBottom: '2px solid rgba(80,80,180,0.5)', marginBottom: 4,
              minWidth: 380,
            }}>
              <span>#</span><span>PLAYER</span><span style={{ textAlign: 'right' }}>SCORE</span>
              <span style={{ textAlign: 'right' }}>KILLS</span><span style={{ textAlign: 'right' }}>TIME</span>
              <span style={{ textAlign: 'right' }}>COINS</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {runs.map((r, i) => {
                const isMe = r.id === personalBestId
                return (
                  <div key={r.id} style={{
                    display: 'grid', gridTemplateColumns: '28px minmax(90px, 1fr) 70px 55px 52px 52px',
                    gap: '0 8px', padding: '7px 10px',
                    background: isMe
                      ? 'rgba(60,60,180,0.18)'
                      : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    border: isMe ? '1px solid rgba(80,80,180,0.35)' : '1px solid transparent',
                    borderRadius: 8,
                    fontFamily: 'monospace', fontSize: 12,
                    transition: 'background 0.1s',
                    minWidth: 380,
                  }}>
                    <span style={{ color: i < 3 ? ['#ffd700','#c0c0c0','#cd7f32'][i] : '#333355', fontWeight: i < 3 ? 'bold' : 'normal' }}>
                      {i + 1}
                    </span>
                    <span style={{ color: isMe ? '#aaaaff' : '#777799', whiteSpace: 'nowrap' }}>
                      {r.username}{r.multiplayer ? ' ◉' : ''}{r.won ? ' ★' : ''}
                    </span>
                    <span style={{ color: '#ddcc55', textAlign: 'right', fontWeight: 'bold' }}>{r.score.toLocaleString()}</span>
                    <span style={{ color: '#cc6644', textAlign: 'right' }}>{r.kills}</span>
                    <span style={{ color: '#6688cc', textAlign: 'right' }}>{fmtTime(r.time_survived)}</span>
                    <span style={{ color: '#ccaa22', textAlign: 'right' }}>{r.coins}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6666aa', textAlign: 'center', letterSpacing: 1 }}>
        <span style={{ color: '#8888cc' }}>◉</span> multiplayer &nbsp;&nbsp; <span style={{ color: '#ddcc55' }}>★</span> won
      </div>

      <BackButton onBack={onBack} />
    </>
  )
}

// ── Achievements ──────────────────────────────────────────────────────────────

function AchievementsView({ onBack }: { onBack: () => void }) {
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const token = useAuthStore.getState().token

  useEffect(() => {
    fetch('/api/achievements', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: { achievements: { achievement_id: string }[] }) => {
        setUnlocked(new Set(d.achievements.map(a => a.achievement_id)))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const unlockedCount = unlocked.size

  return (
    <>
      <ViewHeader color="#8888ff">ACHIEVEMENTS</ViewHeader>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 12px', borderRadius: 20,
        background: 'rgba(60,60,120,0.25)', border: '1px solid rgba(80,80,160,0.3)',
        color: '#6666aa', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2,
      }}>
        {unlockedCount} / {ACHIEVEMENTS.length} UNLOCKED
      </div>

      {loading ? (
        <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {ACHIEVEMENTS.map(a => {
            const done = unlocked.has(a.id)
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 13px',
                background: done ? 'rgba(60,60,140,0.2)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${done ? 'rgba(80,80,180,0.3)' : 'rgba(40,40,80,0.5)'}`,
                borderRadius: 10,
                opacity: done ? 1 : 0.42,
                transition: 'all 0.15s ease',
              }}>
                <span style={{ fontSize: 18, width: 24, textAlign: 'center', filter: done ? 'none' : 'grayscale(1)' }}>
                  {a.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: done ? '#ccccff' : '#444455', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold' }}>
                    {a.name}
                  </div>
                  <div style={{ color: done ? '#6677aa' : '#2a2a40', fontFamily: 'monospace', fontSize: 11, marginTop: 1 }}>
                    {a.description}
                  </div>
                </div>
                {done && (
                  <span style={{
                    color: '#33aa55', fontSize: 13, fontWeight: 'bold',
                    background: 'rgba(40,120,60,0.2)', border: '1px solid rgba(60,160,80,0.3)',
                    borderRadius: 6, padding: '2px 6px',
                  }}>✓</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <BackButton onBack={onBack} />
    </>
  )
}

function upgradeStat(id: keyof MetaUpgrades, rank: number): string {
  switch (id) {
    case 'maxHealth': return `+${rank * 10}% max HP`
    case 'recovery':  return `${(rank * 0.1).toFixed(1)} HP/sec regen`
    case 'magnet':    return `+${rank * 10}% pickup range`
    case 'might':     return `+${rank * 5}% damage`
    case 'luck':      return `${5 + rank}% coin drop chance`
    case 'growth':    return `+${rank * 3}% experience gained`
    case 'moveSpeed': return `+${rank * 2}% move speed`
    case 'armor':        return `+${rank} armor`
    case 'attackSpeed': return rank === 0 ? 'no bonus' : `-${Math.round(100 * (1 - Math.pow(0.95, rank)))}% attack cooldown`
  }
}

const panel: React.CSSProperties = {
  background: 'rgba(8, 8, 22, 0.88)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(90, 70, 200, 0.22)',
  borderRadius: 18,
  padding: '32px 48px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
  boxShadow: '0 12px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 400,
}

const btnBase: React.CSSProperties = {
  width: '100%', padding: '12px 0',
  fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
  border: '1px solid rgba(80,80,200,0.35)', borderRadius: 10,
  cursor: 'pointer', letterSpacing: 2,
  transition: 'all 0.18s ease',
}

const divider: React.CSSProperties = {
  width: '100%', height: 1,
  background: 'linear-gradient(90deg, transparent, rgba(70,70,160,0.4), transparent)',
}

export function MainMenu({ onPlay, onMultiplayer, onLogout }: {
  onPlay: () => void
  onMultiplayer: () => void
  onLogout: () => void
}) {
  const { coins, upgrades, purchaseUpgrade, refundUpgrade, refundAllUpgrades, unlockedCharacters, unlockCharacter } = useProfileStore()
  const username = useAuthStore(s => s.username)
  const role = useAuthStore(s => s.role)
  const isSuperAdmin = role === 'super_admin'
  const { selectedCharacter: _selectedCharacter, setCharacter } = useCharacterStore()
  const unlockCostOfSelected = CHARACTER_UNLOCK_COSTS[_selectedCharacter]
  const isSelectedLocked = (unlockCostOfSelected !== undefined || CHARACTER_ACHIEVEMENT_REQUIRED[_selectedCharacter] !== undefined) && !unlockedCharacters.includes(_selectedCharacter)
  const selectedCharacter = isSelectedLocked ? 'ares' : _selectedCharacter
  type MenuView = 'home' | 'shop' | 'characters' | 'statistics' | 'leaderboard' | 'achievements' | 'admin' | 'settings' | 'controls' | 'sounds'
  const VALID_VIEWS = new Set<string>(['home', 'shop', 'characters', 'statistics', 'leaderboard', 'achievements', 'admin', 'settings', 'controls', 'sounds'])
  const [view, setViewRaw] = useState<MenuView>(() => {
    const saved = sessionStorage.getItem('gods_menu_view')
    return (saved && VALID_VIEWS.has(saved) ? saved : 'home') as MenuView
  })
  function setView(v: MenuView) {
    sessionStorage.setItem('gods_menu_view', v)
    setViewRaw(v)
  }
  const [confirmRefundAll, setConfirmRefundAll] = useState(false)
  const [confirmRefund, setConfirmRefund] = useState<keyof MetaUpgrades | null>(null)
  const [confirmUnlock, setConfirmUnlock] = useState<string | null>(null)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [playAfterSelect, setPlayAfterSelect] = useState(false)
  const mob = useIsMobile()

  const VIEW_PARENT: Partial<Record<MenuView, MenuView>> = {
    characters: 'home', shop: 'home', settings: 'home', statistics: 'home', admin: 'home',
    leaderboard: 'statistics', achievements: 'statistics',
    controls: 'settings', sounds: 'settings',
  }

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (confirmUnlock)    { setConfirmUnlock(null); setUnlockError(null); return }
      if (confirmRefundAll) { setConfirmRefundAll(false);    return }
      if (confirmRefund)    { setConfirmRefund(null);        return }
      if (view === 'characters') setPlayAfterSelect(false)
      const parent = VIEW_PARENT[view]
      if (parent) setView(parent)
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [view, confirmUnlock, confirmRefundAll, confirmRefund])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #0d0d22 0%, #07070f 100%)',
      padding: '20px 0',
    }}>
      <MenuBackground />

      {/* Version badge */}
      <div style={{
        position: 'fixed', bottom: 12, right: 16,
        color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', fontSize: 12, letterSpacing: 1,
        pointerEvents: 'none', userSelect: 'none',
      }}>
        v{__APP_VERSION__}
      </div>

      {/* Title */}
      <div style={{
        fontSize: mob ? 30 : 54, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: mob ? 3 : 9,
        marginBottom: 4, textAlign: 'center',
        background: 'linear-gradient(135deg, #cc2222 0%, #ee4400 45%, #ffaa00 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        filter: 'drop-shadow(0 0 18px rgba(200,50,20,0.55))',
      }}>
        GODS UNLEASHED
      </div>

      {/* Subtitle */}
      <div style={{
        color: '#5566aa', fontSize: mob ? 10 : 11, fontFamily: 'monospace',
        letterSpacing: mob ? 3 : 7, marginBottom: mob ? 20 : 36,
        textTransform: 'uppercase',
      }}>
        Survive the Divine
      </div>

      <div style={{
        ...panel,
        padding: mob ? '20px 16px' : '32px 48px',
        minWidth: mob ? 'calc(100vw - 24px)' : (view === 'characters' ? 700 : ['shop', 'leaderboard', 'achievements', 'admin'].includes(view) ? 520 : 420),
        maxWidth: mob ? 'calc(100vw - 24px)' : undefined,
        maxHeight: 'calc(100vh - 180px)',
        height: (!mob && view === 'characters') ? 'calc(100vh - 180px)' : undefined,
        width: (!mob && view === 'characters') ? 700 : undefined,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>

      {view === 'settings' ? (
        <>
          <ViewHeader color="#8888ff">SETTINGS</ViewHeader>
          <button type="button" onClick={() => setView('controls')}
            style={{ ...btnBase, fontSize: 13, color: '#8888cc', background: 'rgba(20,20,55,0.5)', borderColor: 'rgba(60,60,130,0.3)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,30,80,0.7)'; e.currentTarget.style.color = '#aaaaff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(20,20,55,0.5)'; e.currentTarget.style.color = '#8888cc' }}>
            CONTROLS
          </button>
          <button type="button" onClick={() => setView('sounds')}
            style={{ ...btnBase, fontSize: 13, color: '#8888cc', background: 'rgba(20,20,55,0.5)', borderColor: 'rgba(60,60,130,0.3)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,30,80,0.7)'; e.currentTarget.style.color = '#aaaaff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(20,20,55,0.5)'; e.currentTarget.style.color = '#8888cc' }}>
            SOUNDS
          </button>
          <BackButton onBack={() => setView('home')} />
        </>
      ) : view === 'statistics' ? (
        <>
          <ViewHeader color="#ccaa44">STATISTICS</ViewHeader>
          <button type="button" onClick={() => setView('leaderboard')}
            style={{ ...btnBase, fontSize: 13, color: '#ccaa44', background: 'rgba(30,22,8,0.5)', borderColor: 'rgba(100,70,10,0.4)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,32,10,0.7)'; e.currentTarget.style.color = '#ddbb55' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(30,22,8,0.5)'; e.currentTarget.style.color = '#ccaa44' }}>
            LEADERBOARD
          </button>
          <button type="button" onClick={() => setView('achievements')}
            style={{ ...btnBase, fontSize: 13, color: '#9944cc', background: 'rgba(22,8,30,0.5)', borderColor: 'rgba(80,20,120,0.4)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(35,12,50,0.7)'; e.currentTarget.style.color = '#bb55ee' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(22,8,30,0.5)'; e.currentTarget.style.color = '#9944cc' }}>
            ACHIEVEMENTS
          </button>
          <BackButton onBack={() => setView('home')} />
        </>
      ) : view === 'leaderboard' ? (
        <LeaderboardView onBack={() => setView('statistics')} />
      ) : view === 'achievements' ? (
        <AchievementsView onBack={() => setView('statistics')} />
      ) : view === 'controls' ? (
        <ControlsView onBack={() => setView('settings')} />
      ) : view === 'sounds' ? (
        <SoundsView onBack={() => setView('settings')} />
      ) : view === 'admin' ? (
        <AdminPlayersView onBack={() => setView('home')} />
      ) : view === 'characters' ? (
        <>
          <ViewHeader color="#8888ff">SELECT CHARACTER</ViewHeader>

          <style>{`
            @keyframes char-pulse {
              0%, 100% { opacity: 0.10; }
              50%       { opacity: 0.28; }
            }
            @keyframes char-shimmer {
              0%   { transform: translateX(-120%) skewX(-15deg); }
              100% { transform: translateX(600%)  skewX(-15deg); }
            }
          `}</style>

          {mob ? (
            // ── Mobile: original vertical list ──
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 14px', borderRadius: 20,
                  background: 'rgba(60,50,0,0.35)', border: '1px solid rgba(160,120,0,0.35)',
                  color: '#ccaa22', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold',
                  textShadow: '0 0 10px #886600',
                }}>
                  ◈ {coins}
                </div>
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {ALL_CHARACTERS.map((id, i) => {
                  const def = CHARACTER_DEFS[id]
                  const isSelected = selectedCharacter === id
                  const unlockCost = CHARACTER_UNLOCK_COSTS[id]
                  const achievementRequired = CHARACTER_ACHIEVEMENT_REQUIRED[id]
                  const isLocked = (unlockCost !== undefined || achievementRequired !== undefined) && !unlockedCharacters.includes(id)
                  const canAfford = coins >= (unlockCost ?? 0)
                  return (
                    <div
                      key={id}
                      onClick={() => { if (!isLocked) setCharacter(id) }}
                      style={{
                        position: 'relative', overflow: 'hidden',
                        background: isSelected ? 'rgba(20,20,50,0.8)' : 'rgba(10,10,28,0.6)',
                        border: `1px solid ${isLocked ? 'rgba(60,30,80,0.4)' : isSelected ? def.color + '66' : 'rgba(40,40,90,0.5)'}`,
                        borderLeft: `4px solid ${isLocked ? '#44224466' : def.color}`,
                        borderRadius: 8, padding: '8px 10px',
                        cursor: isLocked ? 'default' : 'pointer',
                        transition: 'border-color 0.15s, background 0.15s',
                        display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center',
                        boxShadow: isSelected ? `0 0 20px ${def.color}22` : 'none',
                      }}
                    >
                      {!isLocked && <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: `radial-gradient(ellipse at 30% 50%, ${def.color}44 0%, transparent 70%)`,
                        animation: `char-pulse 2.4s ease-in-out ${i * 0.35}s infinite`,
                      }} />}
                      {!isLocked && <div style={{
                        position: 'absolute', top: 0, bottom: 0, width: '30%',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
                        pointerEvents: 'none',
                        animation: `char-shimmer ${3.5 + i * 0.4}s ease-in-out ${i * 0.6}s infinite`,
                      }} />}
                      {isLocked && <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'linear-gradient(135deg, rgba(10,10,24,0.5) 0%, rgba(26,10,40,0.5) 100%)',
                      }} />}

                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ opacity: isLocked ? 0.4 : 1 }}>
                          <CharSprite spriteKey={def.spriteKey} color={def.color} menuFrame={def.menuFrame} menuRow={def.menuRow} compact staticSprite={def.staticSprite} />
                        </div>
                        {isLocked && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                            🔒
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {isSelected && <span style={{ color: def.color, fontSize: 9 }}>▶</span>}
                          <span style={{ color: isLocked ? '#776688' : '#ddddff', fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' }}>
                            {def.name.toUpperCase()}
                          </span>
                          <span style={{ color: isLocked ? '#443355' : def.color + 'cc', fontFamily: 'monospace', fontSize: 10, fontStyle: 'italic' }}>
                            {def.trait}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 6px' }}>
                          {def.statLines.map(line => (
                            <span key={line.label} style={{
                              color: isLocked ? (line.positive ? '#1e4430' : '#441818') : (line.positive ? '#44cc66' : '#cc4444'),
                              fontFamily: 'monospace', fontSize: 10,
                            }}>
                              {line.positive ? '▲' : '▼'} {line.label}
                            </span>
                          ))}
                        </div>
                        {isLocked && achievementRequired !== undefined && (() => {
                          const ach = ACHIEVEMENT_MAP[achievementRequired]
                          return (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#553377', fontWeight: 'bold', letterSpacing: 1, flexShrink: 0 }}>UNLOCK:</span>
                              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#8855bb' }}>
                                {ach ? `${ach.icon} ${ach.description}` : achievementRequired}
                              </span>
                            </div>
                          )
                        })()}
                      </div>

                      {isLocked && unlockCost !== undefined && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setUnlockError(null); setConfirmUnlock(id) }}
                          style={{
                            flexShrink: 0, position: 'relative', zIndex: 1,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                            width: 58, height: 44,
                            background: canAfford ? 'rgba(30,15,50,0.8)' : 'rgba(15,10,22,0.8)',
                            border: `1px solid ${canAfford ? def.color + '55' : 'rgba(50,25,70,0.5)'}`,
                            borderRadius: 8, cursor: 'pointer', transition: 'all 0.18s ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = canAfford ? 'rgba(50,25,80,0.9)' : 'rgba(22,14,32,0.9)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = canAfford ? 'rgba(30,15,50,0.8)' : 'rgba(15,10,22,0.8)' }}
                        >
                          <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', color: canAfford ? '#ccaa22' : '#443322', letterSpacing: 1 }}>◈ {unlockCost}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold', color: canAfford ? '#44ff88' : '#1a4433', letterSpacing: 1 }}>UNLOCK</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {playAfterSelect && (
                <button
                  type="button"
                  onClick={onPlay}
                  style={{
                    ...btnBase, padding: '14px 0', fontSize: 16,
                    color: '#ffffff',
                    background: 'linear-gradient(135deg, rgba(20,20,120,0.9) 0%, rgba(50,20,100,0.9) 100%)',
                    borderColor: 'rgba(100,80,220,0.5)',
                    boxShadow: '0 0 20px rgba(50,30,160,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,30,160,0.95) 0%, rgba(70,30,140,0.95) 100%)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(70,40,200,0.55), inset 0 1px 0 rgba(255,255,255,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(20,20,120,0.9) 0%, rgba(50,20,100,0.9) 100%)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(50,30,160,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' }}
                >
                  START GAME
                </button>
              )}
              <BackButton onBack={() => { setPlayAfterSelect(false); setView('home') }} />
            </>
          ) : (
            // ── Desktop: two-column layout ──
            <>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                padding: '4px 14px', borderRadius: 20,
                background: 'rgba(60,50,0,0.35)', border: '1px solid rgba(160,120,0,0.35)',
                color: '#ccaa22', fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold',
                textShadow: '0 0 10px #886600',
              }}>
                ◈ {coins}
              </div>

              <div style={{ display: 'flex', gap: 16, width: '100%', flex: 1, minHeight: 0 }}>

                {/* Left: 2-column portrait grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7,
                  flex: '0 0 196px', overflowY: 'auto', alignContent: 'start',
                }}>
                  {ALL_CHARACTERS.map((id, i) => {
                    const def = CHARACTER_DEFS[id]
                    const isGridSelected = selectedCharacter === id
                    const unlockCost = CHARACTER_UNLOCK_COSTS[id]
                    const achievementRequired = CHARACTER_ACHIEVEMENT_REQUIRED[id]
                    const isLocked = (unlockCost !== undefined || achievementRequired !== undefined) && !unlockedCharacters.includes(id)
                    return (
                      <div
                        key={id}
                        onClick={() => {
                          if (!isLocked) setCharacter(id)
                          else if (unlockCost !== undefined) { setUnlockError(null); setConfirmUnlock(id) }
                        }}
                        style={{
                          position: 'relative', overflow: 'hidden',
                          background: isGridSelected ? 'rgba(20,20,50,0.9)' : 'rgba(10,10,28,0.55)',
                          border: `2px solid ${isLocked ? 'rgba(60,30,80,0.35)' : isGridSelected ? def.color : 'rgba(40,40,90,0.45)'}`,
                          borderRadius: 10, padding: '10px 6px 7px',
                          cursor: isLocked ? (unlockCost !== undefined ? 'pointer' : 'default') : 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                          transition: 'all 0.15s ease',
                          boxShadow: isGridSelected ? `0 0 16px ${def.color}44` : 'none',
                        }}
                        onMouseEnter={e => { if (!isLocked && !isGridSelected) { e.currentTarget.style.background = 'rgba(15,15,40,0.75)'; e.currentTarget.style.borderColor = def.color + '55' } }}
                        onMouseLeave={e => { if (!isLocked && !isGridSelected) { e.currentTarget.style.background = 'rgba(10,10,28,0.55)'; e.currentTarget.style.borderColor = 'rgba(40,40,90,0.45)' } }}
                      >
                        {isGridSelected && <div style={{
                          position: 'absolute', inset: 0, pointerEvents: 'none',
                          background: `radial-gradient(ellipse at 50% 40%, ${def.color}22 0%, transparent 70%)`,
                          animation: `char-pulse 2.4s ease-in-out ${i * 0.35}s infinite`,
                        }} />}

                        <div style={{ position: 'relative' }}>
                          <div style={{ opacity: isLocked ? 0.35 : 1 }}>
                            <CharSprite spriteKey={def.spriteKey} color={def.color} menuFrame={def.menuFrame} menuRow={def.menuRow} compact staticSprite={def.staticSprite} />
                          </div>
                          {isLocked && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🔒</div>
                          )}
                        </div>

                        <span style={{
                          fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold',
                          letterSpacing: 1, textAlign: 'center',
                          color: isLocked ? '#443355' : isGridSelected ? def.color : '#7777aa',
                        }}>
                          {def.name.toUpperCase()}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Right: selected character details */}
                {(() => {
                  const def = CHARACTER_DEFS[selectedCharacter]
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', minHeight: 0 }}>

                      {/* Hero: big sprite + name + trait + description */}
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                        padding: '18px 14px 14px',
                        background: `radial-gradient(ellipse at 50% 35%, ${def.color}1e 0%, transparent 68%)`,
                        border: `1px solid ${def.color}30`,
                        borderRadius: 12, flexShrink: 0,
                      }}>
                        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CharSprite spriteKey={def.spriteKey} color={def.color} menuFrame={def.menuFrame} menuRow={def.menuRow} staticSprite={def.staticSprite} />
                        </div>
                        <div style={{
                          color: def.color, fontFamily: 'monospace', fontSize: 22, fontWeight: 'bold',
                          letterSpacing: 4, textShadow: `0 0 18px ${def.color}66`,
                        }}>
                          {def.name.toUpperCase()}
                        </div>
                        <div style={{ color: def.color + 'aa', fontFamily: 'monospace', fontSize: 11, fontStyle: 'italic', letterSpacing: 1 }}>
                          {def.trait}
                        </div>
                        <div style={{ color: '#6666aa', fontFamily: 'monospace', fontSize: 10, lineHeight: 1.55, textAlign: 'center', minHeight: 48 }}>
                          {def.description}
                        </div>
                      </div>

                      {/* Stat lines */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                        {def.statLines.map(line => (
                          <div key={line.label} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '5px 10px',
                            background: line.positive ? 'rgba(20,60,30,0.2)' : 'rgba(60,20,20,0.2)',
                            border: `1px solid ${line.positive ? 'rgba(40,120,60,0.2)' : 'rgba(120,40,40,0.2)'}`,
                            borderRadius: 6, fontFamily: 'monospace', fontSize: 11,
                          }}>
                            <span style={{ color: line.positive ? '#44cc66' : '#cc4444', fontSize: 9 }}>
                              {line.positive ? '▲' : '▼'}
                            </span>
                            <span style={{ color: line.positive ? '#55bb77' : '#bb5555' }}>
                              {line.label}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* START GAME */}
                      {playAfterSelect && (
                        <button
                          type="button"
                          onClick={onPlay}
                          style={{
                            width: '100%', padding: '13px 0', fontSize: 15,
                            fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 2,
                            border: '1px solid rgba(100,80,220,0.5)', borderRadius: 10, cursor: 'pointer',
                            color: '#ffffff',
                            background: 'linear-gradient(135deg, rgba(20,20,120,0.9) 0%, rgba(50,20,100,0.9) 100%)',
                            boxShadow: '0 0 20px rgba(50,30,160,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
                            transition: 'all 0.18s ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,30,160,0.95) 0%, rgba(70,30,140,0.95) 100%)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(70,40,200,0.55), inset 0 1px 0 rgba(255,255,255,0.1)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(20,20,120,0.9) 0%, rgba(50,20,100,0.9) 100%)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(50,30,160,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' }}
                        >
                          START GAME
                        </button>
                      )}
                    </div>
                  )
                })()}
              </div>

              <BackButton onBack={() => { setPlayAfterSelect(false); setView('home') }} />
            </>
          )}
        </>
      ) : view === 'shop' ? (
        <>
          <ViewHeader color="#ccaa44">SHOP</ViewHeader>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 14px', borderRadius: 20,
              background: 'rgba(60,50,0,0.35)', border: '1px solid rgba(160,120,0,0.35)',
              color: '#ccaa22', fontFamily: 'monospace', fontSize: 20, fontWeight: 'bold',
              textShadow: '0 0 10px #886600',
            }}>
              ◈ {coins}
            </div>
            {(() => {
              const totalRefund = SHOP_UPGRADES.reduce((sum, upg) => {
                const rank = upgrades[upg.id] ?? 0
                for (let r = 0; r < rank; r++) sum += UPGRADE_COSTS[r]
                return sum
              }, 0)
              if (totalRefund === 0) return null
              return confirmRefundAll ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#aa6644', fontFamily: 'monospace', fontSize: 11 }}>Sure?</span>
                  <button
                    type="button"
                    onClick={() => { refundAllUpgrades(); setConfirmRefundAll(false) }}
                    style={{
                      padding: '3px 10px', background: 'rgba(60,10,10,0.6)',
                      border: '1px solid rgba(150,30,30,0.5)', borderRadius: 6,
                      color: '#ff6666', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(90,15,15,0.8)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(60,10,10,0.6)' }}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRefundAll(false)}
                    style={{
                      padding: '3px 10px', background: 'rgba(20,20,50,0.5)',
                      border: '1px solid rgba(60,60,120,0.35)', borderRadius: 6,
                      color: '#8888cc', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,30,70,0.7)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(20,20,50,0.5)' }}
                  >
                    NO
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRefundAll(true)}
                  style={{
                    padding: '4px 12px',
                    background: 'rgba(40,10,10,0.5)', border: '1px solid rgba(100,30,30,0.4)',
                    borderRadius: 7, color: '#aa4444',
                    fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold',
                    cursor: 'pointer', letterSpacing: 1, transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(65,15,15,0.7)'; e.currentTarget.style.borderColor = 'rgba(150,40,40,0.5)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(40,10,10,0.5)'; e.currentTarget.style.borderColor = 'rgba(100,30,30,0.4)' }}
                >
                  ↩ REFUND ALL ◈{totalRefund}
                </button>
              )
            })()}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {SHOP_UPGRADES.map(upg => {
              const rank = upgrades[upg.id] ?? 0
              const isMax = rank >= UPGRADE_MAX_RANK
              const cost = isMax ? null : UPGRADE_COSTS[rank]
              const canAfford = cost !== null && coins >= cost
              const refundAmount = rank > 0 ? UPGRADE_COSTS[rank - 1] : 0

              return (
                <div key={upg.id} style={{
                  background: 'rgba(10,10,26,0.6)', border: '1px solid rgba(40,40,90,0.5)',
                  borderRadius: 10, padding: '10px 14px',
                  display: 'flex', flexDirection: 'column', gap: 5,
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      color: '#ccccff', fontFamily: 'monospace', fontSize: 13,
                      fontWeight: 'bold', flex: 1,
                    }}>
                      {upg.label.toUpperCase()}
                    </span>

                    <div style={{ display: 'flex', gap: 4 }}>
                      {Array.from({ length: UPGRADE_MAX_RANK }).map((_, i) => (
                        <span key={i} style={{
                          color: i < rank ? '#ffcc33' : 'rgba(40,40,80,0.8)',
                          fontSize: 10, lineHeight: 1,
                        }}>●</span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', minWidth: mob ? undefined : 140 }}>
                      {rank > 0 && (
                        confirmRefund === upg.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => { refundUpgrade(upg.id); setConfirmRefund(null) }}
                              style={{
                                padding: '3px 8px', background: 'rgba(60,10,10,0.6)',
                                border: '1px solid rgba(150,30,30,0.5)', borderRadius: 5,
                                color: '#ff6666', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold',
                                cursor: 'pointer', transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(90,15,15,0.8)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(60,10,10,0.6)' }}
                            >
                              YES
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRefund(null)}
                              style={{
                                padding: '3px 8px', background: 'rgba(20,20,50,0.5)',
                                border: '1px solid rgba(60,60,120,0.35)', borderRadius: 5,
                                color: '#8888cc', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold',
                                cursor: 'pointer', transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,30,70,0.7)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(20,20,50,0.5)' }}
                            >
                              NO
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRefund(upg.id)}
                            style={{
                              padding: '3px 8px',
                              background: 'rgba(40,10,10,0.5)',
                              border: '1px solid rgba(100,30,30,0.4)',
                              borderRadius: 5,
                              color: '#aa4444',
                              fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold',
                              cursor: 'pointer', transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(65,15,15,0.7)'; e.currentTarget.style.borderColor = 'rgba(150,40,40,0.5)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(40,10,10,0.5)'; e.currentTarget.style.borderColor = 'rgba(100,30,30,0.4)' }}
                          >
                            ↩ ◈{refundAmount}
                          </button>
                        )
                      )}
                      {isMax ? (
                        <span style={{
                          color: '#44aa55', fontFamily: 'monospace', fontSize: 11,
                          fontWeight: 'bold', letterSpacing: 1,
                          padding: '2px 8px', background: 'rgba(30,80,40,0.25)',
                          border: '1px solid rgba(50,130,60,0.3)', borderRadius: 5,
                        }}>
                          MAX
                        </span>
                      ) : (
                        <>
                          <span style={{
                            color: canAfford ? '#ccaa22' : '#443322',
                            fontFamily: 'monospace', fontSize: 12,
                          }}>
                            ◈ {cost}
                          </span>
                          <button
                            type="button"
                            onClick={() => purchaseUpgrade(upg.id)}
                            disabled={!canAfford}
                            style={{
                              padding: '3px 10px',
                              background: canAfford ? 'rgba(30,30,110,0.7)' : 'rgba(12,12,28,0.5)',
                              border: `1px solid ${canAfford ? 'rgba(80,80,200,0.5)' : 'rgba(30,30,60,0.4)'}`,
                              borderRadius: 5,
                              color: canAfford ? '#aaaaff' : '#333355',
                              fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold',
                              cursor: canAfford ? 'pointer' : 'not-allowed',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => { if (canAfford) { e.currentTarget.style.background = 'rgba(50,50,160,0.8)'; e.currentTarget.style.color = '#ccccff' } }}
                            onMouseLeave={e => { if (canAfford) { e.currentTarget.style.background = 'rgba(30,30,110,0.7)'; e.currentTarget.style.color = '#aaaaff' } }}
                          >
                            BUY
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'monospace', fontSize: 11 }}>
                    {rank > 0 ? (
                      <span style={{ color: '#44aa66' }}>{upgradeStat(upg.id, rank)}</span>
                    ) : (
                      <span style={{ color: '#333355' }}>no bonus yet</span>
                    )}
                    {!isMax && (
                      <>
                        <span style={{ color: '#222244' }}>→</span>
                        <span style={{ color: '#6666aa' }}>{upgradeStat(upg.id, rank + 1)}</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <BackButton onBack={() => setView('home')} />
        </>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {/* Username badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 16px', borderRadius: 20,
            background: 'rgba(30,30,80,0.45)', border: '1px solid rgba(80,80,180,0.3)',
            color: '#7788dd', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', letterSpacing: 2,
          }}>
            <span style={{ color: '#5566bb', fontSize: 10 }}>▶</span>
            {username ?? ''}
          </div>

          {/* Coins badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 18px', borderRadius: 20,
            background: 'rgba(60,50,0,0.35)', border: '1px solid rgba(160,120,0,0.35)',
            color: '#ccaa22', fontFamily: 'monospace', fontSize: 22, fontWeight: 'bold',
            textShadow: '0 0 12px rgba(180,130,0,0.6)',
          }}>
            ◈ {coins}
          </div>

          {/* SINGLEPLAYER */}
          <button
            type="button"
            onClick={() => { setPlayAfterSelect(true); setViewRaw('characters') }}
            style={{
              ...btnBase, padding: '14px 0', fontSize: 16,
              color: '#ffffff',
              background: 'linear-gradient(135deg, rgba(20,20,120,0.9) 0%, rgba(50,20,100,0.9) 100%)',
              borderColor: 'rgba(100,80,220,0.5)',
              boxShadow: '0 0 20px rgba(50,30,160,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,30,160,0.95) 0%, rgba(70,30,140,0.95) 100%)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(70,40,200,0.55), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(20,20,120,0.9) 0%, rgba(50,20,100,0.9) 100%)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(50,30,160,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' }}
          >
            SINGLEPLAYER
          </button>

          {/* MULTIPLAYER */}
          <button
            type="button"
            onClick={onMultiplayer}
            style={{
              ...btnBase, padding: '12px 0', fontSize: 14,
              color: '#66ddaa',
              background: 'rgba(10,40,28,0.5)',
              borderColor: 'rgba(30,120,70,0.5)',
              boxShadow: '0 0 12px rgba(20,100,60,0.25)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(15,60,40,0.7)'; e.currentTarget.style.color = '#88ffcc'; e.currentTarget.style.boxShadow = '0 0 18px rgba(30,140,80,0.35)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,40,28,0.5)'; e.currentTarget.style.color = '#66ddaa'; e.currentTarget.style.boxShadow = '0 0 12px rgba(20,100,60,0.25)' }}
          >
            MULTIPLAYER
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setView('admin')}
              style={{
                ...btnBase, fontSize: 12,
                color: '#cc5555', background: 'rgba(30,8,8,0.5)',
                borderColor: 'rgba(100,20,20,0.4)', boxShadow: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(50,12,12,0.7)'; e.currentTarget.style.color = '#ff6666' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(30,8,8,0.5)'; e.currentTarget.style.color = '#cc5555' }}
            >
              ADMIN PANEL
            </button>
          )}

          <div style={divider} />

          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              type="button"
              onClick={() => setView('characters')}
              style={{
                ...btnBase, flex: 1, fontSize: 13,
                color: '#8888cc', background: 'rgba(18,18,50,0.5)',
                borderColor: 'rgba(60,60,140,0.4)', boxShadow: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(28,28,75,0.7)'; e.currentTarget.style.color = '#aaaaff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(18,18,50,0.5)'; e.currentTarget.style.color = '#8888cc' }}
            >
              CHARACTER
            </button>

            <button
              type="button"
              onClick={() => setView('shop')}
              style={{
                ...btnBase, flex: 1, fontSize: 13,
                color: '#bb9933', background: 'rgba(25,20,5,0.5)',
                borderColor: 'rgba(100,70,10,0.4)', boxShadow: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(38,30,8,0.7)'; e.currentTarget.style.color = '#ddbb55' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(25,20,5,0.5)'; e.currentTarget.style.color = '#bb9933' }}
            >
              SHOP
            </button>
          </div>

          <button
            type="button"
            onClick={() => setView('statistics')}
            style={{
              ...btnBase, fontSize: 13,
              color: '#bb9933', background: 'rgba(25,20,5,0.5)',
              borderColor: 'rgba(100,70,10,0.4)', boxShadow: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(38,30,8,0.7)'; e.currentTarget.style.color = '#ddbb55' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(25,20,5,0.5)'; e.currentTarget.style.color = '#bb9933' }}
          >
            STATISTICS
          </button>

          <button
            type="button"
            onClick={() => setView('settings')}
            style={{
              ...btnBase, fontSize: 13,
              color: '#8888cc', background: 'rgba(18,18,50,0.5)',
              borderColor: 'rgba(60,60,140,0.4)', boxShadow: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(28,28,75,0.7)'; e.currentTarget.style.color = '#aaaaff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(18,18,50,0.5)'; e.currentTarget.style.color = '#8888cc' }}
          >
            SETTINGS
          </button>

          <div style={divider} />

          <button
            type="button"
            onClick={onLogout}
            style={{
              ...btnBase, fontSize: 12,
              color: '#443344', background: 'transparent',
              borderColor: 'rgba(60,30,50,0.3)', boxShadow: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#bb3333'; e.currentTarget.style.borderColor = 'rgba(120,30,30,0.5)'; e.currentTarget.style.background = 'rgba(30,8,8,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#443344'; e.currentTarget.style.borderColor = 'rgba(60,30,50,0.3)'; e.currentTarget.style.background = 'transparent' }}
          >
            LOGOUT
          </button>
        </div>
      )}
      </div>

      {/* Character unlock confirmation modal */}
      {confirmUnlock !== null && (() => {
        const def = CHARACTER_DEFS[confirmUnlock as keyof typeof CHARACTER_DEFS]
        const cost = CHARACTER_UNLOCK_COSTS[confirmUnlock]!
        const canAfford = coins >= cost
        return (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.78)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => { setConfirmUnlock(null); setUnlockError(null) }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'rgba(8,8,22,0.95)',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${def.color}55`,
                borderRadius: 18,
                padding: '28px 32px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                boxShadow: `0 12px 48px rgba(0,0,0,0.8), 0 0 30px ${def.color}22`,
                minWidth: 280, maxWidth: 340,
              }}
            >
              <div style={{ fontSize: 28 }}>🔒</div>
              <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 'bold', color: '#ccccff', textAlign: 'center', letterSpacing: 1 }}>
                Unlock <span style={{ color: def.color }}>{def.name}</span>?
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#776688', textAlign: 'center' }}>
                {def.description}
              </div>
              <div style={{
                fontFamily: 'monospace', fontSize: 20, fontWeight: 'bold',
                color: canAfford ? '#ccaa22' : '#553322',
                textShadow: canAfford ? '0 0 10px rgba(160,120,0,0.5)' : 'none',
              }}>
                ◈ {cost}
              </div>
              {!canAfford && (
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#cc4444' }}>
                  Not enough coins — you have ◈ {coins}
                </div>
              )}
              {unlockError && (
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#ff6644', textAlign: 'center' }}>
                  {unlockError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={async () => {
                    setUnlockError(null)
                    const result = await unlockCharacter(confirmUnlock)
                    if (result === true) { setCharacter(confirmUnlock as any); setConfirmUnlock(null) }
                    else setUnlockError(result)
                  }}
                  style={{
                    flex: 1, padding: '10px 0',
                    background: canAfford ? 'rgba(25,25,100,0.8)' : 'rgba(12,12,28,0.6)',
                    border: `1px solid ${canAfford ? def.color + '66' : 'rgba(30,30,60,0.4)'}`,
                    borderRadius: 10,
                    color: canAfford ? '#ccccff' : '#333355',
                    fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', letterSpacing: 1,
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={e => { if (canAfford) { e.currentTarget.style.background = 'rgba(45,45,150,0.9)'; e.currentTarget.style.color = '#ffffff' } }}
                  onMouseLeave={e => { if (canAfford) { e.currentTarget.style.background = 'rgba(25,25,100,0.8)'; e.currentTarget.style.color = '#ccccff' } }}
                >
                  CONFIRM
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmUnlock(null); setUnlockError(null) }}
                  style={{
                    flex: 1, padding: '10px 0',
                    background: 'rgba(20,20,50,0.5)',
                    border: '1px solid rgba(60,60,120,0.35)',
                    borderRadius: 10,
                    color: '#8888cc',
                    fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', letterSpacing: 1,
                    cursor: 'pointer', transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,30,75,0.7)'; e.currentTarget.style.color = '#aaaaff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(20,20,50,0.5)'; e.currentTarget.style.color = '#8888cc' }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
