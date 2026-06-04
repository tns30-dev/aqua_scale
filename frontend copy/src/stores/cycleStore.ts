import { create } from 'zustand';
import type { Cycle, CycleDetails, ProfileTemplate } from '../types';

interface CycleStore {
  // State
  cycles: Cycle[];
  currentCycle: CycleDetails | null;
  profileTemplate: ProfileTemplate | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCycles: (cycles: Cycle[]) => void;
  setCurrentCycle: (cycle: CycleDetails | null) => void;
  setProfileTemplate: (template: ProfileTemplate | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useCycleStore = create<CycleStore>((set) => ({
  // Initial state
  cycles: [],
  currentCycle: null,
  profileTemplate: null,
  isLoading: false,
  error: null,

  // Actions
  setCycles: (cycles) => set({ cycles }),
  setCurrentCycle: (cycle) => set({ currentCycle: cycle }),
  setProfileTemplate: (template) => set({ profileTemplate: template }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set({
    cycles: [],
    currentCycle: null,
    profileTemplate: null,
    isLoading: false,
    error: null
  })
}));
