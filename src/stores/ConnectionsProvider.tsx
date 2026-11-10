import { ATTENTION_CAPABILITY, ATTENTION_COOLDOWN_MS, type AttentionTarget } from '../services/Attention'
import { broadcastMessage } from '../services/BroadcastMessages'
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
  const [broadcastStatus, setBroadcastStatus] = useState('Not broadcasting')
  const [supportsAttention, setSupportsAttention] = useState(false)
  const [attentionStatus, setAttentionStatus] = useState('Start a broadcast to send reminders.')
  const lastAttentionAt = useRef(0)
  const pendingAttention = useRef('')
  const attentionTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [osc, setOsc] = useState<{ url: string; token: string } | null>(null)
  const [oscStatus, setOscStatus] = useState('Disconnected')
  const broadcastSocket = useRef<WebSocket | null>(null)
  const roomRef = useRef(room)
  const offset = useRef(0)
  const joined = useRef(false)
  const publish = useEffectEvent(() => {
    if (joined.current && broadcastSocket.current?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type: 'publish', snapshot: makeSnapshot(store.project, store.timerRun, Date.now(), offset.current) })
      if (new TextEncoder().encode(message).byteLength > 8 * 1024 * 1024) {
        setBroadcastStatus('Broadcast exceeds 8 MB. Export a backup and shorten Q Mark notes. Local timers remain available.')
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
      setSupportsAttention(false)
      setAttentionStatus('Connecting reminder service…')
      setBroadcastStatus('Connecting…')
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
          const supported = Array.isArray(data.capabilities) && data.capabilities.includes(ATTENTION_CAPABILITY)
          setSupportsAttention(supported)
          if (!supported) setAttentionStatus('Update the sync server to enable broadcast reminders.')
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
        if ((data.type === 'attention-sent' || data.type === 'attention-error') && data.id === pendingAttention.current) {
          clearTimeout(attentionTimeout.current); pendingAttention.current = ''
          setAttentionStatus(data.type === 'attention-error' ? data.error : `${data.target === 'screen' ? 'Screen' : 'Q Mark'} reminder sent to ${data.viewers} viewer(s).`)
        }
        if (data.type === 'published') setBroadcastStatus('Broadcasting')
        if (data.type === 'created' || data.type === 'joined') {
          retryDelay = 1000; joined.current = true; setBroadcastStatus('Broadcasting'); publish()
          if (data.capabilities?.includes(ATTENTION_CAPABILITY)) setAttentionStatus('Click the large timer or a Q Mark number to remind viewers.')
        }
        if (data.type === 'error' || data.type === 'ended') {
          terminal = true; joined.current = false
          setBroadcastStatus(broadcastMessage(data.error))
          ws.close()
        }
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => {
        joined.current = false; setSupportsAttention(false)
        clearTimeout(attentionTimeout.current); pendingAttention.current = ''
        if (!stopped && !terminal) { setBroadcastStatus('Connection lost. Reconnecting…'); reconnect = setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 15000) }
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
      clearTimeout(attentionTimeout.current); pendingAttention.current = ''
      broadcastSocket.current?.close(); joined.current = false
    }
  }, [url, request])

  const command = useEffectEvent((name: string) => {
    if (document.hidden) { setOscStatus('Command ignored: keep the controller in the foreground'); return }
    switch (name) {
      case 'start': store.startShow(); break
      case 'pause': store.pauseShow(); break
      case 'resume': store.resumeShow(); break
      case 'next': if (store.timerRun.status === 'running') store.nextSegment(); break
      case 'mark': store.addCueMark(); break
    }
    setOscStatus(`Connected · received ${name}`)
  })
  useEffect(() => {
    if (!osc) return
    let stopped = false
    let ws: WebSocket
    let retry: ReturnType<typeof setTimeout>
    let lastPong = Date.now()
    const seen = new Set<string>()
    function connect() {
      setOscStatus('Connecting…'); ws = new WebSocket(osc!.url)
      ws.onopen = () => { lastPong = Date.now(); ws.send(JSON.stringify({ type: 'pair', token: osc!.token })) }
      ws.onmessage = e => {
        if (stopped) return
        let data
        try { data = JSON.parse(e.data) } catch { return }
        if (data.type === 'paired') setOscStatus('Connected · OSC ready')
        if (data.type === 'pong') lastPong = Date.now()
        if (data.type === 'command' && typeof data.id === 'string' && !seen.has(data.id) && Math.abs(Date.now() - data.sentAt) < 2000) {
          if (seen.size > 500) seen.clear()
          seen.add(data.id); command(data.command)
        }
      }
      ws.onerror = () => ws.close()
      ws.onclose = e => {
        if (stopped) return
        if (e.code === 1008) { setOscStatus('Pairing failed: check the pairing code or close the other controller'); return }
        setOscStatus('OSC disconnected. Reconnecting…'); retry = setTimeout(connect, 2000)
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

  function sendAttention(target: AttentionTarget, cueMarkId?: string) {
    const socket = broadcastSocket.current
    if (!supportsAttention || !joined.current || socket?.readyState !== WebSocket.OPEN) return
    if (target === 'cue' && !store.project.cueMarks.some(mark => mark.id === cueMarkId)) return
    const now = Date.now()
    if (now - lastAttentionAt.current < ATTENTION_COOLDOWN_MS) {
      setAttentionStatus('Please wait before sending another reminder.'); return
    }
    if (socket.bufferedAmount > 256 * 1024) {
      setAttentionStatus('Network busy. Reminder was not sent; try again.'); return
    }
    lastAttentionAt.current = now
    const id = crypto.randomUUID()
    pendingAttention.current = id
    socket.send(JSON.stringify({ type: 'attention', id, target, cueMarkId, sentAtMs: now + offset.current }))
    clearTimeout(attentionTimeout.current)
    setAttentionStatus('Sending reminder…')
    attentionTimeout.current = setTimeout(() => {
      pendingAttention.current = ''
      setAttentionStatus('No reminder acknowledgement. Check the connection and try again.')
    }, 3000)
  }

  return <ConnectionsContext.Provider value={{ room, broadcastStatus, oscStatus,
    canSendAttention: supportsAttention && broadcastStatus === 'Broadcasting', attentionStatus, sendAttention,
    startBroadcast: (raw, key, viewerBaseUrl) => {
      try {
        const validated = validateSocketUrl(raw)
        roomRef.current = null; setRoom(null); sessionStorage.removeItem('showtimer-broadcast')
        setRequest({ url: validated, key, viewerBaseUrl })
      } catch (error) { setBroadcastStatus((error as Error).message) }
    },
    stopBroadcast: () => {
      if (broadcastSocket.current?.readyState === WebSocket.OPEN && joined.current) broadcastSocket.current.send(JSON.stringify({ type: 'end' }))
      roomRef.current = null; setRoom(null); setRequest(null); sessionStorage.removeItem('showtimer-broadcast'); setBroadcastStatus('Broadcast stopped'); setSupportsAttention(false); setAttentionStatus('Start a broadcast to send reminders.')
    },
    connectOsc: (raw, token) => {
      try { setOsc({ url: validateSocketUrl(raw, true), token }) } catch (error) { setOscStatus((error as Error).message) }
    },
    disconnectOsc: () => { setOsc(null); setOscStatus('Disconnected') },
  }}>{children}</ConnectionsContext.Provider>
}
