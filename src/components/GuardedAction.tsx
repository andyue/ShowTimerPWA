import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react'

const mobileQuery = '(max-width: 900px)'
function subscribe(onChange: () => void) {
  const query = window.matchMedia(mobileQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
interface Props {
  children: string
  className: string
  disabled?: boolean
  onClick: () => void
  type?: 'button'
  confirmation?: string
}

export default function GuardedAction(props: Props) {
  const mobile = useSyncExternalStore(subscribe, () => window.matchMedia(mobileQuery).matches, () => false)
  return <ActionControl key={String(mobile)} {...props} mobile={mobile} />
}

function ActionControl({ children: label, className, disabled, onClick, confirmation, mobile }: Props & { mobile: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; start: number; distance: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const executed = useRef(false)
  const cancel = () => { drag.current = null; setOffset(0) }
  useEffect(() => {
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', cancel)
    window.addEventListener('resize', cancel)
    return () => {
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', cancel)
      window.removeEventListener('resize', cancel)
    }
  }, [])
  const execute = () => {
    if (disabled || executed.current) return
    executed.current = true
    onClick()
  }
  const confirm = () => {
    if (!disabled && window.confirm(confirmation ?? `確定執行「${label}」？`)) execute()
  }
  function start(event: PointerEvent<HTMLButtonElement>) {
    if (disabled || drag.current || !event.isPrimary || event.button !== 0) return
    const distance = (track.current?.clientWidth ?? 0) - event.currentTarget.offsetWidth - 12
    if (distance <= 0) return
    drag.current = { id: event.pointerId, start: event.clientX, distance }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current
    if (!active || active.id !== event.pointerId) return
    setOffset(Math.max(0, Math.min(active.distance, event.clientX - active.start)))
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current
    if (!active || active.id !== event.pointerId) return
    const complete = event.clientX - active.start >= active.distance * 0.95 &&
      Math.abs(event.clientY - event.currentTarget.getBoundingClientRect().top - event.currentTarget.offsetHeight / 2) < 60
    cancel()
    if (complete) execute()
  }
  if (!mobile) return <button type="button" className={className} disabled={disabled} onClick={confirm}>{label}</button>
  return <div ref={track} className={`guarded-slide ${className}`} data-disabled={disabled || undefined}>
    <span className="guarded-slide-label">{label}<small>向右滑到底，放開執行</small></span>
    <button
      type="button" className="guarded-slide-thumb" aria-label={label}
      aria-description="向右滑到底後放開執行；鍵盤或輔助操作可啟用確認視窗。"
      disabled={disabled} style={{ transform: `translateX(${offset}px)` }}
      onPointerDown={start} onPointerMove={move} onPointerUp={finish}
      onPointerCancel={cancel} onLostPointerCapture={cancel}
      onKeyDown={event => { if (event.key === 'Escape') cancel() }}
      onClick={event => { if (event.detail === 0) confirm() }}
    >→</button>
  </div>
}
