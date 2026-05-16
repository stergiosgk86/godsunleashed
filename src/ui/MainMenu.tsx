import { useState, useRef } from 'react'
import { useProfileStore, UPGRADE_COSTS, UPGRADE_MAX_RANK, type MetaUpgrades } from '../store/profileStore'
import { useCharacterStore } from '../store/characterStore'
import { ALL_CHARACTERS, CHARACTER_DEFS } from '../game/characters'

const SHOP_UPGRADES: Array<{ id: keyof MetaUpgrades; label: string; description: string }> = [
  { id: 'maxHealth', label: 'Max Health', description: '+10% max HP per rank'          },
  { id: 'recovery',  label: 'Recovery',   description: '+0.1 HP/sec regen per rank'    },
  { id: 'magnet',    label: 'Magnet',     description: '+10% pickup range per rank'    },
  { id: 'might',     label: 'Might',      description: '+5% base damage per rank'      },
  { id: 'luck',      label: 'Luck',       description: '+1% coin drop chance per rank' },
]

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

export function MainMenu({ onPlay, onMultiplayer }: { onPlay: () => void; onMultiplayer: () => void }) {
  const { profiles, activeProfileId, createProfile, selectProfile, deleteProfile, purchaseUpgrade } = useProfileStore()
  const { selectedCharacter, setCharacter } = useCharacterStore()
  const [newName, setNewName] = useState('')
  const nameRef = useRef('')
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState<'profiles' | 'shop' | 'characters'>('profiles')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [deleteHoverId, setDeleteHoverId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const activeProfile = profiles.find(p => p.id === activeProfileId)

  function handleCreate() {
    const trimmed = nameRef.current.trim()
    if (!trimmed) return
    createProfile(trimmed)
    nameRef.current = ''
    setNewName('')
    setCreating(false)
  }

  const canPlay = !!activeProfileId

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #0d0d22 0%, #07070f 100%)',
    }}>
      <div style={{
        color: '#cc3333', fontSize: 56, fontFamily: 'monospace', fontWeight: 'bold',
        letterSpacing: 10, textShadow: '0 0 30px #ff2222, 0 0 70px #880000',
        marginBottom: 4,
      }}>
        VAMPIRES
      </div>
      <div style={{
        color: '#3a3a66', fontSize: 12, fontFamily: 'monospace', letterSpacing: 6,
        marginBottom: 40,
      }}>
        SURVIVE THE NIGHT
      </div>

      <div style={{ ...panel, minWidth: view === 'shop' || view === 'characters' ? 500 : 400 }}>
      {view === 'characters' ? (
        <>
          <div style={{ color: '#aaaaff', fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 4 }}>
            SELECT CHARACTER
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ALL_CHARACTERS.map(id => {
              const def = CHARACTER_DEFS[id]
              const isSelected = selectedCharacter === id
              return (
                <div
                  key={id}
                  onClick={() => setCharacter(id)}
                  style={{
                    background: isSelected ? '#111130' : '#09091c',
                    border: `2px solid ${isSelected ? def.color : '#1e1e44'}`,
                    borderLeft: `5px solid ${def.color}`,
                    borderRadius: 8, padding: '10px 14px',
                    cursor: 'pointer', transition: 'border-color 0.1s',
                    display: 'flex', flexDirection: 'column', gap: 5,
                  }}
                >
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
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setView('profiles')}
            style={{ ...btnBase, color: '#aaaaff', background: 'transparent', borderColor: '#2a2a50', fontSize: 13 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#111133')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {'<-'} BACK
          </button>
        </>
      ) : view === 'shop' && activeProfile ? (
        <>
          <div style={{ color: '#aaaaff', fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 4 }}>
            SHOP
          </div>

          <div style={{ color: '#ccaa22', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold', textShadow: '0 0 8px #886600' }}>
            ◈ {activeProfile.coins}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SHOP_UPGRADES.map(upg => {
              const rank = activeProfile.upgrades[upg.id]
              const isMax = rank >= UPGRADE_MAX_RANK
              const cost = isMax ? null : UPGRADE_COSTS[rank]
              const canAfford = cost !== null && activeProfile.coins >= cost

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

                  <span style={{ color: '#555577', fontFamily: 'monospace', fontSize: 11 }}>
                    {upg.description}
                  </span>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setView('profiles')}
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
        <div style={{
          color: '#6666aa', fontSize: 12, fontFamily: 'monospace', letterSpacing: 4,
          marginBottom: 4,
        }}>
          SELECT PROFILE
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {profiles.map(p => {
            const isActive = p.id === activeProfileId
            const isHovered = hoveredId === p.id
            return (
              <div
                key={p.id}
                onClick={() => { if (confirmDeleteId === p.id) { setConfirmDeleteId(null) } else { selectProfile(p.id) } }}
                onMouseEnter={() => setHoveredId(p.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: isActive ? '#151530' : isHovered ? '#0f0f25' : '#09091c',
                  border: `2px solid ${isActive ? '#5555ee' : isHovered ? '#333366' : '#1e1e44'}`,
                  borderRadius: 8, cursor: 'pointer',
                  transition: 'border-color 0.1s, background 0.1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {isActive && (
                    <span style={{ color: '#5555ee', fontSize: 10 }}>▶</span>
                  )}
                  <span style={{
                    color: isActive ? '#ddddff' : '#777799',
                    fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold',
                  }}>
                    {p.name}
                  </span>
                  <span style={{ color: '#cc9922', fontFamily: 'monospace', fontSize: 12 }}>
                    ◈ {p.coins}
                  </span>
                </div>
                {confirmDeleteId === p.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#cc4444', fontFamily: 'monospace', fontSize: 11 }}>Delete?</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteProfile(p.id); setConfirmDeleteId(null) }}
                      style={{
                        background: '#440000', border: '1px solid #cc4444',
                        color: '#ff6666', fontSize: 11, cursor: 'pointer', padding: '1px 6px',
                        fontFamily: 'monospace', borderRadius: 3,
                      }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                      style={{
                        background: 'transparent', border: '1px solid #333355',
                        color: '#777799', fontSize: 11, cursor: 'pointer', padding: '1px 6px',
                        fontFamily: 'monospace', borderRadius: 3,
                      }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(p.id) }}
                    onMouseEnter={() => setDeleteHoverId(p.id)}
                    onMouseLeave={() => setDeleteHoverId(null)}
                    style={{
                      background: 'transparent', border: 'none',
                      color: deleteHoverId === p.id ? '#cc4444' : '#333355',
                      fontSize: 14, cursor: 'pointer', padding: '2px 6px',
                      fontFamily: 'monospace', transition: 'color 0.1s',
                    }}
                    title="Delete profile"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}

          {profiles.length === 0 && !creating && (
            <div style={{
              color: '#333355', fontFamily: 'monospace', fontSize: 13,
              textAlign: 'center', padding: '12px 0',
            }}>
              No profiles — create one to begin
            </div>
          )}
        </div>

        {creating ? (
          <div style={{ width: '100%', display: 'flex', gap: 8 }}>
            <input
              autoFocus
              value={newName}
              onChange={e => { setNewName(e.target.value); nameRef.current = e.target.value }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setCreating(false); setNewName('') }
              }}
              maxLength={20}
              placeholder="Enter name..."
              style={{
                flex: 1, padding: '9px 12px',
                background: '#060612', border: '2px solid #4444aa', borderRadius: 6,
                color: '#ffffff', fontFamily: 'monospace', fontSize: 14, outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleCreate}
              style={{
                padding: '9px 16px',
                background: '#113311', border: '2px solid #337733', borderRadius: 6,
                color: '#88cc88', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName(''); nameRef.current = '' }}
              style={{
                padding: '9px 12px',
                background: 'transparent', border: '2px solid #333355', borderRadius: 6,
                color: '#666688', fontFamily: 'monospace', fontSize: 13, cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            style={{
              ...btnBase, fontSize: 13,
              color: '#555577', background: 'transparent',
              border: '2px dashed #2a2a50',
              boxShadow: 'none',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#8888bb'
              e.currentTarget.style.borderColor = '#4444aa'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#555577'
              e.currentTarget.style.borderColor = '#2a2a50'
            }}
          >
            + NEW PROFILE
          </button>
        )}

        <div style={{ width: '100%', height: 1, background: '#1a1a3a', margin: '4px 0' }} />

        <button
          type="button"
          onClick={() => setView('characters')}
          disabled={!canPlay}
          style={{
            ...btnBase, fontSize: 13,
            color: canPlay ? '#aaaaff' : '#333355',
            background: 'transparent',
            borderColor: canPlay ? '#2a2a55' : '#1a1a33',
            boxShadow: 'none',
            cursor: canPlay ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={e => { if (canPlay) e.currentTarget.style.background = '#111133' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          CHARACTER
        </button>

        <button
          type="button"
          onClick={() => setView('shop')}
          disabled={!canPlay}
          style={{
            ...btnBase, fontSize: 13,
            color: canPlay ? '#aaaaff' : '#333355',
            background: 'transparent',
            borderColor: canPlay ? '#2a2a55' : '#1a1a33',
            boxShadow: 'none',
            cursor: canPlay ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={e => { if (canPlay) e.currentTarget.style.background = '#111133' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          SHOP
        </button>

        <button
          type="button"
          onClick={onPlay}
          disabled={!canPlay}
          style={{
            ...btnBase,
            padding: '14px 0', fontSize: 16,
            color: canPlay ? '#ffffff' : '#333355',
            background: canPlay ? '#1e1e88' : '#09090f',
            borderColor: canPlay ? '#4444cc' : '#1a1a33',
            boxShadow: canPlay ? '0 0 20px #2222aa88' : 'none',
            cursor: canPlay ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={e => { if (canPlay) e.currentTarget.style.background = '#2828aa' }}
          onMouseLeave={e => { if (canPlay) e.currentTarget.style.background = '#1e1e88' }}
        >
          SINGLEPLAYER
        </button>

        <button
          type="button"
          onClick={onMultiplayer}
          disabled={!canPlay}
          style={{
            ...btnBase,
            padding: '12px 0', fontSize: 14,
            color: canPlay ? '#88ffcc' : '#333355',
            background: 'transparent',
            borderColor: canPlay ? '#228855' : '#1a1a33',
            boxShadow: canPlay ? '0 0 12px #22885544' : 'none',
            cursor: canPlay ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={e => { if (canPlay) e.currentTarget.style.background = '#0a2218' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          MULTIPLAYER
        </button>
        </>
      )}
      </div>
    </div>
  )
}
