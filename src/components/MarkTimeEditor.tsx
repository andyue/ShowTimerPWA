import { useState } from 'react'
import FitTime from './FitTime'
import { formatTimerSeconds } from '../services/TimerEngine'
import { parseMarkTime } from '../services/MarkTime'

export default function MarkTimeEditor({ seconds, number, onChange }: { seconds: number; number: number; onChange: (seconds: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)
  const commit = () => {
    const value = parseMarkTime(draft)
    if (value === null) { setInvalid(true); return }
    if (draft !== formatTimerSeconds(seconds)) onChange(value)
    setEditing(false); setInvalid(false)
  }
  return editing ? <><input className="mark-time-input" aria-label={`Q${number} time`} aria-invalid={invalid} title={invalid ? 'Enter HH:MM:SS. Minutes and seconds must be 00–59.' : 'HH:MM:SS; Enter to save, Escape to cancel'} value={draft}
    autoFocus onFocus={e => e.target.select()} onChange={e => { setDraft(e.target.value); setInvalid(false) }}
    onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setInvalid(false) } }} />{invalid && <span className="mark-time-error" role="alert">Use HH:MM:SS</span>}</>
    : <button type="button" className="mark-time-button" aria-label={`Edit Q${number} time`} title="Click to edit time" onClick={() => { setDraft(formatTimerSeconds(seconds)); setEditing(true) }}><FitTime>{formatTimerSeconds(seconds)}</FitTime></button>
}
