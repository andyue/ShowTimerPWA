import type { PauseRecord } from '../models/SegmentResult'
import { formatClockTime, formatTimerSeconds } from '../services/TimerEngine'

export default function PauseHistory({ pauses, nowMs, onNote }: {
  pauses: PauseRecord[]; nowMs: number; onNote: (id: string, note: string) => void
}) {
  if (!pauses.length) return null
  return <details className="pause-history"><summary>暫停紀錄（{pauses.length} 次）</summary>
    {pauses.map((pause, index) => <div className="pause-record" key={pause.id}>
      <span>#{index + 1} · {formatClockTime(pause.startedAtMs)} → {pause.endedAtMs === null ? '暫停中' : formatClockTime(pause.endedAtMs)}</span>
      <strong>{formatTimerSeconds(((pause.endedAtMs ?? nowMs) - pause.startedAtMs) / 1000)}</strong>
      <label className="field"><span>暫停原因（選填，可事後補）</span>
        <input value={pause.note} onChange={e => onNote(pause.id, e.target.value)} />
      </label>
    </div>)}
  </details>
}
