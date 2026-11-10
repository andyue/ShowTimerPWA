import { useEffect, useState } from 'react'
import { formatClockTime } from '../services/TimerEngine'

export default function WallClock() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])
  return <div className="wall-clock" aria-label="Current local time" title="Device local time (24-hour clock)">{formatClockTime(now)}</div>
}
