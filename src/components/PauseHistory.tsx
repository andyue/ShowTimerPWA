import type { PauseRecord } from '../models/SegmentResult'
import { formatClockTime, formatTimerSeconds } from '../services/TimerEngine'

export default function PauseHistory({ pauses, nowMs, onNote }: {
  pauses: PauseRecord[]; nowMs: number; onNote: (id: string, note: string) => void
}) {
  if (!pauses.length) return null
  return <details className="pause-history"><summary>Pause history ({pauses.length})</summary>
    {pauses.map((pause, index) => <div className="pause-record" key={pause.id}>
      <span>#{index + 1} · {formatClockTime(pause.startedAtMs)} → {pause.endedAtMs === null ? 'Paused' : formatClockTime(pause.endedAtMs)}</span>
      <strong>{formatTimerSeconds(((pause.endedAtMs ?? nowMs) - pause.startedAtMs) / 1000)}</strong>
      <label className="field"><span>Pause reason (optional; editable later)</span>
        <input value={pause.note} onChange={e => onNote(pause.id, e.target.value)} />
      </label>
    </div>)}
  </details>
}
