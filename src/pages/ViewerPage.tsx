import { useEffect, useState } from 'react'
import { projectSnapshot, validateSocketUrl, type BroadcastSnapshot } from '../services/Broadcast'
import { formatTimerSeconds } from '../services/TimerEngine'

export default function ViewerPage() {
  const [snapshot, setSnapshot] = useState<BroadcastSnapshot | null>(null)
  const [status, setStatus] = useState('連線中…')
  const [clock, setClock] = useState(() => ({ offset: 0, now: Date.now() }))
  const [awake, setAwake] = useState(false)
  const [wakeStatus, setWakeStatus] = useState('')
  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1))
    let stopped = false, terminal = false, hostOnline = false, lastReceived = 0, revision = -1
    let ws: WebSocket
    let retryDelay = 1000
    let reconnect: ReturnType<typeof setTimeout>
    let offset = 0
    function connect() {
      let url
      try { url = validateSocketUrl(params.get('service') || '') } catch {
        setStatus('觀看連結無效，請重新掃描主控的 QR Code'); return
      }
      setStatus('連線中…'); ws = new WebSocket(url)
      ws.onopen = () => {
        revision = -1; lastReceived = Date.now()
        ws.send(JSON.stringify({ type: 'join', id: params.get('watch'), token: params.get('token') }))
        ws.send(JSON.stringify({ type: 'ping', clientNow: Date.now() }))
      }
      ws.onmessage = e => {
        if (stopped) return
        let data
        try { data = JSON.parse(e.data) } catch { return }
        if (data.type === 'pong') offset = data.serverNow - (Date.now() + data.clientNow) / 2
        if (data.type === 'snapshot' && data.revision >= revision) {
          retryDelay = 1000; revision = data.revision; lastReceived = Date.now(); hostOnline = data.hostOnline
          setSnapshot(data.snapshot)
          setStatus(!hostOnline ? '主控已離線，時間僅供參考' : data.snapshot ? '已同步 · 唯讀觀看' : '等待主控開始廣播')
        }
        if (data.type === 'ended' || data.type === 'error') {
          terminal = true; setStatus(data.error || '廣播已結束'); setSnapshot(null); ws.close()
        }
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => {
        if (!stopped && !terminal) { setStatus('連線中斷，時間僅供參考 · 正在重連'); reconnect = setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 15000) }
      }
    }
    connect()
    const tick = setInterval(() => {
      setClock({ offset, now: Date.now() })
      if (!terminal && lastReceived && Date.now() - lastReceived > 10000) {
        setStatus('同步中斷，時間僅供參考')
      }
    }, 250)
    const heartbeat = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping', clientNow: Date.now() }))
      if (!terminal && lastReceived && Date.now() - lastReceived > 15000 && hostOnline) ws?.close()
    }, 3000)
    const visible = () => { if (!document.hidden && ws?.readyState === WebSocket.OPEN) ws.close() }
    document.addEventListener('visibilitychange', visible)
    return () => { stopped = true; clearInterval(tick); clearInterval(heartbeat); clearTimeout(reconnect); ws?.close(); document.removeEventListener('visibilitychange', visible) }
  }, [])
  useEffect(() => {
    if (!awake) return
    let lock: WakeLockSentinel | undefined
    let stopped = false
    const request = async () => {
      if (document.hidden) return
      try {
        if (!navigator.wakeLock) throw new Error('unsupported')
        const acquired = await navigator.wakeLock.request('screen')
        if (stopped) { await acquired.release(); return }
        lock = acquired; setWakeStatus('螢幕保持亮起')
        lock.addEventListener('release', () => { if (!stopped) setWakeStatus('螢幕保持亮起已解除') })
      } catch { setWakeStatus('系統未允許保持亮起，請調整裝置自動鎖定設定') }
    }
    void request()
    document.addEventListener('visibilitychange', request)
    return () => { stopped = true; void lock?.release(); document.removeEventListener('visibilitychange', request) }
  }, [awake])
  const times = snapshot ? projectSnapshot(snapshot, clock.now + clock.offset) : null
  const elapsed = (times?.elapsedMs ?? 0) / 1000
  const display = snapshot?.segment?.type === 'intermission' ? Math.max(0, snapshot.segment.plannedSeconds - Math.floor(elapsed)) : elapsed
  return <main className={`viewer-page ${snapshot?.status === 'paused' ? 'viewer-paused' : ''}`}>
    <p className={status.startsWith('已同步') ? 'viewer-connected' : 'viewer-warning'} role="status">{status}</p>
    <h1>{snapshot?.projectName || 'ShowTimer'}</h1>
    <h2>{snapshot?.status === 'finished' ? '演出已完成' : snapshot?.segment?.name || '等待廣播'}</h2>
    <div className="viewer-time">{formatTimerSeconds(display)}</div>
    {snapshot?.status === 'paused' && <div className="pause-banner"><strong>演出暫停中</strong><span>本次暫停 {formatTimerSeconds((times?.currentPauseMs ?? 0) / 1000)}</span></div>}
    {snapshot?.status === 'idle' && <p>準備開始</p>}
    {snapshot && <p>累計暫停 {formatTimerSeconds((times?.pausedMs ?? 0) / 1000)}</p>}
    {snapshot?.nextSegmentName && snapshot.status !== 'finished' && <p>下一段：{snapshot.nextSegmentName}</p>}
    <div className="viewer-controls"><button onClick={() => { setAwake(!awake); setWakeStatus('') }}>{awake ? '允許螢幕休眠' : '保持螢幕亮起'}</button>
      <button onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.().catch(() => {}) }}>全螢幕</button></div>
    <small>{wakeStatus}</small>
  </main>
}
