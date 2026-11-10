import type { CueMark } from '../models/CueMark'

export interface CueTag { id: string; name: string; color: string }
export const TAG_COLORS = ['#f87171', '#60a5fa', '#4ade80', '#c084fc', '#fbbf24', '#fb923c']
export const defaultCueTags = (): CueTag[] => ['Red', 'Blue', 'Green', 'Purple'].map((name, i) => ({ id: `default-color-${i}`, name, color: TAG_COLORS[i] }))
export function parseCueTags(value: unknown): CueTag[] {
  if (value === undefined) return defaultCueTags()
  if (!Array.isArray(value) || value.length > 32) throw new Error('Invalid tag list (maximum 32 tags)')
  const ids = new Set<string>()
  return value.map(tag => {
    if (!tag || typeof tag.id !== 'string' || !tag.id || ids.has(tag.id) ||
      typeof tag.name !== 'string' || !tag.name.trim() || tag.name.length > 40 ||
      typeof tag.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(tag.color)) throw new Error('Invalid tag name or color')
    ids.add(tag.id)
    return { id: tag.id, name: tag.name.trim(), color: tag.color }
  })
}
export function parseTagIds(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 32 || value.some(id => typeof id !== 'string' || !id)) throw new Error('Invalid Q Mark tags')
  return [...new Set(value)]
}
export function matchesTags(mark: CueMark, selected: string[], tags: CueTag[]) {
  if (!selected.length) return true
  const ids = (mark.tagIds ?? []).filter(id => tags.some(tag => tag.id === id))
  return (!ids.length && selected.includes('untagged')) || ids.some(id => selected.includes(id))
}

export function cueRowBackground(mark: CueMark, tags: CueTag[]) {
  const colors = tags.filter(tag => mark.tagIds?.includes(tag.id)).map(tag => tag.color)
  if (!colors.length) return undefined
  return `linear-gradient(90deg, ${colors.map((color, i) => `${color}33 ${i * 100 / colors.length}%, ${color}33 ${(i + 1) * 100 / colors.length}%`).join(', ')})`
}
