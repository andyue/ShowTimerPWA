import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { useShowTimerStore } from './useShowTimerStore'
import { ConnectionsContext } from './ConnectionsContext'
import { makeSnapshot, validateSocketUrl, type BroadcastRoom } from '../services/Broadcast'

function savedRoom(): BroadcastRoom | null {
  try {
    const room = JSON.parse(sessionStorage.getItem('showtimer-broadcast') || 'null')
    if (room && typeof room.id === 'string' && typeof room.hostToken === 'string' && typeof room.viewerToken === 'string') {
      validateSocketUrl(room.url); return room
    }
  } catch { /* Ignore invalid settings. */ }
  return null
}

export default function ConnectionsProvider({ children }: { children: ReactNode }) {
  const store = useShowTimerStore()
  const [room, setRoom] = useState<BroadcastRoom | null>(savedRoom)
  const [request, setRequest] = useState<{ url: string; key: string; viewerBaseUrl?: string } | null>(null)
  const [broadcastStatus, setBroadcastStatus] = useState('尚未開啟')
  const [osc, setOsc] = useState<{ url: string; token: string } | null>(null)
  const [oscStatus, setOscStatus] = useState('未連線')
  const broadcastSocket = useRef<WebSocket | null>(null)
  const roomRef = useRef(room)
  const offset = useRef(0)
  const joined = useRef(false)
  const publish = useEffectEvent(() => {
    if (joined.current && broadcastSocket.current?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type: 'publish', snapshot: makeSnapshot(store.project, store.timerRun, Date.now(), offset.current) })
      if (new TextEncoder().encode(message).byteLength > 8 * 1024 * 1024) {
        setBroadcastStatus('廣播資料超過 8 MB，請先匯出備份並減少 Q Mark 備註內容；本機計時仍可使用')
        return
      }
      broadcastSocket.current.send(message)
    }
  })
  // nowMs is just a local display tick; publish transitions immediately and heartbeat every 3s.
  const runKey = JSON.stringify({ ...store.timerRun, nowMs: 0 })
  useEffect(() => { publish() }, [runKey, store.project])

  const url = request?.url ?? room?.url
  useEffect(() => {
    if (!url) return
    let stopped = false, terminal = false
    let retryDelay = 1000
    let reconnect: ReturnType<typeof setTimeout>
    let lastPong = Date.now()
    function connect() {
      if (stopped) return
      joined.current = false
      setBroadcastStatus('連線中…')
      const ws = new WebSocket(url!)
      broadcastSocket.current = ws
      ws.onopen = () => {
        lastPong = Date.now()
        ws.send(JSON.stringify({ type: 'ping', clientNow: Date.now() }))
      }
      ws.onmessage = event => {
        if (stopped) return
        let data
        try { data = JSON.parse(event.data) } catch { return }
        if (data.type === 'pong') {
          lastPong = Date.now()
          offset.current = data.serverNow - (Date.now() + data.clientNow) / 2
          if (!joined.current) {
            const current = roomRef.current
            ws.send(JSON.stringify(current ? { type: 'join', id: current.id, token: current.hostToken } : { type: 'create', key: request?.key }))
          }
        }
        if (data.type === 'created') {
          const next = { viewerBaseUrl: request?.viewerBaseUrl, url: url!, id: data.id, hostToken: data.hostToken, viewerToken: data.viewerToken }
          roomRef.current = next; setRoom(next)
          sessionStorage.setItem('showtimer-broadcast', JSON.stringify(next))
        }
        if (data.type === 'published') setBroadcastStatus('廣播中')
        if (data.type === 'created' || data.type === 'joined') {
          retryDelay = 1000; joined.current = true; setBroadcastStatus('廣播中'); publish()
        }
        if (data.type === 'error' || data.type === 'ended') {
          terminal = true; joined.current = false
          setBroadcastStatus(data.error || '廣播已結束')
          ws.close()
        }
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => {
        joined.current = false
        if (!stopped && !terminal) { setBroadcastStatus('連線中斷，正在重連…'); reconnect = setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 15000) }
      }
    }
    connect()
    const heartbeat = setInterval(() => {
      const ws = broadcastSocket.current
      if (ws?.readyState === WebSocket.OPEN) {
        if (Date.now() - lastPong > 12000) { ws.close(); return }
        ws.send(JSON.stringify({ type: 'ping', clientNow: Date.now() })); publish()
      }
    }, 3000)
    const visible = () => { if (!document.hidden) publish() }
    document.addEventListener('visibilitychange', visible)
    return () => {
      stopped = true; clearTimeout(reconnect); clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', visible)
      broadcastSocket.current?.close(); joined.current = false
    }
  }, [url, request])

  const command = useEffectEvent((name: string) => {
    if (document.hidden) { setOscStatus('已忽略指令：請保持主控畫面在前景'); return }
    switch (name) {
      case 'start': store.startShow(); break
      case 'pause': store.pauseShow(); break
      case 'resume': store.resumeShow(); break
      case 'next': if (store.timerRun.status === 'running') store.nextSegment(); break
      case 'mark': store.addCueMark(); break
    }
    setOscStatus(`已連線 · 收到 ${name}`)
  })
  useEffect(() => {
    if (!osc) return
    let stopped = false
    let ws: WebSocket
    let retry: ReturnType<typeof setTimeout>
    let lastPong = Date.now()
    const seen = new Set<string>()
    function connect() {
      setOscStatus('連線中…'); ws = new WebSocket(osc!.url)
      ws.onopen = () => { lastPong = Date.now(); ws.send(JSON.stringify({ type: 'pair', token: osc!.token })) }
      ws.onmessage = e => {
        if (stopped) return
        let data
        try { data = JSON.parse(e.data) } catch { return }
        if (data.type === 'paired') setOscStatus('已連線 · QLab 就緒')
        if (data.type === 'pong') lastPong = Date.now()
        if (data.type === 'command' && typeof data.id === 'string' && !seen.has(data.id) && Math.abs(Date.now() - data.sentAt) < 2000) {
          if (seen.size > 500) seen.clear()
          seen.add(data.id); command(data.command)
        }
      }
      ws.onerror = () => ws.close()
      ws.onclose = e => {
        if (stopped) return
        if (e.code === 1008) { setOscStatus('配對失敗：檢查配對碼，或關閉另一個主控'); return }
        setOscStatus('OSC 斷線，正在重連…'); retry = setTimeout(connect, 2000)
      }
    }
    connect()
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        if (Date.now() - lastPong > 10000) ws.close()
        else ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 3000)
    return () => { stopped = true; clearTimeout(retry); clearInterval(heartbeat); ws.close() }
  }, [osc])

  return <ConnectionsContext.Provider value={{ room, broadcastStatus, oscStatus,
    startBroadcast: (raw, key, viewerBaseUrl) => {
      try {
        const validated = validateSocketUrl(raw)
        roomRef.current = null; setRoom(null); sessionStorage.removeItem('showtimer-broadcast')
        setRequest({ url: validated, key, viewerBaseUrl })
      } catch (error) { setBroadcastStatus((error as Error).message) }
    },
    stopBroadcast: () => {
      if (broadcastSocket.current?.readyState === WebSocket.OPEN && joined.current) broadcastSocket.current.send(JSON.stringify({ type: 'end' }))
      roomRef.current = null; setRoom(null); setRequest(null); sessionStorage.removeItem('showtimer-broadcast'); setBroadcastStatus('已停止廣播')
    },
    connectOsc: (raw, token) => {
      try { setOsc({ url: validateSocketUrl(raw, true), token }) } catch (error) { setOscStatus((error as Error).message) }
    },
    disconnectOsc: () => { setOsc(null); setOscStatus('未連線') },
  }}>{children}</ConnectionsContext.Provider>
}
