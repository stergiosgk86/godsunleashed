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
import { ACHIEVEMENTS, ACHIEVEMENT_MAP, ACHIEVEMENT_CATEGORIES } from '../game/achievements'
import { AdminPlayersView } from './AdminPlayersView'
import { ControlsView } from './ControlsView'
import { SoundsView } from './SoundsView'
import { useStageStore } from '../store/stageStore'

const CHAR_SPRITE_URL: Record<string, string> = {
  player:          SPRITE_URLS.player,
  char_freyja:     SPRITE_URLS.charFreyja,
  char_witch:      SPRITE_URLS.charWitch,
  char_shade:      SPRITE_URLS.charShade,
  char_zeus:       SPRITE_URLS.charZeus,
  char_ares:       SPRITE_URLS.charAres,
  char_poseidon:   SPRITE_URLS.charPoseidon,
  char_apollo:     SPRITE_URLS.charApollo,
  char_hades:      SPRITE_URLS.charHades,
  char_chronos:    SPRITE_URLS.charChronos,
  char_odin:       SPRITE_URLS.charOdin,
  char_heimdall:   SPRITE_URLS.charHeimdall,
}

const SCALE = 2
const FRAME_W = 32 * SCALE
const FRAME_H = 32 * SCALE
const SHEET_W = 96 * SCALE
const SHEET_H = 128 * SCALE

function CharSprite({ spriteKey, color, menuFrame, menuRow, compact, staticSprite, innerScale }: {
  spriteKey: string
  color: string
  menuFrame?: { fw: number; fh: number; sw: number; sh: number }
  menuRow?: number
  compact?: boolean
  staticSprite?: boolean
  innerScale?: number
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
  const is = innerScale ?? 1
  const dfw = Math.round(fw * sf)
  const dfh = Math.round(fh * sf)
  // Scale the background up by `is`, then offset to show the center of the frame
  const totalSF = sf * is
  const dsw = Math.round(sw * totalSF)
  const dsh = Math.round(sh * totalSF)
  const bfw = Math.round(fw * totalSF)
  const bfh = Math.round(fh * totalSF)
  const bpxBase = Math.round((dfw - bfw) / 2)
  const bpyBase = Math.round((dfh - bfh) / 2)
  const pad = Math.round(16 * sf)

  return (
    <div style={{
      width: dfw + pad, height: dfh + pad,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${color}44`,
      borderRadius: compact ? 7 : 10,
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {staticSprite ? (
        <img src={url} style={{
          width: Math.round(dfw * is), height: Math.round(dfh * is),
          objectFit: 'contain',
          filter: `drop-shadow(0 0 6px ${color}bb)`,
        }} />
      ) : (
        <div style={{
          width: dfw, height: dfh,
          backgroundImage: `url(${url})`,
          backgroundPosition: `${bpxBase - frame * bfw}px ${bpyBase - Math.round((menuRow ?? 0) * bfh)}px`,
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

// ── Collection ────────────────────────────────────────────────────────────────

const COLLECTION_WEAPONS = [
  {
    id: 'wand', label: 'Arcane Wand', color: '#88aaff', icon: '✦',
    description: 'Fires a magic bolt at the nearest enemy',
    upgrades: [
      { id: 'multiShot',  label: 'Multi Shot', description: 'Wand fires an extra bolt per attack (stackable, up to 3×)' },
      { id: 'piercing',   label: 'Piercing',   description: 'Wand bolts pass through enemies' },
    ],
  },
  {
    id: 'aura', label: 'Aura', color: '#9944ff', icon: '◎',
    description: 'Pulses damage to all enemies in range and knocks them back',
    upgrades: [
      { id: 'auraTick',  label: 'Aura Tempo',  description: 'Aura pulses 100ms faster (stackable, up to 3×)' },
      { id: 'auraRange', label: 'Aura Range',  description: 'Expands the aura radius (stackable, up to 3×)' },
    ],
  },
  {
    id: 'orbital', label: 'Spirit Orb', color: '#44ffcc', icon: '◉',
    description: 'An orb orbits you, damaging and knocking back enemies on contact (+1 orb per pick, max 5)',
    upgrades: [
      { id: 'orbSpeed', label: 'Orb Velocity', description: 'Spirit Orbs rotate 25% faster (stackable, up to 3×)' },
      { id: 'orbPower', label: 'Orb Power',    description: 'Spirit Orbs deal 20% more damage (stackable, up to 3×)' },
      { id: 'orbRange', label: 'Orb Reach',    description: 'Spirit Orbs orbit at a wider radius, covering more ground (stackable, up to 2×)' },
    ],
  },
  {
    id: 'boomerang', label: 'Boomerang', color: '#ffaa22', icon: '↩',
    description: 'Throws a disc that flies out then returns, hitting enemies twice',
    upgrades: [],
  },
  {
    id: 'flameTrail', label: 'Flame Trail', color: '#ff6622', icon: '♨',
    description: 'Leaves burning patches as you move that damage nearby enemies',
    upgrades: [],
  },
  {
    id: 'bloodNova', label: 'Blood Nova', color: '#cc2244', icon: '✸',
    description: 'Every 90s wipes all enemies on screen in a massive dark shockwave',
    upgrades: [
      { id: 'bloodNovaCD', label: 'Dark Convergence', description: 'Blood Nova triggers 10s sooner (stackable, up to 4×, down to 50s)' },
    ],
  },
  {
    id: 'lightning', label: 'Thunder Strike', color: '#ddee22', icon: '⚡',
    description: 'Every 4.5s lightning bolts strike 2 random enemies for heavy damage',
    upgrades: [
      { id: 'lightningTargets',  label: 'Storm Surge',   description: 'Thunder Strike hits 1 additional enemy (stackable, up to +2)' },
      { id: 'lightningCooldown', label: 'Thunderhaste',  description: 'Thunder Strike fires 1s faster (stackable, up to 2×)' },
    ],
  },
  {
    id: 'axe', label: 'War Axe', color: '#dd8844', icon: '⚔',
    description: 'Hurls a spinning axe in an arc — hits on the way up and again on the way down',
    upgrades: [],
  },
  {
    id: 'divineShield', label: 'Divine Shield', color: '#ffee66', icon: '◈',
    description: 'Grants periodic invincibility — active for 3s, then recharges for 9s. While active, all damage is blocked.',
    upgrades: [],
  },
  {
    id: 'dualGun', label: 'Dual Sunrays', color: '#ffcc00', icon: '✦✦',
    description: 'Both Equinox (gold) and Solstice (cyan) fire piercing bolts in all 4 diagonal directions. Pick both for staggered double volleys.',
    upgrades: [
      { id: 'dualGunDamage', label: 'Solar Intensity', description: 'Sunray bolts deal 30% more damage (stackable, up to 3×)' },
      { id: 'dualGunSpeed',  label: 'Solar Tempo',     description: 'Sunray guns fire 20% faster (stackable, up to 2×)' },
      { id: 'dualGunExtra',  label: 'Solar Barrage',   description: 'Fires one extra staggered burst per gun per volley (stackable, up to 2×)' },
    ],
  },
  {
    id: 'ravens', label: "Odin's Ravens", color: '#bb77ff', icon: '🪶',
    description: 'Two ravens orbit you, unleashing bomb barrages toward a rotating zone circle — feathers pierce all enemies',
    upgrades: [
      { id: 'ravensCD',    label: "Raven's Fury",   description: 'Ravens bomb 500ms faster (stackable, up to 3×, down to 2s)' },
      { id: 'ravensPower', label: "Raven's Curse",  description: 'Each feather deals 20% more damage (stackable, up to 3×)' },
      { id: 'ravensCount', label: 'Murder of Crows', description: '+2 feathers per bomb set (stackable, up to 2×)' },
    ],
  },
  {
    id: 'spear', label: 'Bifrost Spear', color: '#00ddff', icon: '◆',
    description: 'Hurls a glowing lance in the direction you move, piercing up to 3 enemies per throw',
    upgrades: [
      { id: 'spearCount',    label: 'Spear Barrage',  description: '+1 spear per burst — all fire in rapid succession (up to 6 total, stackable ×5)' },
      { id: 'spearInterval', label: 'Spear Tempo',    description: 'Throws erupt faster and burst tighter (stackable ×3)' },
      { id: 'spearPierce',   label: 'Spear Pierce',   description: '+1 enemy pierced per spear — from 3 up to 5 (stackable ×2)' },
      { id: 'spearSpeed',    label: 'Bracer',          description: '+10% spear velocity (stackable ×5, required for Thousand Spears)' },
      { id: 'spearStorm',    label: 'Thousand Spears', description: 'Evolution — transforms the burst into a never-ending torrent of lances. Requires max Barrage + Bracer ×3.' },
    ],
  },
] as const

const COLLECTION_PASSIVES = [
  { id: 'might',       label: 'Power',        color: '#ff6644', icon: '▲', description: '+10% weapon damage (stackable)' },
  { id: 'vampiric',    label: 'Soul Drain',   color: '#cc3355', icon: '♥', description: 'Each hit restores 0.25% of damage dealt as HP (scales well with fast weapons)' },
  { id: 'echo',        label: 'Echo',         color: '#aaddff', icon: '≋', description: 'Each projectile weapon fires one additional copy per attack — wand, boomerang, axe, sunrays, spear, and Thunder Strike all gain an extra strike (stackable, up to 2×)' },
  { id: 'xpGain',      label: 'Gilded Soul',  color: '#ffcc33', icon: '★', description: '+8% XP gained from all sources (stackable, up to 5×)' },
  { id: 'magnetRange', label: 'Astral Pull',  color: '#66ccff', icon: '◎', description: 'XP orbs are attracted from 50% further away (stackable, up to 3×)' },
  { id: 'dashCooldown',label: 'Swift Dash',   color: '#88aaff', icon: '→', description: '25% shorter dash cooldown' },
  { id: 'dashDistance',label: 'Longer Dash',  color: '#88aaff', icon: '⟶', description: '40% further dash distance' },
] as const

function CollectionView({ onBack }: { onBack: () => void }) {
  return (
    <>
      <ViewHeader color="#44ccaa">COLLECTION</ViewHeader>
      <div style={{ width: '100%', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <span style={{ color: '#88aaff', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 4, flexShrink: 0 }}>⚔ WEAPONS</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, #88aaff44, transparent)' }} />
        </div>

        {COLLECTION_WEAPONS.map(w => (
          <div key={w.id} style={{
            background: 'rgba(10,10,26,0.6)',
            border: `1px solid ${w.color}25`,
            borderLeft: `3px solid ${w.color}99`,
            borderRadius: 10, padding: '10px 14px',
            display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: w.color, fontSize: 17, width: 22, textAlign: 'center', flexShrink: 0, filter: `drop-shadow(0 0 5px ${w.color}99)` }}>
                {w.icon}
              </span>
              <div>
                <div style={{ color: '#ddddff', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', letterSpacing: 1 }}>
                  {w.label.toUpperCase()}
                </div>
                <div style={{ color: '#505070', fontFamily: 'monospace', fontSize: 10, marginTop: 2 }}>
                  {w.description}
                </div>
              </div>
            </div>
            {w.upgrades.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 32 }}>
                {w.upgrades.map(u => (
                  <div key={u.id} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ color: w.color + '77', fontSize: 9, flexShrink: 0 }}>▸</span>
                    <span style={{ color: w.color + 'cc', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', flexShrink: 0 }}>{u.label}</span>
                    <span style={{ color: '#383858', fontFamily: 'monospace', fontSize: 10 }}>— {u.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 2 }}>
          <span style={{ color: '#ffcc44', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 4, flexShrink: 0 }}>★ PASSIVES</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, #ffcc4444, transparent)' }} />
        </div>

        {COLLECTION_PASSIVES.map(p => (
          <div key={p.id} style={{
            background: 'rgba(10,10,26,0.6)',
            border: `1px solid ${p.color}20`,
            borderLeft: `3px solid ${p.color}66`,
            borderRadius: 10, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ color: p.color, fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0, filter: `drop-shadow(0 0 4px ${p.color}77)` }}>
              {p.icon}
            </span>
            <div>
              <div style={{ color: '#ccccff', fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 }}>
                {p.label.toUpperCase()}
              </div>
              <div style={{ color: '#383858', fontFamily: 'monospace', fontSize: 10, marginTop: 2 }}>
                {p.description}
              </div>
            </div>
          </div>
        ))}
      </div>
      <BackButton onBack={onBack} />
    </>
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
        display: 'block', margin: '0 auto', padding: '9px 30px', fontSize: 13, fontFamily: 'monospace', fontWeight: 'normal',
        border: '1px solid rgba(80,80,160,0.2)', borderRadius: 8, cursor: 'pointer', letterSpacing: 1,
        color: '#6666aa', background: 'rgba(20,20,60,0.25)', transition: 'all 0.18s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,30,80,0.55)'; e.currentTarget.style.color = '#9999cc'; e.currentTarget.style.borderColor = 'rgba(100,100,200,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(20,20,60,0.25)'; e.currentTarget.style.color = '#6666aa'; e.currentTarget.style.borderColor = 'rgba(80,80,160,0.2)' }}>
      ← back
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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 12px', borderRadius: 20,
          background: 'rgba(60,60,120,0.25)', border: '1px solid rgba(80,80,160,0.3)',
          color: '#6666aa', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2,
        }}>
          {unlockedCount} / {ACHIEVEMENTS.length} UNLOCKED
        </div>
        <div style={{
          height: 5, flex: 1, marginLeft: 12, borderRadius: 4,
          background: 'rgba(40,40,80,0.5)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${Math.round((unlockedCount / ACHIEVEMENTS.length) * 100)}%`,
            background: 'linear-gradient(90deg, #4444aa, #8866ff)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {ACHIEVEMENT_CATEGORIES.map(cat => {
            const catAchs = cat.ids.map(id => ACHIEVEMENT_MAP[id]).filter(Boolean)
            const catUnlocked = catAchs.filter(a => unlocked.has(a.id)).length
            const allDone = catUnlocked === catAchs.length
            return (
              <div key={cat.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Category header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{
                    color: cat.color, fontFamily: 'monospace', fontSize: 10,
                    fontWeight: 'bold', letterSpacing: 3, flexShrink: 0,
                  }}>
                    {cat.label}
                  </span>
                  <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${cat.color}44, transparent)` }} />
                  <span style={{
                    fontFamily: 'monospace', fontSize: 10, letterSpacing: 1, flexShrink: 0,
                    color: allDone ? cat.color : '#44445a',
                    background: allDone ? `${cat.color}18` : 'rgba(20,20,40,0.4)',
                    border: `1px solid ${allDone ? cat.color + '44' : 'rgba(40,40,80,0.4)'}`,
                    borderRadius: 10, padding: '1px 8px',
                  }}>
                    {catUnlocked}/{catAchs.length}
                  </span>
                </div>

                {/* Achievement rows */}
                {catAchs.map(a => {
                  const done = unlocked.has(a.id)
                  return (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 11px',
                      background: done ? `${cat.color}0d` : 'rgba(255,255,255,0.015)',
                      border: `1px solid ${done ? cat.color + '30' : 'rgba(35,35,65,0.6)'}`,
                      borderLeft: `2px solid ${done ? cat.color + '88' : 'rgba(50,50,90,0.4)'}`,
                      borderRadius: 8,
                      opacity: done ? 1 : 0.38,
                      transition: 'all 0.15s ease',
                    }}>
                      <span style={{
                        fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0,
                        color: done ? cat.color : '#555566',
                        filter: done ? `drop-shadow(0 0 4px ${cat.color}66)` : 'none',
                      }}>
                        {a.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          color: done ? '#ccccff' : '#383850',
                          fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5,
                        }}>
                          {a.name}
                        </div>
                        <div style={{
                          color: done ? '#555577' : '#222238',
                          fontFamily: 'monospace', fontSize: 10, marginTop: 1,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {a.description}
                        </div>
                      </div>
                      {done && (
                        <span style={{
                          color: '#33aa55', fontSize: 11, fontWeight: 'bold', flexShrink: 0,
                          background: 'rgba(40,120,60,0.2)', border: '1px solid rgba(60,160,80,0.3)',
                          borderRadius: 6, padding: '1px 5px',
                        }}>✓</span>
                      )}
                    </div>
                  )
                })}
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
  const { coins, upgrades, purchaseUpgrade, refundUpgrade, refundAllUpgrades, unlockedCharacters, unlockCharacter, maxStage1Level, unlockedStages } = useProfileStore()
  const username = useAuthStore(s => s.username)
  const role = useAuthStore(s => s.role)
  const isSuperAdmin = role === 'super_admin'
  const { setStage } = useStageStore()
  const { selectedCharacter: _selectedCharacter, setCharacter } = useCharacterStore()
  const unlockCostOfSelected = CHARACTER_UNLOCK_COSTS[_selectedCharacter]
  const isSelectedLocked = (unlockCostOfSelected !== undefined || CHARACTER_ACHIEVEMENT_REQUIRED[_selectedCharacter] !== undefined) && !unlockedCharacters.includes(_selectedCharacter)
  const selectedCharacter = isSelectedLocked ? 'ares' : _selectedCharacter
  type MenuView = 'home' | 'shop' | 'characters' | 'stageSelect' | 'statistics' | 'leaderboard' | 'achievements' | 'admin' | 'settings' | 'controls' | 'sounds' | 'collection'
  const VALID_VIEWS = new Set<string>(['home', 'shop', 'characters', 'stageSelect', 'statistics', 'leaderboard', 'achievements', 'admin', 'settings', 'controls', 'sounds', 'collection'])
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
    characters: 'home', shop: 'home', settings: 'home', statistics: 'home', admin: 'home', collection: 'home',
    leaderboard: 'statistics', achievements: 'statistics',
    controls: 'settings', sounds: 'settings',
    stageSelect: 'characters',
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
        minWidth: mob ? 'calc(100vw - 24px)' : (view === 'characters' ? 700 : ['shop', 'leaderboard', 'achievements', 'admin', 'collection'].includes(view) ? 520 : view === 'stageSelect' ? 480 : 420),
        maxWidth: mob ? 'calc(100vw - 24px)' : undefined,
        maxHeight: 'calc(100vh - 180px)',
        height: (!mob && view === 'characters') ? 'calc(100vh - 180px)' : undefined,
        width: (!mob && view === 'characters') ? 700 : undefined,
        boxSizing: 'border-box',
        overflow: (mob && view === 'characters') ? 'auto' : 'hidden',
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
      ) : view === 'collection' ? (
        <CollectionView onBack={() => setView('home')} />
      ) : view === 'admin' ? (
        <AdminPlayersView onBack={() => setView('home')} />
      ) : view === 'stageSelect' ? (
        <>
          <ViewHeader color="#8888ff">SELECT STAGE</ViewHeader>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1, minHeight: 0 }}>

            {/* Stage 1 — available */}
            <div
              onClick={() => { setStage(1); onPlay() }}
              style={{
                position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(15,15,60,0.95) 0%, rgba(30,10,70,0.95) 100%)',
                border: '1px solid rgba(100,80,220,0.6)',
                borderLeft: '4px solid #6655ff',
                borderRadius: 12, padding: '18px 20px',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(80,50,200,0.3)',
                transition: 'all 0.18s ease',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg, rgba(25,20,90,0.98) 0%, rgba(50,20,110,0.98) 100%)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 32px rgba(100,70,255,0.45)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg, rgba(15,15,60,0.95) 0%, rgba(30,10,70,0.95) 100%)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px rgba(80,50,200,0.3)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 18, color: '#ffffff', letterSpacing: 2 }}>
                  STAGE 1
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
                  color: '#44ee88', background: 'rgba(20,80,40,0.5)',
                  border: '1px solid rgba(40,160,80,0.5)', borderRadius: 20,
                  padding: '2px 10px',
                }}>
                  AVAILABLE
                </div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#9988cc', lineHeight: 1.5 }}>
                Olympus Fields — Survive the divine assault
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6655ff', marginTop: 4, letterSpacing: 1 }}>
                ▶ CLICK TO START
              </div>
            </div>

            {/* Stage 2 — locked until level 25 in Stage 1 */}
            {(() => {
              const stage2Unlocked = maxStage1Level >= 60 || unlockedStages.includes(2)
              const progress = Math.min(maxStage1Level, 60)
              return stage2Unlocked ? (
                <div
                  onClick={() => { setStage(2); onPlay() }}
                  style={{
                    position: 'relative', overflow: 'hidden',
                    background: 'linear-gradient(135deg, rgba(40,10,10,0.95) 0%, rgba(70,15,15,0.95) 100%)',
                    border: '1px solid rgba(160,40,40,0.6)',
                    borderLeft: '4px solid #cc3322',
                    borderRadius: 12, padding: '18px 20px',
                    cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(150,30,20,0.3)',
                    transition: 'all 0.18s ease',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg, rgba(60,15,15,0.98) 0%, rgba(90,20,20,0.98) 100%)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 32px rgba(200,50,30,0.45)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg, rgba(40,10,10,0.95) 0%, rgba(70,15,15,0.95) 100%)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px rgba(150,30,20,0.3)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 18, color: '#ffffff', letterSpacing: 2 }}>
                      STAGE 2
                    </div>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
                      color: '#ee6644', background: 'rgba(80,20,10,0.5)',
                      border: '1px solid rgba(160,40,20,0.5)', borderRadius: 20,
                      padding: '2px 10px',
                    }}>
                      AVAILABLE
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#cc8877', lineHeight: 1.5 }}>
                    Underworld Depths — Fight through the dark corridor
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#cc3322', marginTop: 4, letterSpacing: 1 }}>
                    ▶ CLICK TO START
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(10,10,22,0.7)',
                  border: '1px solid rgba(80,20,20,0.4)',
                  borderLeft: '4px solid rgba(100,30,20,0.5)',
                  borderRadius: 12, padding: '18px 20px',
                  cursor: 'default',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 18, color: '#553333', letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                      🔒 STAGE 2
                    </div>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
                      color: '#774444', background: 'rgba(40,10,10,0.6)',
                      border: '1px solid rgba(80,20,20,0.4)', borderRadius: 20,
                      padding: '2px 10px',
                    }}>
                      LOCKED
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#664444', lineHeight: 1.5 }}>
                    Underworld Depths — Fight through the dark corridor
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#885544', letterSpacing: 1 }}>
                    Reach <span style={{ color: '#cc6644', fontWeight: 'bold' }}>Level 60</span> in Stage 1 to unlock
                  </div>
                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(40,20,20,0.6)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${(progress / 60) * 100}%`,
                        background: 'linear-gradient(90deg, #661111, #cc3322)',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#774444', flexShrink: 0 }}>
                      Lv {progress} / 60
                    </span>
                  </div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setStage(2); onPlay() }}
                      style={{
                        marginTop: 4, padding: '7px 0', width: '100%',
                        fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
                        color: '#ffaa22', background: 'rgba(40,25,0,0.7)',
                        border: '1px solid rgba(180,100,0,0.5)', borderRadius: 7, cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(60,35,0,0.9)'; e.currentTarget.style.color = '#ffcc44' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(40,25,0,0.7)'; e.currentTarget.style.color = '#ffaa22' }}
                    >
                      ⚡ ADMIN OVERRIDE
                    </button>
                  )}
                </div>
              )
            })()}

            {/* Coming soon stages */}
            {[
              { num: 3, name: 'Sea of Poseidon' },
              { num: 4, name: 'Forge of Hephaestus' },
            ].map(({ num, name }) => (
              <div
                key={num}
                style={{
                  background: 'rgba(10,10,22,0.6)',
                  border: '1px solid rgba(40,40,70,0.4)',
                  borderLeft: '4px solid rgba(60,50,100,0.5)',
                  borderRadius: 12, padding: '18px 20px',
                  cursor: 'default', opacity: 0.55,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 18, color: '#666688', letterSpacing: 2 }}>
                    STAGE {num}
                  </div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
                    color: '#888899', background: 'rgba(20,20,40,0.5)',
                    border: '1px solid rgba(60,60,100,0.4)', borderRadius: 20,
                    padding: '2px 10px',
                  }}>
                    COMING SOON
                  </div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#555577', lineHeight: 1.5 }}>
                  {name}
                </div>
              </div>
            ))}
          </div>
          <BackButton onBack={() => setView('characters')} />
        </>
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
            // ── Mobile: portrait grid + detail panel ──
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexShrink: 0 }}>
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

              {/* 3-column portrait grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
                width: '100%', flexShrink: 0,
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
                        borderRadius: 10, padding: '8px 4px 6px',
                        cursor: isLocked ? (unlockCost !== undefined ? 'pointer' : 'default') : 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        transition: 'all 0.15s ease',
                        boxShadow: isGridSelected ? `0 0 14px ${def.color}44` : 'none',
                      }}
                    >
                      {isGridSelected && <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: `radial-gradient(ellipse at 50% 40%, ${def.color}22 0%, transparent 70%)`,
                        animation: `char-pulse 2.4s ease-in-out ${i * 0.35}s infinite`,
                      }} />}
                      <div style={{ position: 'relative' }}>
                        <div style={{ opacity: isLocked ? 0.35 : 1 }}>
                          <CharSprite spriteKey={def.spriteKey} color={def.color} menuFrame={def.menuFrame} menuRow={def.menuRow} compact staticSprite={def.staticSprite} innerScale={id === 'poseidon' ? 1.4 : undefined} />
                        </div>
                        {isLocked && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔒</div>
                        )}
                      </div>
                      <span style={{
                        fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold',
                        letterSpacing: 1, textAlign: 'center',
                        color: isLocked ? '#443355' : isGridSelected ? def.color : '#7777aa',
                      }}>
                        {def.name.toUpperCase()}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Selected character detail panel */}
              {(() => {
                const def = CHARACTER_DEFS[selectedCharacter]
                const unlockCost = CHARACTER_UNLOCK_COSTS[selectedCharacter]
                const achievementRequired = CHARACTER_ACHIEVEMENT_REQUIRED[selectedCharacter]
                const isLocked = (unlockCost !== undefined || achievementRequired !== undefined) && !unlockedCharacters.includes(selectedCharacter)
                const canAfford = coins >= (unlockCost ?? 0)
                return (
                  <div style={{
                    width: '100%', flexShrink: 0,
                    background: `radial-gradient(ellipse at 50% 0%, ${def.color}18 0%, transparent 70%)`,
                    border: `1px solid ${def.color}28`,
                    borderRadius: 10, padding: '12px 14px',
                    display: 'flex', flexDirection: 'column', gap: 7,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{
                        color: def.color, fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold',
                        letterSpacing: 3, textShadow: `0 0 12px ${def.color}55`,
                      }}>
                        {def.name.toUpperCase()}
                      </span>
                      <span style={{ color: def.color + '99', fontFamily: 'monospace', fontSize: 10, fontStyle: 'italic' }}>
                        {def.trait}
                      </span>
                    </div>
                    <div style={{ color: '#5a5a88', fontFamily: 'monospace', fontSize: 10, lineHeight: 1.55 }}>
                      {def.description}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                      {def.statLines.map(line => (
                        <span key={line.label} style={{
                          color: line.positive ? '#44cc66' : '#cc4444',
                          fontFamily: 'monospace', fontSize: 10,
                        }}>
                          {line.positive ? '▲' : '▼'} {line.label}
                        </span>
                      ))}
                    </div>
                    {isLocked && achievementRequired !== undefined && (() => {
                      const ach = ACHIEVEMENT_MAP[achievementRequired]
                      return (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#553377', fontWeight: 'bold', letterSpacing: 1, flexShrink: 0 }}>UNLOCK:</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#8855bb' }}>
                            {ach ? `${ach.icon} ${ach.description}` : achievementRequired}
                          </span>
                        </div>
                      )
                    })()}
                    {isLocked && unlockCost !== undefined && (
                      <button
                        type="button"
                        onClick={() => { setUnlockError(null); setConfirmUnlock(selectedCharacter) }}
                        style={{
                          width: '100%', padding: '10px 0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          background: canAfford ? 'rgba(30,15,50,0.8)' : 'rgba(15,10,22,0.8)',
                          border: `1px solid ${canAfford ? def.color + '55' : 'rgba(50,25,70,0.5)'}`,
                          borderRadius: 8, cursor: 'pointer', transition: 'all 0.18s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = canAfford ? 'rgba(50,25,80,0.9)' : 'rgba(22,14,32,0.9)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = canAfford ? 'rgba(30,15,50,0.8)' : 'rgba(15,10,22,0.8)' }}
                      >
                        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', color: canAfford ? '#ccaa22' : '#443322', letterSpacing: 1 }}>◈ {unlockCost}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', color: canAfford ? '#44ff88' : '#1a4433', letterSpacing: 1 }}>UNLOCK</span>
                      </button>
                    )}
                  </div>
                )
              })()}

              {playAfterSelect && (
                <button
                  type="button"
                  onClick={() => setViewRaw('stageSelect')}
                  style={{
                    ...btnBase, padding: '14px 0', fontSize: 16,
                    color: '#ffffff',
                    background: 'linear-gradient(135deg, rgba(20,20,120,0.9) 0%, rgba(50,20,100,0.9) 100%)',
                    borderColor: 'rgba(100,80,220,0.5)',
                    boxShadow: '0 0 20px rgba(50,30,160,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
                    flexShrink: 0,
                    position: 'sticky', bottom: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,30,160,0.95) 0%, rgba(70,30,140,0.95) 100%)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(70,40,200,0.55), inset 0 1px 0 rgba(255,255,255,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(20,20,120,0.9) 0%, rgba(50,20,100,0.9) 100%)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(50,30,160,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' }}
                >
                  SELECT STAGE
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
                            <CharSprite spriteKey={def.spriteKey} color={def.color} menuFrame={def.menuFrame} menuRow={def.menuRow} compact staticSprite={def.staticSprite} innerScale={id === 'poseidon' ? 1.4 : undefined} />
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
                          <CharSprite spriteKey={def.spriteKey} color={def.color} menuFrame={def.menuFrame} menuRow={def.menuRow} staticSprite={def.staticSprite} innerScale={selectedCharacter === 'poseidon' ? 1.4 : undefined} />
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

                      {/* SELECT STAGE */}
                      {playAfterSelect && (
                        <button
                          type="button"
                          onClick={() => setViewRaw('stageSelect')}
                          style={{
                            marginTop: 'auto',
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
                          SELECT STAGE
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

          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              type="button"
              onClick={() => setView('statistics')}
              style={{
                ...btnBase, flex: 1, fontSize: 13,
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
              onClick={() => setView('collection')}
              style={{
                ...btnBase, flex: 1, fontSize: 13,
                color: '#44ccaa', background: 'rgba(5,25,20,0.5)',
                borderColor: 'rgba(20,100,70,0.4)', boxShadow: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(8,40,30,0.7)'; e.currentTarget.style.color = '#66eebb' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(5,25,20,0.5)'; e.currentTarget.style.color = '#44ccaa' }}
            >
              COLLECTION
            </button>
          </div>

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
