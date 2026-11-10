import type { PauseRecord } from '../models/SegmentResult'

export function parsePauseRecords(json: string): PauseRecord[] {
  if (!json) return []
  const value: unknown = JSON.parse(json)
  if (!Array.isArray(value)) throw new Error('Invalid pause history format')
  return value.map(p => {
    if (!p || typeof p.id !== 'string' || typeof p.note !== 'string' ||
      !Number.isFinite(p.startedAtMs) || !Number.isFinite(p.endedAtMs) || p.endedAtMs < p.startedAtMs) {
      throw new Error('Invalid pause timestamps')
    }
    return { id: p.id, startedAtMs: p.startedAtMs, endedAtMs: p.endedAtMs, note: p.note }
  })
}
