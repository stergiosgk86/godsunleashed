import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CHARACTER_DEFS, type CharacterType } from '../game/characters'

interface CharacterState {
  selectedCharacter: CharacterType
  setCharacter: (type: CharacterType) => void
}

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set) => ({
      selectedCharacter: 'ares',
      setCharacter: (type) => set({ selectedCharacter: type }),
    }),
    {
      name: 'gods-character',
      version: 1,
      migrate: (stored: unknown) => {
        const s = stored as CharacterState
        const valid = s?.selectedCharacter && CHARACTER_DEFS[s.selectedCharacter]
        return { ...s, selectedCharacter: valid ? s.selectedCharacter : 'ares' }
      },
    }
  )
)
