export const ATTENTION_CAPABILITY = 'attention-v1'
export const ATTENTION_COOLDOWN_MS = 1500
export const SCREEN_REMINDER_MS = 900
export const CUE_REMINDER_MS = 1800
export type AttentionTarget = 'screen' | 'cue'
export interface AttentionEvent {
  id: string
  target: AttentionTarget
  cueMarkId?: string
  sentAtMs: number
  expiresAtMs: number
}

export function parseAttention(value: unknown, serverNow: number): AttentionEvent | null {
  if (!value || typeof value !== 'object') return null
  const event = value as AttentionEvent
  if (typeof event.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(event.id) ||
      !['screen', 'cue'].includes(event.target) ||
      (event.target === 'cue' && (typeof event.cueMarkId !== 'string' || !event.cueMarkId || event.cueMarkId.length > 200)) ||
      !Number.isFinite(event.sentAtMs) || !Number.isFinite(event.expiresAtMs) ||
      event.expiresAtMs <= event.sentAtMs || event.expiresAtMs - event.sentAtMs > 3000 ||
      serverNow > event.expiresAtMs || event.sentAtMs > serverNow + 2000) return null
  return event
}

export function rememberAttention(ids: Set<string>, id: string) {
  if (ids.has(id)) return false
  ids.add(id)
  if (ids.size > 256) ids.delete(ids.values().next().value!)
  return true
}
