import type { WebSocket } from 'ws'

// Maps userId → their active WebSocket, so API routes can push messages to online players.
export const userSockets = new Map<number, WebSocket>()

// Tracks which connected users are super_admins so we can push to them without a DB query.
export const superAdminUserIds = new Set<number>()

export function notifySuperAdmins(payload: string) {
  for (const id of superAdminUserIds) {
    const sock = userSockets.get(id)
    if (sock && sock.readyState === 1) sock.send(payload)
  }
}
