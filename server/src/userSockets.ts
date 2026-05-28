import type { WebSocket } from 'ws'

// Maps userId → their active WebSocket, so API routes can push messages to online players.
export const userSockets = new Map<number, WebSocket>()
