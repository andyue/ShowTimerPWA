import { useState, type CSSProperties } from 'react'
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
export function NewMarkTags() {
  const { project, selectedTagIds, setSelectedTagIds } = useShowTimerStore()
  if (!project.cueTags?.length) return null
  return <div className="new-mark-tags" aria-label="新增 Q Mark 標籤"><span>新增標籤</span><TagChoices tags={project.cueTags} selected={selectedTagIds} onChange={setSelectedTagIds} /></div>
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
