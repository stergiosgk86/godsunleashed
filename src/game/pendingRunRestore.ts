import type { RunSnapshot } from './runSave'

let _snap: RunSnapshot | null = null

export function setPendingRunRestore(s: RunSnapshot | null): void { _snap = s }

export function peekPendingRunRestore(): RunSnapshot | null { return _snap }

export function consumePendingRunRestore(): RunSnapshot | null {
  const s = _snap
  _snap = null
  return s
}
