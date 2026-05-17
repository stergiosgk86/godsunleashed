import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CharacterType } from '../game/characters'

interface CharacterState {
  selectedCharacter: CharacterType
  setCharacter: (type: CharacterType) => void
}

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set) => ({
      selectedCharacter: 'knight',
      setCharacter: (type) => set({ selectedCharacter: type }),
    }),
    { name: 'gods-character' }
  )
)
