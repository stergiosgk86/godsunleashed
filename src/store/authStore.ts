import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlayerRow } from '../ui/AdminPlayersView'

interface AuthStore {
  token: string | null
  userId: number | null
  username: string | null
  role: string | null
  systemToast: { message: string; color: string } | null
  onlineUserIds: Set<number>
  playerOnlineAt: Record<number, string>
  adminPlayerRows: PlayerRow[]
  setAuth: (token: string, userId: number, username: string) => void
  setRole: (role: string) => void
  clearAuth: () => void
  showSystemToast: (message: string, color: string) => void
  clearSystemToast: () => void
  setUserOnline: (id: number) => void
  setUserOffline: (id: number) => void
  seedOnlineUsers: (ids: number[]) => void
  setAdminPlayerRows: (rows: PlayerRow[]) => void
  patchAdminPlayerRow: (userId: number, patch: Partial<PlayerRow>) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      username: null,
      role: null,
      systemToast: null,
      onlineUserIds: new Set(),
      playerOnlineAt: {},
      adminPlayerRows: [],
      setAuth: (token, userId, username) => set({ token, userId, username, role: null }),
      setRole: (role) => set({ role }),
      clearAuth: () => set({ token: null, userId: null, username: null, role: null }),
      showSystemToast: (message, color) => set({ systemToast: { message, color } }),
      clearSystemToast: () => set({ systemToast: null }),
      setUserOnline: (id) => set(s => { const n = new Set(s.onlineUserIds); n.add(id); return { onlineUserIds: n, playerOnlineAt: { ...s.playerOnlineAt, [id]: new Date().toISOString() } } }),
      setUserOffline: (id) => set(s => { const n = new Set(s.onlineUserIds); n.delete(id); return { onlineUserIds: n } }),
      seedOnlineUsers: (ids) => set({ onlineUserIds: new Set(ids) }),
      setAdminPlayerRows: (rows) => set({ adminPlayerRows: rows }),
      patchAdminPlayerRow: (userId, patch) => set(s => ({
        adminPlayerRows: s.adminPlayerRows.map(r => r.id === userId ? { ...r, ...patch } : r),
      })),
    }),
    { name: 'gods-auth', partialize: (s) => ({ token: s.token, userId: s.userId, username: s.username, role: s.role }) },
  ),
)
