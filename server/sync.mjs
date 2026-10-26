import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'

const token = () => randomBytes(24).toString('base64url')
const send = (ws, value) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value)) }

export function validCueMarks(marks) {
  if (marks === undefined) return true // Compatibility with older controllers.
  if (!Array.isArray(marks)) return false
  const ids = new Set()
  return marks.every(mark => {
    if (!mark || typeof mark !== 'object' || typeof mark.id !== 'string' || ids.has(mark.id) ||
      typeof mark.label !== 'string' || typeof mark.segmentId !== 'string' || typeof mark.segmentName !== 'string' ||
      !Number.isInteger(mark.segmentOrder) || mark.segmentOrder < 0 || !['act', 'intermission'].includes(mark.segmentType) ||
      !Number.isFinite(mark.elapsedSeconds) || mark.elapsedSeconds < 0 || typeof mark.note !== 'string' ||
      typeof mark.createdAt !== 'string' || !Number.isFinite(Date.parse(mark.createdAt))) return false
    ids.add(mark.id)
    return true
  })
}

export function validSnapshot(s) {
  if (!s || typeof s.projectName !== 'string' || s.projectName.length > 500 ||
      !['idle', 'running', 'paused', 'finished'].includes(s.status) ||
      !Number.isFinite(s.elapsedMs) || s.elapsedMs < 0 ||
      !Number.isFinite(s.pausedMs) || s.pausedMs < 0 ||
      !Number.isFinite(s.currentPauseMs) || s.currentPauseMs < 0 ||
      !Number.isFinite(s.capturedAtMs) || typeof s.nextSegmentName !== 'string' || !validCueMarks(s.cueMarks)) return false
  return s.segment === null || (s.segment && typeof s.segment.name === 'string' && s.segment.name.length <= 500 &&
    ['act', 'intermission'].includes(s.segment.type) && Number.isFinite(s.segment.plannedSeconds) && s.segment.plannedSeconds >= 0)
}

export function createSyncServer({ port = 8787, host = '127.0.0.1', origins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://andyue.github.io'], createKey = '', handleRequest, allowRequest = () => true, dataFile = '', ttlMs = 24 * 3600_000 } = {}) {
  const rooms = new Map()
  if (dataFile && existsSync(dataFile)) {
    for (const [id, saved] of JSON.parse(readFileSync(dataFile, 'utf8'))) {
      if (saved.expiresAt > Date.now()) rooms.set(id, { ...saved, host: null, viewers: new Set() })
    }
  }
  function persist() {
    if (!dataFile) return
    mkdirSync(dirname(dataFile), { recursive: true })
    const saved = [...rooms].map(([id, room]) => [id, {
      hostToken: room.hostToken, viewerToken: room.viewerToken, snapshot: room.snapshot,
      revision: room.revision, updatedAt: room.updatedAt, expiresAt: room.expiresAt,
    }])
    writeFileSync(dataFile + '.tmp', JSON.stringify(saved), { mode: 0o600 })
    renameSync(dataFile + '.tmp', dataFile)
  }
  const http = createServer(handleRequest ?? ((req, res) => {
    res.writeHead(req.url === '/health' ? 200 : 404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ service: 'ShowTimer sync', ok: req.url === '/health' }))
  }))
  const wss = new WebSocketServer({ server: http, maxPayload: 8 * 1024 * 1024, verifyClient: ({ origin, req }) => origins.includes(origin) && allowRequest(req) })
  function broadcast(room) {
    const message = { type: 'snapshot', snapshot: room.snapshot, serverNow: Date.now(), hostOnline: !!room.host,
      updatedAt: room.updatedAt, revision: room.revision }
    for (const viewer of room.viewers) send(viewer, message)
  }
  function removeRoom(id, room) {
    for (const ws of [...room.viewers, ...(room.host ? [room.host] : [])]) {
      send(ws, { type: 'ended' }); ws.close(1000, 'Room ended')
    }
    rooms.delete(id); persist()
  }
  wss.on('connection', ws => {
    let session = null
    let rateStart = Date.now(), count = 0
    ws.alive = true
    ws.on('pong', () => { ws.alive = true })
    ws.on('message', raw => {
      if (Date.now() - rateStart > 1000) { rateStart = Date.now(); count = 0 }
      if (++count > 30) { ws.close(1008, 'Rate limit'); return }
      let message
      try { message = JSON.parse(raw.toString()) } catch { return ws.close(1008, 'Invalid JSON') }
      if (!message || typeof message !== 'object') return
      const fail = error => send(ws, { type: 'error', error })
      if (message.type === 'ping') return send(ws, { type: 'pong', clientNow: message.clientNow, serverNow: Date.now() })
      if (message.type === 'create' && !session) {
        if (createKey && message.key !== createKey) return fail('建立房間的服務金鑰不正確')
        if (rooms.size >= 100) return fail('服務房間已滿，請稍後重試')
        const id = token(), hostToken = token(), viewerToken = token()
        const room = { hostToken, viewerToken, host: ws, viewers: new Set(), snapshot: null, revision: 0,
          updatedAt: Date.now(), expiresAt: Date.now() + ttlMs }
        rooms.set(id, room); persist(); session = { id, role: 'host' }
        return send(ws, { type: 'created', id, hostToken, viewerToken })
      }
      if (message.type === 'join' && !session) {
        const room = rooms.get(message.id)
        if (!room || room.expiresAt < Date.now()) return fail('廣播已結束或房間不存在，請向主控取得新連結')
        if (message.token === room.hostToken) {
          if (room.host && room.host !== ws) return fail('已有另一個主控連線，請先關閉原主控')
          room.host = ws; session = { id: message.id, role: 'host' }
          send(ws, { type: 'joined', role: 'host' }); broadcast(room)
        } else if (message.token === room.viewerToken) {
          room.viewers.add(ws); session = { id: message.id, role: 'viewer' }
          send(ws, { type: 'joined', role: 'viewer' }); broadcast(room)
        } else fail('觀看連結或主控憑證無效')
        return
      }
      const room = session && rooms.get(session.id)
      if (!room) return fail('請先加入房間')
      if (message.type === 'publish') {
        if (session.role !== 'host' || room.host !== ws) return fail('觀看端不能控制廣播')
        if (!validSnapshot(message.snapshot)) return fail('同步資料格式不正確')
        room.snapshot = message.snapshot; room.updatedAt = Date.now(); room.expiresAt = Date.now() + ttlMs; room.revision++
        persist(); broadcast(room); send(ws, { type: 'published', revision: room.revision }); return
      }
      if (message.type === 'end' && session.role === 'host') removeRoom(session.id, room)
    })
    ws.on('close', () => {
      const room = session && rooms.get(session.id)
      if (!room) return
      if (room.host === ws) room.host = null
      room.viewers.delete(ws); broadcast(room)
    })
    ws.on('error', () => {})
  })
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) ws.terminate()
      else { ws.alive = false; ws.ping() }
    }
    for (const [id, room] of rooms) if (room.expiresAt < Date.now()) removeRoom(id, room)
  }, 10_000)
  http.listen(port, host)
  return { http, rooms, close: () => { clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); wss.close(); return new Promise(resolve => http.close(resolve)) } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.NODE_ENV === 'production' && !process.env.CREATE_KEY) throw new Error('Production requires CREATE_KEY')
  const service = createSyncServer({ port: Number(process.env.PORT || 8787), host: process.env.HOST || '127.0.0.1',
    origins: (process.env.ALLOWED_ORIGINS || 'https://andyue.github.io,http://localhost:5173,http://127.0.0.1:5173').split(','),
    createKey: process.env.CREATE_KEY || '', dataFile: process.env.DATA_FILE || '' })
  service.http.on('listening', () => console.log('ShowTimer sync listening', service.http.address()))
}
