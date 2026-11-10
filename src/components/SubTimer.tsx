import FitTime from './FitTime'
import { useEffect, useState } from 'react'
import { useShowTimerStore } from '../stores/useShowTimerStore'
import { formatClockTime, formatTimerSeconds } from '../services/TimerEngine'

function useSubTimerClock() {
  const { project } = useShowTimerStore()
  const running = project.subTimer?.records.at(-1)?.endedAtMs === null
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [running])
  return now
}
export function SubTimerControl() {
  const { project, toggleSubTimer, resetSubTimer } = useShowTimerStore()
  const now = useSubTimerClock()
  const state = project.subTimer
  const last = state?.records.at(-1)
  const running = last?.endedAtMs === null
  const seconds = !last || state?.reset ? 0 : Math.max(0, ((last.endedAtMs ?? now) - last.startedAtMs) / 1000)
  const formatted = formatTimerSeconds(seconds)
  return <section className="sub-timer" aria-label="Sub timer">
    <strong>Sub timer</strong>
    <output className="sub-timer-time"><FitTime>{seconds < 3600 ? formatted.slice(3) : formatted}</FitTime></output>
    <button type="button" className="sub-timer-toggle" onClick={toggleSubTimer}>{running ? 'Stop' : 'Start'}</button>
    <button type="button" className="sub-timer-reset" onClick={() => {
      if (!running || window.confirm('Stop and save the current Sub Timer record, then reset?')) resetSubTimer()
    }}>Reset</button>
  </section>
}
export function SubTimerHistory() {
  const { project, updateSubTimerNote } = useShowTimerStore()
  const now = useSubTimerClock()
  const records = project.subTimer?.records ?? []
  if (!records.length) return null
  return <details className="pause-history sub-timer-history">
    <summary>Sub Timer record ({records.length})</summary>
    {records.map((record, index) => <div className="pause-record" key={record.id}>
      <span>#{index + 1} · {record.segmentName || 'No segment'} · {formatClockTime(record.startedAtMs)} → {record.endedAtMs === null ? 'Running' : formatClockTime(record.endedAtMs)}</span>
      <strong>{formatTimerSeconds(Math.max(0, ((record.endedAtMs ?? now) - record.startedAtMs) / 1000))}</strong>
      <label className="field"><span>Sub Timer note (optional; editable later)</span>
        <input value={record.note} onChange={event => updateSubTimerNote(record.id, event.target.value)} />
      </label>
    </div>)}
  </details>
}
