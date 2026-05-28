import { create } from 'zustand'
import { useAuthStore } from './authStore'
import { useKeyBindingsStore } from './keyBindingsStore'

export interface MetaUpgrades {
  maxHealth: number
  recovery: number
  magnet: number
  might: number
  luck: number
  growth: number
  moveSpeed: number
  armor: number
  attackSpeed: number
}

export const UPGRADE_COSTS = [50, 125, 250, 450, 750]
export const UPGRADE_MAX_RANK = 5

function emptyUpgrades(): MetaUpgrades {
  return { maxHealth: 0, recovery: 0, magnet: 0, might: 0, luck: 0, growth: 0, moveSpeed: 0, armor: 0, attackSpeed: 0 }
}

// Characters that cost coins — must match server CHARACTER_UNLOCK_COSTS
export const CHARACTER_UNLOCK_COSTS: Partial<Record<string, number>> = { rogue: 100, witch: 150, shade: 300, zeus: 1000, poseidon: 500, apollo: 750, chronos: 1500 }
// Characters unlocked by earning a specific achievement — must match server ACHIEVEMENT_CHARACTER_UNLOCKS
export const CHARACTER_ACHIEVEMENT_REQUIRED: Partial<Record<string, string>> = { hades: 'transcendent' }

interface ProfileStore {
  coins: number
  upgrades: MetaUpgrades
  unlockedCharacters: string[]
  loaded: boolean
  fetchProfile: () => Promise<void>
  // Optimistic local-only update — server credit happens via POST /api/runs
  depositCoins: (amount: number) => void
  // Server-authoritative purchase — returns false if server rejects
  purchaseUpgrade: (upgrade: keyof MetaUpgrades) => Promise<boolean>
  refundUpgrade: (upgrade: keyof MetaUpgrades) => Promise<boolean>
  refundAllUpgrades: () => Promise<boolean>
  unlockCharacter: (character: string) => Promise<string | true>
  reset: () => void
}

export const useProfileStore = create<ProfileStore>()((set) => ({
  coins: 0,
  upgrades: emptyUpgrades(),
  unlockedCharacters: [],
  loaded: false,

  fetchProfile: async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.role) {
        const prevRole = useAuthStore.getState().role
        useAuthStore.getState().setRole(data.role)
        if (data.role !== prevRole && prevRole !== null) {
          if (data.role === 'admin' || data.role === 'super_admin') {
            useAuthStore.getState().showSystemToast('You have been granted admin access', '#88ff88')
          } else {
            useAuthStore.getState().showSystemToast('Your admin access has been revoked', '#ffaa44')
          }
        }
      }
      useKeyBindingsStore.getState().loadFromServer(data.key_bindings)
      set({
        coins: data.coins ?? 0,
        upgrades: { ...emptyUpgrades(), ...(data.upgrades ?? {}) },
        unlockedCharacters: Array.isArray(data.unlocked_characters) ? data.unlocked_characters : [],
        loaded: true,
      })
    } catch { /* network error — keep current state */ }
  },

  depositCoins: (amount) => {
    if (amount <= 0) return
    // Update local state immediately for UI feedback.
    // The actual DB credit is done server-side when POST /api/runs is submitted.
    set(s => ({ coins: s.coins + amount }))
  },

  purchaseUpgrade: async (upgrade) => {
    const token = useAuthStore.getState().token
    if (!token) return false
    try {
      const res = await fetch('/api/upgrades/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ upgrade }),
      })
      if (!res.ok) return false
      const data = await res.json() as { coins: number; upgrades: MetaUpgrades }
      set({ coins: data.coins, upgrades: { ...emptyUpgrades(), ...data.upgrades } })
      return true
    } catch { return false }
  },

  refundUpgrade: async (upgrade) => {
    const token = useAuthStore.getState().token
    if (!token) return false
    try {
      const res = await fetch('/api/upgrades/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ upgrade }),
      })
      if (!res.ok) return false
      const data = await res.json() as { coins: number; upgrades: MetaUpgrades }
      set({ coins: data.coins, upgrades: { ...emptyUpgrades(), ...data.upgrades } })
      return true
    } catch { return false }
  },

  refundAllUpgrades: async () => {
    const token = useAuthStore.getState().token
    if (!token) return false
    try {
      const res = await fetch('/api/upgrades/refund-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return false
      const data = await res.json() as { coins: number; upgrades: MetaUpgrades }
      set({ coins: data.coins, upgrades: { ...emptyUpgrades(), ...data.upgrades } })
      return true
    } catch { return false }
  },

  unlockCharacter: async (character) => {
    const token = useAuthStore.getState().token
    if (!token) return 'Not logged in'
    try {
      const res = await fetch('/api/characters/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ character }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        return body.error ?? `Server error ${res.status}`
      }
      const data = await res.json() as { coins: number; unlocked_characters: string[] }
      set({ coins: data.coins, unlockedCharacters: data.unlocked_characters })
      return true
    } catch { return 'Network error' }
  },

  reset: () => set({ coins: 0, upgrades: emptyUpgrades(), unlockedCharacters: [], loaded: false }),
}))
