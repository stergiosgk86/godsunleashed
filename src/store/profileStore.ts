import { create } from 'zustand'
import { useAuthStore } from './authStore'

export interface MetaUpgrades {
  maxHealth: number
  recovery: number
  magnet: number
  might: number
  luck: number
  growth: number
  moveSpeed: number
}

export const UPGRADE_COSTS = [10, 25, 50, 90, 150]
export const UPGRADE_MAX_RANK = 5

function emptyUpgrades(): MetaUpgrades {
  return { maxHealth: 0, recovery: 0, magnet: 0, might: 0, luck: 0, growth: 0, moveSpeed: 0 }
}

interface ProfileStore {
  coins: number
  upgrades: MetaUpgrades
  loaded: boolean
  fetchProfile: () => Promise<void>
  syncProfile: () => Promise<void>
  depositCoins: (amount: number) => void
  purchaseUpgrade: (upgrade: keyof MetaUpgrades) => boolean
  reset: () => void
}

export const useProfileStore = create<ProfileStore>()((set, get) => ({
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
      set({
        coins: data.coins ?? 0,
        upgrades: { ...emptyUpgrades(), ...(data.upgrades ?? {}) },
        loaded: true,
      })
    } catch { /* network error — keep current state */ }
  },

  syncProfile: async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    const { coins, upgrades } = get()
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ coins, upgrades }),
      })
    } catch { /* fire and forget */ }
  },

  depositCoins: (amount) => {
    if (amount <= 0) return
    set(s => ({ coins: s.coins + amount }))
    get().syncProfile()
  },

  purchaseUpgrade: (upgrade) => {
    const { upgrades, coins } = get()
    const rank = upgrades[upgrade]
    if (rank >= UPGRADE_MAX_RANK) return false
    const cost = UPGRADE_COSTS[rank]
    if (coins < cost) return false
    set(s => ({
      coins: s.coins - cost,
      upgrades: { ...s.upgrades, [upgrade]: rank + 1 },
    }))
    get().syncProfile()
    return true
  },

  reset: () => set({ coins: 0, upgrades: emptyUpgrades(), loaded: false }),
}))
