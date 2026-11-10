import { useState, useId, useRef, type CSSProperties } from 'react'
import type { CueMark } from '../models/CueMark'
import { TAG_COLORS, type CueTag } from '../services/CueTags'
import { useShowTimerStore } from '../stores/useShowTimerStore'

const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]
const style = (color: string) => ({ '--tag-color': color } as CSSProperties)
export function TagChoices({ tags, selected, onChange, filter = false }: { tags: CueTag[]; selected: string[]; onChange: (ids: string[]) => void; filter?: boolean }) {
  return <div className="tag-choices">
    <button type="button" className="tag-chip" aria-pressed={!selected.length} onClick={() => onChange([])}>{filter ? 'All' : 'None'}</button>
    {filter && <button type="button" className="tag-chip" aria-pressed={selected.includes('untagged')} onClick={() => onChange(toggle(selected, 'untagged'))}>Untagged</button>}
    {tags.map(tag => <button type="button" key={tag.id} className="tag-chip" style={style(tag.color)} aria-pressed={selected.includes(tag.id)} onClick={() => onChange(toggle(selected, tag.id))}><i />{tag.name}</button>)}
  </div>
}
export function TagBadges({ tags, mark }: { tags: CueTag[]; mark: CueMark }) {
  return <span className="tag-badges">{tags.filter(tag => mark.tagIds?.includes(tag.id)).map(tag => <span className="tag-chip" style={style(tag.color)} key={tag.id}><i />{tag.name}</span>)}</span>
}
export function TagDropdown({ tags, mark, number, onChange }: { tags: CueTag[]; mark: CueMark; number: number; onChange: (ids: string[]) => void }) {
  const selected = mark.tagIds ?? []
  const active = tags.filter(tag => selected.includes(tag.id))
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const title = active.map(tag => tag.name).join('、') || 'No color'
  return <div className="mark-tag-editor">
    <button type="button" className="tag-swatch-button" aria-label={`Q${number} tags`} title={title} popoverTarget={id} onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect()
      if (menu.current) {
        menu.current.style.left = `${Math.max(8, Math.min(rect.right - 190, window.innerWidth - 206))}px`
        menu.current.style.top = `${Math.max(8, Math.min(rect.bottom + 3, window.innerHeight - 260))}px`
      }
    }}>{active.length ? active.map(tag => <i key={tag.id} style={{ background: tag.color }} />) : <span aria-hidden="true">⊠</span>}</button>
    <div ref={menu} id={id} popover="auto" className="tag-dropdown" role="group" aria-label={`Q${number} color menu`}>
      <button type="button" onClick={() => onChange([])}>No color (clear all)</button>
      {tags.map(tag => <label key={tag.id} style={style(tag.color)}><input type="checkbox" checked={selected.includes(tag.id)} onChange={() => onChange(toggle(selected, tag.id))} /><i />{tag.name}</label>)}
    </div>
  </div>
}
export function CueTagManager() {
  const { project, setCueTags } = useShowTimerStore()
  const tags = project.cueTags ?? []
  const [name, setName] = useState('')
  const [color, setColor] = useState(TAG_COLORS[0])
  return <section className="tool-section" aria-label="Q Mark tag manager">
    <h2>Q Mark color tags</h2>
    <p className="section-note">Each mark can have multiple tags. Names and colors are saved in the Show File.</p>
    {tags.map(tag => <div className="tag-editor" key={tag.id}>
      <input type="color" aria-label={`${tag.name} color`} value={tag.color} onChange={e => setCueTags(tags.map(t => t.id === tag.id ? { ...t, color: e.target.value } : t))} />
      <input aria-label={`${tag.name} name`} maxLength={40} value={tag.name} onChange={e => { if (e.target.value.trim()) setCueTags(tags.map(t => t.id === tag.id ? { ...t, name: e.target.value } : t)) }} />
      <button type="button" aria-label={`Delete tag ${tag.name}`} onClick={() => { if (window.confirm(`Delete the tag "${tag.name}"? Q Marks will be kept without this tag.`)) setCueTags(tags.filter(t => t.id !== tag.id)) }}>Delete</button>
    </div>)}
    <form className="tag-editor" onSubmit={e => { e.preventDefault(); if (!name.trim() || tags.length >= 32) return; setCueTags([...tags, { id: crypto.randomUUID(), name: name.trim(), color }]); setName(''); setColor(TAG_COLORS[(tags.length + 1) % TAG_COLORS.length]) }}>
      <input type="color" aria-label="New tag color" value={color} onChange={e => setColor(e.target.value)} />
      <input aria-label="New tag name" placeholder="e.g. Lighting, Sound" maxLength={40} value={name} onChange={e => setName(e.target.value)} />
      <button type="submit" disabled={!name.trim() || tags.length >= 32}>Add tag</button>
    </form>
  </section>
}
