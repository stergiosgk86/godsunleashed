import type { NetClient } from './NetClient'

export let activeNetClient: NetClient | null = null

export function setNetClient(c: NetClient | null) {
  activeNetClient = c
}
