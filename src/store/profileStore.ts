import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MetaUpgrades {
  maxHealth: number
  recovery: number
  magnet: number
  might: number
  luck: number
}

export interface Profile {
  id: string
  name: string
  coins: number
  upgrades: MetaUpgrades
}

// Cost to advance from rank N to N+1 (index = current rank, 0-based)
export const UPGRADE_COSTS = [10, 25, 50, 90, 150]
export const UPGRADE_MAX_RANK = 5

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function emptyUpgrades(): MetaUpgrades {
  return { maxHealth: 0, recovery: 0, magnet: 0, might: 0, luck: 0 }
}

interface ProfileStore {
  profiles: Profile[]
  activeProfileId: string | null
  createProfile: (name: string) => void
  selectProfile: (id: string) => void
  deleteProfile: (id: string) => void
  depositCoins: (amount: number) => void
  purchaseUpgrade: (upgrade: keyof MetaUpgrades) => boolean
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,

      createProfile: (name) => {
        const profile: Profile = {
          id: makeId(),
          name: name.trim(),
          coins: 0,
          upgrades: emptyUpgrades(),
        }
        set(s => ({ profiles: [...s.profiles, profile], activeProfileId: profile.id }))
      },

      selectProfile: (id) => set({ activeProfileId: id }),

      deleteProfile: (id) => set(s => ({
        profiles: s.profiles.filter(p => p.id !== id),
        activeProfileId: s.activeProfileId === id ? null : s.activeProfileId,
      })),

      depositCoins: (amount) => {
        if (amount <= 0) return
        const { activeProfileId, profiles } = get()
        if (!activeProfileId) return
        set({
          profiles: profiles.map(p =>
            p.id === activeProfileId ? { ...p, coins: p.coins + amount } : p
          ),
        })
      },

      purchaseUpgrade: (upgrade) => {
        const { activeProfileId, profiles } = get()
        if (!activeProfileId) return false
        const profile = profiles.find(p => p.id === activeProfileId)
        if (!profile) return false
        const rank = profile.upgrades[upgrade]
        if (rank >= UPGRADE_MAX_RANK) return false
        const cost = UPGRADE_COSTS[rank]
        if (profile.coins < cost) return false
        set({
          profiles: profiles.map(p =>
            p.id === activeProfileId
              ? { ...p, coins: p.coins - cost, upgrades: { ...p.upgrades, [upgrade]: rank + 1 } }
              : p
          ),
        })
        return true
      },
    }),
    { name: 'vampires-profiles' }
  )
)
