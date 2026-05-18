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
}

export const UPGRADE_COSTS = [50, 125, 250, 450, 750]
export const UPGRADE_MAX_RANK = 5

function emptyUpgrades(): MetaUpgrades {
  return { maxHealth: 0, recovery: 0, magnet: 0, might: 0, luck: 0, growth: 0, moveSpeed: 0, armor: 0 }
}

interface ProfileStore {
  coins: number
  upgrades: MetaUpgrades
  loaded: boolean
  fetchProfile: () => Promise<void>
  // Optimistic local-only update — server credit happens via POST /api/runs
  depositCoins: (amount: number) => void
  // Server-authoritative purchase — returns false if server rejects
  purchaseUpgrade: (upgrade: keyof MetaUpgrades) => Promise<boolean>
  refundUpgrade: (upgrade: keyof MetaUpgrades) => Promise<boolean>
  reset: () => void
}

export const useProfileStore = create<ProfileStore>()((set) => ({
  coins: 0,
  upgrades: emptyUpgrades(),
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
      if (data.role) useAuthStore.getState().setRole(data.role)
      useKeyBindingsStore.getState().loadFromServer(data.key_bindings)
      set({
        coins: data.coins ?? 0,
        upgrades: { ...emptyUpgrades(), ...(data.upgrades ?? {}) },
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

  reset: () => set({ coins: 0, upgrades: emptyUpgrades(), loaded: false }),
}))
