import { memo, useEffect, useRef } from 'react'
import type { CueMark } from '../models/CueMark'
import { formatTimerSeconds } from '../services/TimerEngine'

const emptyMarks: CueMark[] = []

export default memo(function ViewerQMarks({ marks = emptyMarks }: { marks?: CueMark[] }) {
  const scrollArea = useRef<HTMLDivElement>(null)
  const previousIds = useRef(new Set<string>())
  useEffect(() => {
    const added = marks.filter(mark => !previousIds.current.has(mark.id))
    previousIds.current = new Set(marks.map(mark => mark.id))
    const latest = added.reduce<CueMark | undefined>((last, mark) => !last || Date.parse(mark.createdAt) >= Date.parse(last.createdAt) ? mark : last, undefined)
    if (latest && scrollArea.current) {
      const row = Array.from(scrollArea.current.querySelectorAll<HTMLElement>('[data-mark-id]')).find(row => row.dataset.markId === latest.id)
      if (row) {
        const area = scrollArea.current
        const headerHeight = area.querySelector('thead')?.getBoundingClientRect().height ?? 48
        area.scrollTop += row.getBoundingClientRect().top - area.getBoundingClientRect().top - headerHeight
      }
    }
  }, [marks])

  return <section className="viewer-marks" aria-label="Q Marks 唯讀清單">
    <header><h2>Q Marks</h2><span>{marks.length} 筆 · 即時同步／唯讀</span></header>
    <div className="viewer-marks-scroll" ref={scrollArea}>
      <table className="viewer-marks-table">
        <thead><tr><th scope="col">M</th><th scope="col">Time</th><th scope="col">Act</th><th scope="col">Note</th></tr></thead>
        <tbody>{marks.length === 0 ? <tr><td colSpan={4} className="viewer-marks-empty">等待主控新增 Q Mark</td></tr> : marks.map((mark, index) =>
          <tr key={mark.id} data-mark-id={mark.id}>
            <td>{index + 1}</td>
            <td className="viewer-mark-time">{formatTimerSeconds(mark.elapsedSeconds)}</td>
            <td>{mark.segmentName}</td>
            <td className="viewer-mark-note">{mark.note || <span className="viewer-mark-placeholder">Q{index + 1}</span>}</td>
          </tr>,
        )}</tbody>
      </table>
    </div>
  </section>
})
