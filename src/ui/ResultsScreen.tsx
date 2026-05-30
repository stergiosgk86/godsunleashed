import { useEffect, useState } from 'react'
import { useGameStore, UPGRADE_POOL, DASH_COOLDOWN_MS, type UpgradeId } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'

const PRIMARY_WEAPON_IDS = new Set<UpgradeId>([
  'wand', 'aura', 'orbital', 'boomerang', 'flameTrail',
  'bloodNova', 'lightning', 'axe', 'equinox', 'solstice', 'ravens',
])

const STACKABLE_IDS = new Set<UpgradeId>([
  'multiShot', 'auraTick', 'auraRange', 'orbital', 'orbSpeed', 'orbPower', 'orbRange',
  'bloodNovaCD', 'lightningTargets', 'lightningCooldown', 'might', 'xpGain', 'magnetRange',
  'dualGunDamage', 'dualGunSpeed', 'dualGunExtra', 'echo',
  'ravensCD', 'ravensPower', 'ravensCount', 'dashCooldown', 'dashDistance',
])

function fmtTime(ms: number): string {
  if (!ms) return '--:--'
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function fmtNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return String(Math.round(n))
}

type StoreState = ReturnType<typeof useGameStore.getState>

function getUpgradeLevel(id: UpgradeId, s: StoreState): number {
  switch (id) {
    case 'wand':              return s.wand ? 1 : 0
    case 'piercing':          return s.piercing ? 1 : 0
    case 'multiShot':         return s.multiShot
    case 'aura':              return s.aura > 0 ? 1 : 0
    case 'auraTick':          return s.auraTick
    case 'auraRange':         return s.auraRange
    case 'orbital':           return s.orbital
    case 'orbSpeed':          return s.orbSpeed
    case 'orbPower':          return s.orbPower
    case 'orbRange':          return s.orbRange
    case 'boomerang':         return s.boomerang ? 1 : 0
    case 'flameTrail':        return s.flameTrail ? 1 : 0
    case 'bloodNova':         return s.bloodNova ? 1 : 0
    case 'bloodNovaCD':       return s.bloodNovaCD
    case 'vampiric':          return s.vampiric ? 1 : 0
    case 'lightning':         return s.lightning ? 1 : 0
    case 'lightningTargets':  return s.lightningTargets
    case 'lightningCooldown': return s.lightningCooldown
    case 'might':             return s.mightPicks
    case 'axe':               return s.axe ? 1 : 0
    case 'divineShield':      return s.divineShield ? 1 : 0
    case 'xpGain':            return s.xpGain
    case 'magnetRange':       return s.magnetRange
    case 'equinox':           return s.equinox ? 1 : 0
    case 'solstice':          return s.solstice ? 1 : 0
    case 'dualGunDamage':     return s.dualGunDamage
    case 'dualGunSpeed':      return s.dualGunSpeed
    case 'dualGunExtra':      return s.dualGunExtra
    case 'echo':              return s.echo
    case 'ravens':            return s.ravens ? 1 : 0
    case 'ravensCD':          return s.ravensCD
    case 'ravensPower':       return s.ravensPower
    case 'ravensCount':       return s.ravensCount
    case 'dashCooldown': {
      if (s.dashCooldown >= DASH_COOLDOWN_MS) return 0
      return Math.max(1, Math.round(Math.log(DASH_COOLDOWN_MS / Math.max(400, s.dashCooldown)) / Math.log(1 / 0.75)))
    }
    case 'dashDistance': return Math.round((s.dashDistance - 1) / 0.4)
    default: return 0
  }
}

function chipLabel(id: UpgradeId, label: string, level: number): string {
  if (id === 'orbital') return `${label} ×${level}`
  if (STACKABLE_IDS.has(id)) return `${label} lv ${level}`
  return label
}

function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ color: '#666688', fontFamily: 'monospace', fontSize: 12, letterSpacing: 1 }}>
        {label}
      </span>
      <span style={{
        color: accent ? '#ffcc33' : '#aaaaff',
        fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold',
      }}>
        {value}
      </span>
    </div>
  )
}

function Chip({ label, variant }: { label: string; variant: 'weapon' | 'upgrade' }) {
  const isWeapon = variant === 'weapon'
  return (
    <div style={{
      padding: '4px 9px',
      border: `1px solid ${isWeapon ? '#aa8833' : '#4455aa'}`,
      borderRadius: 4,
      background: isWeapon ? '#1a1508' : '#0d0d20',
      color: isWeapon ? '#ffdd88' : '#9999dd',
      fontFamily: 'monospace',
      fontSize: 11,
      letterSpacing: 0.5,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </div>
  )
}

function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth <= 640)
  useEffect(() => {
    const fn = () => setMob(window.innerWidth <= 640)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mob
}

const btnBase: React.CSSProperties = {
  flex: 1, padding: '11px 0',
  fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold',
  border: '2px solid', borderRadius: 8,
  cursor: 'pointer', letterSpacing: 2,
}

export function ResultsScreen({ onPlayAgain, onMainMenu, quitMode = false }: {
  onPlayAgain: () => void
  onMainMenu: () => void
  quitMode?: boolean
}) {
  const isDead = useGameStore(s => s.isDead)
  const isWon = useGameStore(s => s.isWon)
  const timeSurvived = useGameStore(s => s.timeSurvived)
  const kills = useGameStore(s => s.kills)
  const bossKills = useGameStore(s => s.bossKills)
  const damageDealt = useGameStore(s => s.damageDealt)
  const sessionCoins = useGameStore(s => s.sessionCoins)
  const level = useGameStore(s => s.level)
  const depositCoins = useProfileStore(s => s.depositCoins)
  const mob = useIsMobile()

  const visible = isDead || isWon || quitMode

  // Freeze-frame the build at the moment the screen appears
  const [buildSnapshot, setBuildSnapshot] = useState<StoreState | null>(null)
  useEffect(() => {
    if (visible) {
      if (!buildSnapshot) setBuildSnapshot(useGameStore.getState())
    } else {
      setBuildSnapshot(null)
    }
  }, [visible])

  useEffect(() => {
    if (visible) depositCoins(sessionCoins)
  }, [visible])

  if (!visible || !buildSnapshot) return null

  const accentColor = quitMode ? '#8888cc' : isWon ? '#ffcc00' : '#cc2222'
  const borderColor = quitMode ? '#333366' : isWon ? '#886600' : '#661111'
  const glowColor = quitMode ? '#22224488' : isWon ? '#aa880044' : '#44000088'
  const sepColor = quitMode ? '#1a1a2a' : isWon ? '#2a2010' : '#2a1010'
  const title = quitMode ? 'RUN ENDED' : isWon ? 'YOU SURVIVED' : 'YOU DIED'
  const subtitle = quitMode ? 'QUIT TO MENU' : isWon ? 'THE NIGHT HAS ENDED' : 'SLAIN IN BATTLE'

  // Build active item lists
  const weapons: { id: UpgradeId; label: string }[] = []
  const upgrades: { id: UpgradeId; label: string }[] = []
  for (const u of UPGRADE_POOL) {
    const lvl = getUpgradeLevel(u.id, buildSnapshot)
    if (lvl <= 0) continue
    const label = chipLabel(u.id, u.label, lvl)
    if (PRIMARY_WEAPON_IDS.has(u.id)) {
      weapons.push({ id: u.id, label })
    } else {
      upgrades.push({ id: u.id, label })
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.82)',
      zIndex: 60,
      padding: 16,
      boxSizing: 'border-box',
      overflowY: 'auto',
    }}>
      <div style={{
        background: '#0d0d1f',
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
        padding: mob ? '24px 18px' : '32px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: mob ? 16 : 20,
        boxShadow: `0 0 60px ${glowColor}`,
        width: mob ? '100%' : undefined,
        maxWidth: mob ? undefined : 780,
        minWidth: mob ? undefined : 540,
        boxSizing: 'border-box',
        maxHeight: '94vh',
        overflowY: 'auto',
      }}>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            color: accentColor,
            fontSize: mob ? 24 : 32,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            letterSpacing: 4,
            textShadow: `0 0 20px ${accentColor}`,
          }}>
            {title}
          </div>
          <div style={{
            color: isWon ? '#886633' : '#663333',
            fontFamily: 'monospace',
            fontSize: 10,
            letterSpacing: 3,
            marginTop: 4,
          }}>
            {subtitle}
          </div>
        </div>

        <div style={{ height: 1, background: sepColor }} />

        {/* Body: stats + build */}
        <div style={{
          display: 'flex',
          flexDirection: mob ? 'column' : 'row',
          gap: mob ? 16 : 32,
          alignItems: mob ? 'stretch' : 'flex-start',
        }}>

          {/* Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: mob ? undefined : 200 }}>
            <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 10, letterSpacing: 3, marginBottom: 2 }}>
              RUN SUMMARY
            </div>
            <StatRow label="TIME SURVIVED" value={fmtTime(timeSurvived)} />
            <StatRow label="LEVEL REACHED" value={level} />
            <StatRow label="ENEMIES KILLED" value={fmtNum(kills)} />
            {bossKills > 0 && <StatRow label="BOSS KILLS" value={bossKills} />}
            <StatRow label="DAMAGE DEALT" value={fmtNum(damageDealt)} />
            <StatRow label="COINS EARNED" value={`◈ ${sessionCoins}`} accent />
            <div style={{ color: '#444466', fontFamily: 'monospace', fontSize: 10 }}>
              coins saved to your profile
            </div>
          </div>

          {!mob && <div style={{ width: 1, background: '#1a1a2a', alignSelf: 'stretch' }} />}
          {mob && <div style={{ height: 1, background: sepColor }} />}

          {/* Build */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ color: '#555577', fontFamily: 'monospace', fontSize: 10, letterSpacing: 3, marginBottom: 2 }}>
              YOUR BUILD
            </div>

            {weapons.length > 0 && (
              <div>
                <div style={{ color: '#aa8833', fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>
                  WEAPONS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {weapons.map(w => <Chip key={w.id} label={w.label} variant="weapon" />)}
                </div>
              </div>
            )}

            {upgrades.length > 0 && (
              <div>
                <div style={{ color: '#4455aa', fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>
                  UPGRADES & PASSIVES
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {upgrades.map(u => <Chip key={u.id} label={u.label} variant="upgrade" />)}
                </div>
              </div>
            )}

            {weapons.length === 0 && upgrades.length === 0 && (
              <div style={{ color: '#333355', fontFamily: 'monospace', fontSize: 11 }}>
                No upgrades this run
              </div>
            )}
          </div>
        </div>

        <div style={{ height: 1, background: sepColor }} />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          {quitMode ? (
            <button
              onClick={onMainMenu}
              style={{
                ...btnBase,
                color: '#ffffff',
                background: '#2a2a55',
                borderColor: '#6666aa',
                boxShadow: '0 0 12px #33336688',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#3a3a77')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2a2a55')}
            >
              DONE
            </button>
          ) : (
            <>
              <button
                onClick={onPlayAgain}
                style={{
                  ...btnBase,
                  color: '#ffffff',
                  background: isWon ? '#664400' : '#2222aa',
                  borderColor: isWon ? '#ffaa00' : '#4444cc',
                  boxShadow: isWon ? '0 0 12px #88440066' : '0 0 12px #2222aa66',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = isWon ? '#885500' : '#3333cc')}
                onMouseLeave={e => (e.currentTarget.style.background = isWon ? '#664400' : '#2222aa')}
              >
                PLAY AGAIN
              </button>
              <button
                onClick={onMainMenu}
                style={{ ...btnBase, color: '#888899', background: 'transparent', borderColor: '#2a2a44' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#111122')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                MAIN MENU
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
