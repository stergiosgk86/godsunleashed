import { useState, useRef, useEffect, useCallback } from 'react'
import { useProfileStore, UPGRADE_COSTS, UPGRADE_MAX_RANK, type MetaUpgrades } from '../store/profileStore'
import { useAuthStore } from '../store/authStore'
import { useCharacterStore } from '../store/characterStore'
import { ALL_CHARACTERS, CHARACTER_DEFS } from '../game/characters'
import { SPRITE_URLS } from '../game/assets'
import { ACHIEVEMENTS } from '../game/achievements'
import { AdminPlayersView } from './AdminPlayersView'
import { ControlsView } from './ControlsView'

const CHAR_SPRITE_URL: Record<string, string> = {
  player:       SPRITE_URLS.player,
  char_rogue:   SPRITE_URLS.charRogue,
  char_witch:   SPRITE_URLS.charWitch,
  char_shade: SPRITE_URLS.charShade,
}

// 32×32 px frames, sheet is 3 wide × 4 tall — displayed at 2× scale = 64×64
const SCALE = 2
const FRAME_W = 32 * SCALE
const FRAME_H = 32 * SCALE
const SHEET_W = 96 * SCALE
const SHEET_H = 128 * SCALE

function CharSprite({ spriteKey, color }: { spriteKey: string; color: string }) {
  const [frame, setFrame] = useState(0)
  const url = CHAR_SPRITE_URL[spriteKey]

  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % 3), 200)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      width: FRAME_W + 16, height: FRAME_H + 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#00000033',
      border: `1px solid ${color}33`,
      borderRadius: 8,
      flexShrink: 0,
    }}>
      <div style={{
        width: FRAME_W, height: FRAME_H,
        backgroundImage: `url(${url})`,
        backgroundPosition: `-${frame * FRAME_W}px 0px`,
        backgroundSize: `${SHEET_W}px ${SHEET_H}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        filter: `drop-shadow(0 0 5px ${color}99)`,
      }} />
    </div>
  )
}

const SHOP_UPGRADES: Array<{ id: keyof MetaUpgrades; label: string }> = [
  { id: 'maxHealth', label: 'Max Health' },
  { id: 'recovery',  label: 'Recovery'   },
  { id: 'magnet',    label: 'Magnet'     },
  { id: 'might',     label: 'Might'      },
  { id: 'luck',      label: 'Luck'       },
  { id: 'growth',    label: 'Growth'     },
  { id: 'moveSpeed', label: 'Move Speed' },
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
              {/* Outer glow */}
              <path d={bolt} stroke="rgba(160,190,255,0.18)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {/* Mid glow */}
              <path d={bolt} stroke="rgba(210,230,255,0.45)" strokeWidth="0.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {/* Bright core */}
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

      {/* Deep red pulsing glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 60%, #44000066 0%, transparent 65%)',
        animation: 'menu-glow-pulse 5s ease-in-out infinite',
      }} />

      {/* Secondary purple glow, offset */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 30% 40%, #22004433 0%, transparent 55%)',
        animation: 'menu-glow-pulse 7s ease-in-out 1.5s infinite',
      }} />

      <RainEffect />
      <LightningEffect />

      {/* Floating particles */}
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

      {/* Subtle scanlines */}
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
      <div style={{ color: '#aaaaff', fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 4 }}>
        LEADERBOARD
      </div>

      {loading ? (
        <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>Loading…</div>
      ) : runs.length === 0 ? (
        <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>No runs yet. Be the first!</div>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '28px 1fr 70px 55px 52px 52px',
            gap: '0 8px', padding: '4px 8px',
            color: '#555577', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1,
          }}>
            <span>#</span><span>PLAYER</span><span style={{ textAlign: 'right' }}>SCORE</span>
            <span style={{ textAlign: 'right' }}>KILLS</span><span style={{ textAlign: 'right' }}>TIME</span>
            <span style={{ textAlign: 'right' }}>COINS</span>
          </div>

          {runs.map((r, i) => {
            const isMe = r.id === personalBestId
            return (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 70px 55px 52px 52px',
                gap: '0 8px', padding: '7px 8px',
                background: isMe ? 'rgba(68,68,200,0.18)' : i % 2 === 0 ? '#09091c' : 'transparent',
                border: isMe ? '1px solid #4444aa55' : '1px solid transparent',
                borderRadius: 6,
                fontFamily: 'monospace', fontSize: 12,
              }}>
                <span style={{ color: i < 3 ? ['#ffd700','#c0c0c0','#cd7f32'][i] : '#444466' }}>
                  {i + 1}
                </span>
                <span style={{ color: isMe ? '#aaaaff' : '#888899', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      )}

      <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#333355', textAlign: 'center' }}>
        ◉ multiplayer &nbsp;&nbsp; ★ won
      </div>

      <button type="button" onClick={onBack}
        style={{ width: '100%', padding: '12px 0', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
          border: '2px solid #2a2a50', borderRadius: 8, cursor: 'pointer', letterSpacing: 2,
          color: '#aaaaff', background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {'<-'} BACK
      </button>
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
      <div style={{ color: '#aaaaff', fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 4 }}>
        ACHIEVEMENTS
      </div>
      <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>
        {unlockedCount} / {ACHIEVEMENTS.length} UNLOCKED
      </div>

      {loading ? (
        <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
          {ACHIEVEMENTS.map(a => {
            const done = unlocked.has(a.id)
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 12px',
                background: done ? 'rgba(68,68,160,0.15)' : '#09091c',
                border: `1px solid ${done ? '#4444aa44' : '#1a1a33'}`,
                borderRadius: 7,
                opacity: done ? 1 : 0.45,
              }}>
                <span style={{ fontSize: 18, width: 24, textAlign: 'center', filter: done ? 'none' : 'grayscale(1)' }}>
                  {a.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: done ? '#ccccff' : '#555566', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold' }}>
                    {a.name}
                  </div>
                  <div style={{ color: done ? '#7777aa' : '#333344', fontFamily: 'monospace', fontSize: 11 }}>
                    {a.description}
                  </div>
                </div>
                {done && <span style={{ color: '#44aa44', fontSize: 16 }}>✓</span>}
              </div>
            )
          })}
        </div>
      )}

      <button type="button" onClick={onBack}
        style={{ width: '100%', padding: '12px 0', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
          border: '2px solid #2a2a50', borderRadius: 8, cursor: 'pointer', letterSpacing: 2,
          color: '#aaaaff', background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {'<-'} BACK
      </button>
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
  }
}

const panel: React.CSSProperties = {
  background: '#0d0d1f',
  border: '2px solid #4444aa',
  borderRadius: 12,
  padding: '32px 48px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  boxShadow: '0 0 40px #2222aa44',
  minWidth: 400,
}

const btnBase: React.CSSProperties = {
  width: '100%', padding: '12px 0',
  fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
  border: '2px solid #4444cc', borderRadius: 8,
  cursor: 'pointer', letterSpacing: 2,
}

export function MainMenu({ onPlay, onMultiplayer, onLogout }: {
  onPlay: () => void
  onMultiplayer: () => void
  onLogout: () => void
}) {
  const { coins, upgrades, purchaseUpgrade } = useProfileStore()
  const username = useAuthStore(s => s.username)
  const role = useAuthStore(s => s.role)
  const isSuperAdmin = role === 'super_admin'
  const { selectedCharacter, setCharacter } = useCharacterStore()
  const [view, setView] = useState<'home' | 'shop' | 'characters' | 'leaderboard' | 'achievements' | 'admin' | 'controls'>('home')

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #0d0d22 0%, #07070f 100%)',
    }}>
      <MenuBackground />
      <div style={{
        color: '#cc3333', fontSize: 56, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 10, textShadow: '0 0 30px #ff2222, 0 0 70px #880000',
        marginBottom: 4,
      }}>
        GODS UNLEASHED
      </div>
      <div style={{
        color: '#3a3a66', fontSize: 12, fontFamily: 'monospace', letterSpacing: 6,
        marginBottom: 40,
      }}>
        SURVIVE THE DIVINE
      </div>

      <div style={{ ...panel, minWidth: ['shop', 'characters', 'leaderboard', 'achievements', 'admin'].includes(view) ? 520 : 400 }}>
      {view === 'leaderboard' ? (
        <LeaderboardView onBack={() => setView('home')} />
      ) : view === 'achievements' ? (
        <AchievementsView onBack={() => setView('home')} />
      ) : view === 'controls' ? (
        <ControlsView onBack={() => setView('home')} />
      ) : view === 'admin' ? (
        <AdminPlayersView onBack={() => setView('home')} />
      ) : view === 'characters' ? (
        <>
          <div style={{ color: '#aaaaff', fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 4 }}>
            SELECT CHARACTER
          </div>

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

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ALL_CHARACTERS.map((id, i) => {
              const def = CHARACTER_DEFS[id]
              const isSelected = selectedCharacter === id
              return (
                <div
                  key={id}
                  onClick={() => setCharacter(id)}
                  style={{
                    position: 'relative', overflow: 'hidden',
                    background: isSelected ? '#111130' : '#09091c',
                    border: `2px solid ${isSelected ? def.color : '#1e1e44'}`,
                    borderLeft: `5px solid ${def.color}`,
                    borderRadius: 8, padding: '10px 14px',
                    cursor: 'pointer', transition: 'border-color 0.1s',
                    display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center',
                  }}
                >
                  {/* Pulsing radial glow */}
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: `radial-gradient(ellipse at 30% 50%, ${def.color}55 0%, transparent 70%)`,
                    animation: `char-pulse 2.4s ease-in-out ${i * 0.35}s infinite`,
                  }} />
                  {/* Shimmer sweep */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, width: '30%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)',
                    pointerEvents: 'none',
                    animation: `char-shimmer ${3.5 + i * 0.4}s ease-in-out ${i * 0.6}s infinite`,
                  }} />

                  <CharSprite spriteKey={def.spriteKey} color={def.color} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {isSelected && <span style={{ color: def.color, fontSize: 10 }}>▶</span>}
                      <span style={{ color: '#ccccff', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold' }}>
                        {def.name.toUpperCase()}
                      </span>
                      <span style={{ color: def.color, fontFamily: 'monospace', fontSize: 11, fontStyle: 'italic' }}>
                        {def.trait}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                      {def.statLines.map(line => (
                        <span key={line.label} style={{
                          color: line.positive ? '#44cc66' : '#cc4444',
                          fontFamily: 'monospace', fontSize: 11,
                        }}>
                          {line.positive ? '▲' : '▼'} {line.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setView('home')}
            style={{ ...btnBase, color: '#aaaaff', background: 'transparent', borderColor: '#2a2a50', fontSize: 13 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {'<-'} BACK
          </button>
        </>
      ) : view === 'shop' ? (
        <>
          <div style={{ color: '#aaaaff', fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 4 }}>
            SHOP
          </div>

          <div style={{ color: '#ccaa22', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold', textShadow: '0 0 8px #886600' }}>
            ◈ {coins}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SHOP_UPGRADES.map(upg => {
              const rank = upgrades[upg.id] ?? 0
              const isMax = rank >= UPGRADE_MAX_RANK
              const cost = isMax ? null : UPGRADE_COSTS[rank]
              const canAfford = cost !== null && coins >= cost

              return (
                <div key={upg.id} style={{
                  background: '#09091c', border: '1px solid #1e1e44',
                  borderRadius: 8, padding: '10px 14px',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      color: '#ccccff', fontFamily: 'monospace', fontSize: 13,
                      fontWeight: 'bold', flex: 1,
                    }}>
                      {upg.label.toUpperCase()}
                    </span>

                    <div style={{ display: 'flex', gap: 3 }}>
                      {Array.from({ length: UPGRADE_MAX_RANK }).map((_, i) => (
                        <span key={i} style={{
                          color: i < rank ? '#ffcc33' : '#2a2a50',
                          fontSize: 11, lineHeight: 1,
                        }}>●</span>
                      ))}
                    </div>

                    {isMax ? (
                      <span style={{
                        color: '#44aa44', fontFamily: 'monospace', fontSize: 11,
                        fontWeight: 'bold', letterSpacing: 1, width: 90, textAlign: 'right',
                      }}>
                        MAX
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 90, justifyContent: 'flex-end' }}>
                        <span style={{
                          color: canAfford ? '#ccaa22' : '#554422',
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
                            background: canAfford ? '#1a1a66' : '#0a0a1a',
                            border: `1px solid ${canAfford ? '#4444cc' : '#1a1a33'}`,
                            borderRadius: 4,
                            color: canAfford ? '#aaaaff' : '#333355',
                            fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold',
                            cursor: canAfford ? 'pointer' : 'not-allowed',
                          }}
                          onMouseEnter={e => { if (canAfford) e.currentTarget.style.background = '#2828aa' }}
                          onMouseLeave={e => { if (canAfford) e.currentTarget.style.background = '#1a1a66' }}
                        >
                          BUY
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'monospace', fontSize: 11 }}>
                    {rank > 0 ? (
                      <span style={{ color: '#44aa66' }}>{upgradeStat(upg.id, rank)}</span>
                    ) : (
                      <span style={{ color: '#444466' }}>no bonus yet</span>
                    )}
                    {!isMax && (
                      <>
                        <span style={{ color: '#333355' }}>→</span>
                        <span style={{ color: '#7777aa' }}>{upgradeStat(upg.id, rank + 1)}</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setView('home')}
            style={{
              ...btnBase, color: '#aaaaff', background: 'transparent',
              borderColor: '#2a2a50', fontSize: 13,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {'<-'} BACK
          </button>
        </>
      ) : (
        <>
          <div style={{ color: '#5555ee', fontSize: 11, fontFamily: 'monospace', letterSpacing: 4 }}>
            ▶ {username ?? ''}
          </div>

          <div style={{ color: '#cc9922', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold', textShadow: '0 0 8px #886600' }}>
            ◈ {coins}
          </div>

          <div style={{ width: '100%', height: 1, background: '#1a1a3a' }} />

          <button
            type="button"
            onClick={() => setView('characters')}
            style={{
              ...btnBase, fontSize: 13,
              color: '#aaaaff', background: 'transparent',
              borderColor: '#2a2a55', boxShadow: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            CHARACTER
          </button>

          <button
            type="button"
            onClick={() => setView('shop')}
            style={{
              ...btnBase, fontSize: 13,
              color: '#aaaaff', background: 'transparent',
              borderColor: '#2a2a55', boxShadow: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            SHOP
          </button>

          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              type="button"
              onClick={() => setView('leaderboard')}
              style={{
                ...btnBase, flex: 1, fontSize: 12,
                color: '#ccaa44', background: 'transparent',
                borderColor: '#443311', boxShadow: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1a1108')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              LEADERBOARD
            </button>
            <button
              type="button"
              onClick={() => setView('achievements')}
              style={{
                ...btnBase, flex: 1, fontSize: 12,
                color: '#9944cc', background: 'transparent',
                borderColor: '#331144', boxShadow: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#120818')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              ACHIEVEMENTS
            </button>
          </div>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setView('admin')}
              style={{
                ...btnBase, fontSize: 12,
                color: '#ff6666', background: 'transparent',
                borderColor: '#661111', boxShadow: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1a0808')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              ADMIN PANEL
            </button>
          )}

          <button
            type="button"
            onClick={() => setView('controls')}
            style={{
              ...btnBase, fontSize: 13,
              color: '#aaaaff', background: 'transparent',
              borderColor: '#2a2a55', boxShadow: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            CONTROLS
          </button>

          <button
            type="button"
            onClick={onPlay}
            style={{
              ...btnBase, padding: '14px 0', fontSize: 16,
              color: '#ffffff', background: '#1e1e88',
              borderColor: '#4444cc', boxShadow: '0 0 20px #2222aa88',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2828aa')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1e1e88')}
          >
            SINGLEPLAYER
          </button>

          <button
            type="button"
            onClick={onMultiplayer}
            style={{
              ...btnBase, padding: '12px 0', fontSize: 14,
              color: '#88ffcc', background: 'transparent',
              borderColor: '#228855', boxShadow: '0 0 12px #22885544',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#0a2218')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            MULTIPLAYER
          </button>

          <div style={{ width: '100%', height: 1, background: '#1a1a3a' }} />

          <button
            type="button"
            onClick={onLogout}
            style={{
              ...btnBase, fontSize: 12,
              color: '#554444', background: 'transparent',
              borderColor: '#2a1a1a', boxShadow: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#aa4444'; e.currentTarget.style.borderColor = '#441111' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#554444'; e.currentTarget.style.borderColor = '#2a1a1a' }}
          >
            LOGOUT
          </button>
        </>
      )}
      </div>
    </div>
  )
}
