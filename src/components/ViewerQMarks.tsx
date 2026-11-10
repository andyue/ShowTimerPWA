import type { AttentionEvent } from '../services/Attention'
import FitTime from './FitTime'
import { useTagFilter } from '../services/useTagFilter'
import { TagChoices } from './CueTags'
import { matchesTags, cueRowBackground, type CueTag } from '../services/CueTags'
import { memo, useEffect, useRef } from 'react'
import type { CueMark } from '../models/CueMark'
import { formatTimerSeconds } from '../services/TimerEngine'

const emptyMarks: CueMark[] = []
const emptyTags: CueTag[] = []

export default memo(function ViewerQMarks({ marks: receivedMarks, tags = emptyTags, scope = "viewer", reminder }: { reminder?: AttentionEvent | null; marks?: CueMark[]; tags?: CueTag[]; scope?: string }) {
  const marks = receivedMarks ?? emptyMarks
  const [filter, setFilter] = useTagFilter(scope)
  const effectiveFilter = filter.filter(id => id === 'untagged' || tags.some(tag => tag.id === id))
  const visible = marks.map((mark, index) => ({ mark, index })).filter(({ mark }) => (mark.id === reminder?.cueMarkId || matchesTags(mark, effectiveFilter, tags)))
  const initialized = useRef(false)
  const scrollArea = useRef<HTMLDivElement>(null)
  const previousIds = useRef(new Set<string>())
  useEffect(() => {
    if (receivedMarks === undefined) return
    const added = marks.filter(mark => !previousIds.current.has(mark.id))
    previousIds.current = new Set(marks.map(mark => mark.id))
    if (!initialized.current) {
      initialized.current = true
      if (scrollArea.current) scrollArea.current.scrollTop = 0
      return
    }
    const latest = added.reduce<CueMark | undefined>((last, mark) => !last || Date.parse(mark.createdAt) >= Date.parse(last.createdAt) ? mark : last, undefined)
    if (latest && scrollArea.current) {
      const row = Array.from(scrollArea.current.querySelectorAll<HTMLElement>('[data-mark-id]')).find(row => row.dataset.markId === latest.id)
      if (row) {
        const area = scrollArea.current
        const headerHeight = area.querySelector('thead')?.getBoundingClientRect().height ?? 48
        area.scrollTop += row.getBoundingClientRect().top - area.getBoundingClientRect().top - headerHeight
      }
    }
  }, [marks, receivedMarks])

  useEffect(() => {
    const area = scrollArea.current
    if (!area || !reminder) return
    const row = Array.from(area.querySelectorAll<HTMLElement>('[data-mark-id]')).find(row => row.dataset.markId === reminder.cueMarkId)
    if (row) area.scrollTop += row.getBoundingClientRect().top - area.getBoundingClientRect().top - (area.querySelector('thead')?.getBoundingClientRect().height ?? 48)
  }, [reminder])

  return <section className="viewer-marks" aria-label="Read-only Q Marks">
    <header><h2>Q Marks</h2><span>{marks.length} marks</span></header>
    <div className="mark-filter" aria-label="Q Mark filter"><TagChoices tags={tags} selected={effectiveFilter} onChange={setFilter} filter /></div>
    <div className="viewer-marks-scroll" ref={scrollArea}>
      <table className="viewer-marks-table">
        <thead><tr><th scope="col">M</th><th scope="col">Time</th><th scope="col">Act</th><th scope="col">Note</th></tr></thead>
        <tbody>{visible.length === 0 ? <tr><td colSpan={4} className="viewer-marks-empty">No matching Q Marks</td></tr> : visible.map(({ mark, index }) =>
          <tr className={mark.id === reminder?.cueMarkId ? "cue-reminder-row" : undefined} key={mark.id === reminder?.cueMarkId ? `${mark.id}:${reminder.id}` : mark.id} data-mark-id={mark.id} style={{ backgroundImage: cueRowBackground(mark, tags) }}>
            <td>{index + 1}</td>
            <td className="viewer-mark-time"><FitTime>{formatTimerSeconds(mark.elapsedSeconds)}</FitTime></td>
            <td>{mark.segmentName}</td>
            <td className="viewer-mark-note">{mark.note || <span className="viewer-mark-placeholder">Q{index + 1}</span>}</td>
          </tr>,
        )}</tbody>
      </table>
    </div>
  </section>
})
