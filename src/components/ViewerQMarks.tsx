import { useTagFilter } from '../services/useTagFilter'
import { TagChoices, TagBadges } from './CueTags'
import { matchesTags, type CueTag } from '../services/CueTags'
import { memo, useEffect, useRef } from 'react'
import type { CueMark } from '../models/CueMark'
import { formatTimerSeconds } from '../services/TimerEngine'

const emptyMarks: CueMark[] = []
const emptyTags: CueTag[] = []

export default memo(function ViewerQMarks({ marks: receivedMarks, tags = emptyTags, scope = "viewer" }: { marks?: CueMark[]; tags?: CueTag[]; scope?: string }) {
  const marks = receivedMarks ?? emptyMarks
  const [filter, setFilter] = useTagFilter(scope)
  const effectiveFilter = filter.filter(id => id === 'untagged' || tags.some(tag => tag.id === id))
  const visible = marks.map((mark, index) => ({ mark, index })).filter(({ mark }) => matchesTags(mark, effectiveFilter, tags))
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

  return <section className="viewer-marks" aria-label="Q Marks 唯讀清單">
    <header><h2>Q Marks</h2><span>{marks.length} 筆 · 即時同步／唯讀</span></header>
    <div className="mark-filter" aria-label="Q Mark 篩選"><span>顯示標籤</span><TagChoices tags={tags} selected={effectiveFilter} onChange={setFilter} filter /></div>
    <div className="viewer-marks-scroll" ref={scrollArea}>
      <table className="viewer-marks-table">
        <thead><tr><th scope="col">M</th><th scope="col">Time</th><th scope="col">Act</th><th scope="col">Note</th></tr></thead>
        <tbody>{visible.length === 0 ? <tr><td colSpan={4} className="viewer-marks-empty">沒有符合條件的 Q Mark</td></tr> : visible.map(({ mark, index }) =>
          <tr key={mark.id} data-mark-id={mark.id}>
            <td>{index + 1}</td>
            <td className="viewer-mark-time">{formatTimerSeconds(mark.elapsedSeconds)}</td>
            <td>{mark.segmentName}</td>
            <td className="viewer-mark-note"><TagBadges tags={tags} mark={mark} />{mark.note || <span className="viewer-mark-placeholder">Q{index + 1}</span>}</td>
          </tr>,
        )}</tbody>
      </table>
    </div>
  </section>
})
