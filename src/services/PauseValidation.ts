import type { PauseRecord } from '../models/SegmentResult'

export function parsePauseRecords(json: string): PauseRecord[] {
  if (!json) return []
  const value: unknown = JSON.parse(json)
  if (!Array.isArray(value)) throw new Error('暫停紀錄格式不正確')
  return value.map(p => {
    if (!p || typeof p.id !== 'string' || typeof p.note !== 'string' ||
      !Number.isFinite(p.startedAtMs) || !Number.isFinite(p.endedAtMs) || p.endedAtMs < p.startedAtMs) {
      throw new Error('暫停紀錄時間不正確')
    }
    return { id: p.id, startedAtMs: p.startedAtMs, endedAtMs: p.endedAtMs, note: p.note }
  })
}
