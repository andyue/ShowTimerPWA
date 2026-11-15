export interface PersistentAttention {
  phase: 'active' | 'complete'
  cueMarkId?: string
  note?: string
  until?: number
}
export function toggleAttention(current: PersistentAttention | null, target: 'screen' | 'cue', cueMarkId: string | undefined, note: string, now: number): PersistentAttention {
  if (current?.phase === 'active' && (target === 'screen' || current.cueMarkId === cueMarkId)) {
    return { ...current, phase: 'complete', until: now + 4000 }
  }
  return { phase: 'active', ...(target === 'cue' ? { cueMarkId, note } : {}) }
}
