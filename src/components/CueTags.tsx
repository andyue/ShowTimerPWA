import { useState, useId, useRef, type CSSProperties } from 'react'
import type { CueMark } from '../models/CueMark'
import { TAG_COLORS, type CueTag } from '../services/CueTags'
import { useShowTimerStore } from '../stores/useShowTimerStore'

const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]
const style = (color: string) => ({ '--tag-color': color } as CSSProperties)
export function TagChoices({ tags, selected, onChange, filter = false }: { tags: CueTag[]; selected: string[]; onChange: (ids: string[]) => void; filter?: boolean }) {
  return <div className="tag-choices">
    <button type="button" className="tag-chip" aria-pressed={!selected.length} onClick={() => onChange([])}>{filter ? '全部' : '不指定'}</button>
    {filter && <button type="button" className="tag-chip" aria-pressed={selected.includes('untagged')} onClick={() => onChange(toggle(selected, 'untagged'))}>未分類</button>}
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
  const title = active.map(tag => tag.name).join('、') || '無顏色'
  return <div className="mark-tag-editor">
    <button type="button" className="tag-swatch-button" aria-label={`Q${number} 標籤`} title={title} popoverTarget={id} onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect()
      if (menu.current) {
        menu.current.style.left = `${Math.max(8, Math.min(rect.right - 190, window.innerWidth - 206))}px`
        menu.current.style.top = `${Math.max(8, Math.min(rect.bottom + 3, window.innerHeight - 260))}px`
      }
    }}>{active.length ? active.map(tag => <i key={tag.id} style={{ background: tag.color }} />) : <span aria-hidden="true">⊠</span>}</button>
    <div ref={menu} id={id} popover="auto" className="tag-dropdown" role="group" aria-label={`Q${number} 顏色選單`}>
      <button type="button" onClick={() => onChange([])}>無顏色（清除全部）</button>
      {tags.map(tag => <label key={tag.id} style={style(tag.color)}><input type="checkbox" checked={selected.includes(tag.id)} onChange={() => onChange(toggle(selected, tag.id))} /><i />{tag.name}</label>)}
    </div>
  </div>
}
export function CueTagManager() {
  const { project, setCueTags } = useShowTimerStore()
  const tags = project.cueTags ?? []
  const [name, setName] = useState('')
  const [color, setColor] = useState(TAG_COLORS[0])
  return <section className="tool-section" aria-label="Q Mark 標籤管理">
    <h2>Q Mark 顏色標籤</h2>
    <p className="section-note">每筆可選多個標籤。名稱與顏色會一起存進 Show File。</p>
    {tags.map(tag => <div className="tag-editor" key={tag.id}>
      <input type="color" aria-label={`${tag.name} 顏色`} value={tag.color} onChange={e => setCueTags(tags.map(t => t.id === tag.id ? { ...t, color: e.target.value } : t))} />
      <input aria-label={`${tag.name} 名稱`} maxLength={40} value={tag.name} onChange={e => { if (e.target.value.trim()) setCueTags(tags.map(t => t.id === tag.id ? { ...t, name: e.target.value } : t)) }} />
      <button type="button" aria-label={`刪除標籤 ${tag.name}`} onClick={() => { if (window.confirm(`刪除「${tag.name}」標籤？Q Marks 會保留，但會移除此標籤。`)) setCueTags(tags.filter(t => t.id !== tag.id)) }}>刪除</button>
    </div>)}
    <form className="tag-editor" onSubmit={e => { e.preventDefault(); if (!name.trim() || tags.length >= 32) return; setCueTags([...tags, { id: crypto.randomUUID(), name: name.trim(), color }]); setName(''); setColor(TAG_COLORS[(tags.length + 1) % TAG_COLORS.length]) }}>
      <input type="color" aria-label="新標籤顏色" value={color} onChange={e => setColor(e.target.value)} />
      <input aria-label="新標籤名稱" placeholder="例如：燈光、音響" maxLength={40} value={name} onChange={e => setName(e.target.value)} />
      <button type="submit" disabled={!name.trim() || tags.length >= 32}>新增標籤</button>
    </form>
  </section>
}
