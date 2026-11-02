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
  return <div className="wall-clock" aria-label="當下實際時間" title="裝置本地時間（24 小時制）">{formatClockTime(now)}</div>
}
