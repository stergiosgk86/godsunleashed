import { create } from 'zustand'
import type { CharacterType } from '../game/characters'

interface CharacterState {
  selectedCharacter: CharacterType
  setCharacter: (type: CharacterType) => void
}

export const useCharacterStore = create<CharacterState>()((set) => ({
  selectedCharacter: 'knight',
  setCharacter: (type) => set({ selectedCharacter: type }),
}))
