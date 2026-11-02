import { useState } from 'react'

export function useTagFilter(scope: string) {
  const key = `showtimer-tag-filter:${scope}`
  const [state, setState] = useState<{ key: string; ids: string[] }>(() => {
    try { const ids: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return { key, ids: Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [] } } catch { return { key, ids: [] } }
  })
  return [state.key === key ? state.ids : [], (ids: string[]) => {
    setState({ key, ids })
    try { localStorage.setItem(key, JSON.stringify(ids)) } catch { /* Filtering still works without storage. */ }
  }] as const
}
