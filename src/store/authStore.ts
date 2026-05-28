import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthStore {
  token: string | null
  userId: number | null
  username: string | null
  role: string | null
  systemToast: { message: string; color: string } | null
  setAuth: (token: string, userId: number, username: string) => void
  setRole: (role: string) => void
  clearAuth: () => void
  showSystemToast: (message: string, color: string) => void
  clearSystemToast: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      username: null,
      role: null,
      systemToast: null,
      setAuth: (token, userId, username) => set({ token, userId, username, role: null }),
      setRole: (role) => set({ role }),
      clearAuth: () => set({ token: null, userId: null, username: null, role: null }),
      showSystemToast: (message, color) => set({ systemToast: { message, color } }),
      clearSystemToast: () => set({ systemToast: null }),
    }),
    { name: 'gods-auth', partialize: (s) => ({ token: s.token, userId: s.userId, username: s.username, role: s.role }) },
  ),
)
