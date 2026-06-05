import { create } from 'zustand'

interface StageStore {
  selectedStage: 1 | 2 | 3
  setStage: (stage: 1 | 2 | 3) => void
}

export const useStageStore = create<StageStore>((set) => ({
  selectedStage: 1,
  setStage: (stage) => set({ selectedStage: stage }),
}))
