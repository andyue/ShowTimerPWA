export interface SubTimerRecord {
  id: string
  startedAtMs: number
  endedAtMs: number | null
  segmentName: string
  note: string
}
export interface SubTimerState {
  records: SubTimerRecord[]
  reset: boolean
}
export function parseSubTimer(value: unknown): SubTimerState | undefined {
  if (value === undefined) return undefined
  const state = value as SubTimerState
  if (!state || typeof state.reset !== 'boolean' || !Array.isArray(state.records)) throw new Error('Sub timer 資料格式不正確')
  const ids = new Set<string>()
  state.records.forEach((record, index) => {
    if (!record || typeof record.id !== 'string' || ids.has(record.id) ||
      typeof record.note !== 'string' || typeof record.segmentName !== 'string' ||
      !Number.isFinite(record.startedAtMs) || record.startedAtMs < 0 ||
      (record.endedAtMs !== null && (!Number.isFinite(record.endedAtMs) || record.endedAtMs < record.startedAtMs)) ||
      (record.endedAtMs === null && (index !== state.records.length - 1 || state.reset))) {
      throw new Error('Sub timer 紀錄格式不正確')
    }
    ids.add(record.id)
  })
  return state
}
export function toggleSubTimer(state: SubTimerState | undefined, now: number, segmentName: string): SubTimerState {
  const records = state?.records ?? []
  const last = records.at(-1)
  if (last?.endedAtMs === null) {
    return { reset: false, records: records.map(record => record.id === last.id ? { ...record, endedAtMs: Math.max(now, record.startedAtMs) } : record) }
  }
  return { reset: false, records: [...records, { id: crypto.randomUUID(), startedAtMs: now, endedAtMs: null, segmentName, note: '' }] }
}
export function resetSubTimer(state: SubTimerState | undefined, now: number): SubTimerState {
  const stopped = state?.records.at(-1)?.endedAtMs === null ? toggleSubTimer(state, now, '') : state
  return { records: stopped?.records ?? [], reset: true }
}
